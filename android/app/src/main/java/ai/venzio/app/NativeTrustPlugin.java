package ai.venzio.app;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@CapacitorPlugin(name = "NativeTrust")
public class NativeTrustPlugin extends Plugin {

    @PluginMethod
    public void checkMockLocation(PluginCall call) {
        JSObject ret = new JSObject();
        boolean mock = false;
        boolean devOptions = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int mockSetting =
                    Settings.Secure.getInt(
                        getContext().getContentResolver(),
                        Settings.Secure.ALLOW_MOCK_LOCATION,
                        0);
                mock = mockSetting != 0;
            }
            devOptions =
                Settings.Global.getInt(
                        getContext().getContentResolver(),
                        Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                        0)
                    != 0;
            LocationManager lm =
                (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                try {
                    Location last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (last == null) {
                        last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    }
                    if (last != null && last.isFromMockProvider()) {
                        mock = true;
                    }
                } catch (SecurityException ignored) {
                    /* location permission not granted yet */
                }
            }
        } catch (Exception ignored) {
            /* best-effort */
        }
        ret.put("isMockLocation", mock);
        ret.put("hasDeveloperOptions", devOptions);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceFingerprint(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String androidId =
                Settings.Secure.getString(
                    getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            String raw =
                (androidId != null ? androidId : "unknown")
                    + "|"
                    + Build.MANUFACTURER
                    + "|"
                    + Build.MODEL
                    + "|"
                    + Build.FINGERPRINT;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            ret.put("deviceHash", sb.toString());
            ret.put("platform", "android");
        } catch (Exception e) {
            ret.put("deviceHash", "unknown");
            ret.put("platform", "android");
        }
        call.resolve(ret);
    }
}
