package ai.venzio.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeTrustPlugin.class);
        registerPlugin(NativeGeofencePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
