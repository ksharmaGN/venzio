package ai.venzio.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "NativeGeofence")
public class NativeGeofencePlugin extends Plugin {

    private static final String CHANNEL_ID = "venzio_geofence";
    private static final int FOREGROUND_ID = 9001;
    private static final Map<String, Long> lastEnterMs = new HashMap<>();
    private static final long DEBOUNCE_MS = 4 * 3600_000L;
    private static NativeGeofencePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        JSArray arr = call.getArray("geofences");
        if (arr == null) {
            call.reject("geofences required");
            return;
        }
        List<GeofenceCircle> circles = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSObject o = arr.getJSObject(i);
            if (o == null) continue;
            circles.add(
                new GeofenceCircle(
                    o.getString("id", "g" + i),
                    o.getString("name", "Office"),
                    o.getDouble("lat", 0),
                    o.getDouble("lng", 0),
                    o.getInteger("radiusM", 300)));
        }
        GeofenceMonitorService.setGeofences(circlesToJson(circles));
        Context ctx = getContext();
        Intent intent = new Intent(ctx, GeofenceMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        getContext().stopService(new Intent(getContext(), GeofenceMonitorService.class));
        call.resolve();
    }

    static void notifyEnter(Context ctx, String id, String name) {
        long now = System.currentTimeMillis();
        Long last = lastEnterMs.get(id);
        if (last != null && now - last < DEBOUNCE_MS) return;
        lastEnterMs.put(id, now);

        if (instance != null) {
            JSObject data = new JSObject();
            data.put("geofenceId", id);
            data.put("name", name);
            instance.notifyListeners("geofenceEnter", data);
        }
    }

    private static String circlesToJson(List<GeofenceCircle> circles) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < circles.size(); i++) {
            GeofenceCircle c = circles.get(i);
            if (i > 0) sb.append(",");
            sb.append("{")
                .append("\"id\":\"")
                .append(c.id)
                .append("\",\"name\":\"")
                .append(c.name.replace("\"", ""))
                .append("\",\"lat\":")
                .append(c.lat)
                .append(",\"lng\":")
                .append(c.lng)
                .append(",\"radiusM\":")
                .append(c.radiusM)
                .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    static class GeofenceCircle {
        final String id;
        final String name;
        final double lat;
        final double lng;
        final int radiusM;

        GeofenceCircle(String id, String name, double lat, double lng, int radiusM) {
            this.id = id;
            this.name = name;
            this.lat = lat;
            this.lng = lng;
            this.radiusM = radiusM;
        }
    }

    public static class GeofenceMonitorService extends Service implements LocationListener {
        private static String geofencesJson = "[]";
        private LocationManager locationManager;

        static void setGeofences(String json) {
            geofencesJson = json;
        }

        @Override
        public void onCreate() {
            super.onCreate();
            createChannel();
            startForeground(
                FOREGROUND_ID,
                new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("Venzio")
                    .setContentText("Monitoring office arrival for check-in reminders")
                    .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                    .setOngoing(true)
                    .build());
            locationManager =
                (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            try {
                if (locationManager != null) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER, 300_000L, 50f, this);
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER, 300_000L, 50f, this);
                }
            } catch (SecurityException ignored) {
                /* permission not granted */
            }
        }

        @Override
        public int onStartCommand(Intent intent, int flags, int startId) {
            return START_STICKY;
        }

        @Override
        public void onLocationChanged(Location location) {
            List<GeofenceCircle> circles = parseGeofences(geofencesJson);
            for (GeofenceCircle c : circles) {
                float[] dist = new float[1];
                Location.distanceBetween(
                    location.getLatitude(),
                    location.getLongitude(),
                    c.lat,
                    c.lng,
                    dist);
                if (dist[0] <= c.radiusM) {
                    NativeGeofencePlugin.notifyEnter(this, c.id, c.name);
                }
            }
        }

        @Override
        public void onDestroy() {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
            super.onDestroy();
        }

        @Override
        public IBinder onBind(Intent intent) {
            return null;
        }

        private void createChannel() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch =
                    new NotificationChannel(
                        CHANNEL_ID, "Office arrival", NotificationManager.IMPORTANCE_LOW);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.createNotificationChannel(ch);
            }
        }

        private static List<GeofenceCircle> parseGeofences(String json) {
            List<GeofenceCircle> list = new ArrayList<>();
            try {
                org.json.JSONArray arr = new org.json.JSONArray(json);
                for (int i = 0; i < arr.length(); i++) {
                    org.json.JSONObject o = arr.getJSONObject(i);
                    list.add(
                        new GeofenceCircle(
                            o.getString("id"),
                            o.getString("name"),
                            o.getDouble("lat"),
                            o.getDouble("lng"),
                            o.getInt("radiusM")));
                }
            } catch (Exception ignored) {
                /* invalid json */
            }
            return list;
        }
    }
}
