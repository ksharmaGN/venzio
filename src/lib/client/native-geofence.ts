import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './app-channel'

export interface GeofenceCircle {
  id: string
  workspaceId: string
  name: string
  lat: number
  lng: number
  radiusM: number
}

export interface NativeGeofencePlugin {
  startMonitoring(options: { geofences: GeofenceCircle[] }): Promise<void>
  stopMonitoring(): Promise<void>
  addListener(
    eventName: 'geofenceEnter',
    listener: (data: { geofenceId: string; name: string }) => void,
  ): Promise<{ remove: () => void }>
}

const NativeGeofence = registerPlugin<NativeGeofencePlugin>('NativeGeofence', {
  web: () => import('./native-geofence.web').then((m) => new m.NativeGeofenceWeb()),
})

export async function startGeofenceMonitoring(geofences: GeofenceCircle[]): Promise<void> {
  if (!isNativeApp() || geofences.length === 0) return
  await NativeGeofence.startMonitoring({ geofences })
}

export async function stopGeofenceMonitoring(): Promise<void> {
  if (!isNativeApp()) return
  await NativeGeofence.stopMonitoring()
}

export function onGeofenceEnter(
  handler: (data: { geofenceId: string; name: string }) => void,
): () => void {
  if (!isNativeApp()) return () => {}
  let handle: { remove: () => void } | null = null
  void NativeGeofence.addListener('geofenceEnter', handler).then((h) => {
    handle = h
  })
  return () => {
    handle?.remove()
  }
}

export { NativeGeofence }
