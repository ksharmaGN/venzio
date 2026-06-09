package ai.venzio.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeTrustPlugin.class);
        registerPlugin(NativeGeofencePlugin.class);
        registerPlugin(NativeSessionPlugin.class);
        CookieManager.getInstance().setAcceptCookie(true);
        NativeSessionPlugin.restoreFromPrefs(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
