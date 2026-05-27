import { WebPlugin } from '@capacitor/core'
import type { GeofenceCircle, NativeGeofencePlugin } from './native-geofence'

export class NativeGeofenceWeb extends WebPlugin implements NativeGeofencePlugin {
  async startMonitoring(_options: { geofences: GeofenceCircle[] }): Promise<void> {
    /* no-op on web — use Web Push / PWA */
  }

  async stopMonitoring(): Promise<void> {
    /* no-op */
  }
}
