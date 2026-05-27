import { Capacitor } from '@capacitor/core'

export type AppChannel = 'web' | 'pwa' | 'capacitor_android' | 'capacitor_ios'

/** How the user is running Venzio — sent on check-in as app_channel inside device_info. */
export function getAppChannel(): AppChannel {
  if (typeof window === 'undefined') return 'web'
  const platform = Capacitor.getPlatform()
  if (platform === 'android') return 'capacitor_android'
  if (platform === 'ios') return 'capacitor_ios'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa'
  return 'web'
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
