package ai.venzio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.CookieManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/** Persists auth cookies for Capacitor remote WebView (survives app restart). */
@CapacitorPlugin(name = "NativeSession")
public class NativeSessionPlugin extends Plugin {

    private static final String PREFS = "venzio_native_session";
    private static final String KEY_TOKEN = "session_token";
    private static final String KEY_ORIGIN = "server_origin";
    private static final String COOKIE_SESSION = "vnz_session";
    private static final String COOKIE_UI = "vnz_ui";
    private static final long MAX_AGE_SEC = 60L * 60 * 24 * 30;

    @PluginMethod
    public void persistSession(PluginCall call) {
        String token = call.getString("token");
        String origin = call.getString("origin");
        if (token == null || token.isEmpty() || origin == null || origin.isEmpty()) {
            call.reject("token and origin required");
            return;
        }
        saveAndApplyCookies(getContext(), origin, token);
        call.resolve();
    }

    @PluginMethod
    public void restoreSession(PluginCall call) {
        String origin = call.getString("origin");
        if (origin == null || origin.isEmpty()) {
            call.reject("origin required");
            return;
        }
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        String savedOrigin = prefs.getString(KEY_ORIGIN, null);
        if (token != null && origin.equals(savedOrigin)) {
            applyCookies(origin, token);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        String origin = call.getString("origin");
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();
        if (origin != null && !origin.isEmpty()) {
            CookieManager cm = CookieManager.getInstance();
            cm.setCookie(origin, COOKIE_SESSION + "=; path=/; max-age=0");
            cm.setCookie(origin, COOKIE_UI + "=; path=/; max-age=0");
            cm.flush();
        }
        call.resolve();
    }

    static void restoreFromPrefs(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        String origin = prefs.getString(KEY_ORIGIN, null);
        if (token == null || origin == null) return;
        applyCookies(origin, token);
    }

    static String readServerOrigin(Context context) {
        try {
            java.io.InputStream is = context.getAssets().open("capacitor.config.json");
            byte[] buf = new byte[is.available()];
            int n = is.read(buf);
            is.close();
            JSONObject root = new JSONObject(new String(buf, 0, n));
            JSONObject server = root.optJSONObject("server");
            if (server == null) return "https://venzio.ai";
            String url = server.optString("url", "https://venzio.ai/me");
            Uri uri = Uri.parse(url);
            if (uri.getScheme() == null || uri.getHost() == null) return "https://venzio.ai";
            return uri.getScheme() + "://" + uri.getHost();
        } catch (Exception e) {
            return "https://venzio.ai";
        }
    }

    private static void saveAndApplyCookies(Context context, String origin, String token) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_ORIGIN, origin)
            .apply();
        applyCookies(origin, token);
    }

    private static void applyCookies(String origin, String token) {
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        boolean secure = origin.startsWith("https://");
        String secureFlag = secure ? "; secure" : "";
        String sameSite = "; samesite=lax";
        cm.setCookie(
            origin,
            COOKIE_SESSION
                + "="
                + token
                + "; path=/; max-age="
                + MAX_AGE_SEC
                + secureFlag
                + sameSite);
        cm.setCookie(
            origin,
            COOKIE_UI + "=1; path=/; max-age=" + MAX_AGE_SEC + secureFlag + sameSite);
        cm.flush();
    }
}
