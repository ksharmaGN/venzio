export type AppChannel = 'web' | 'pwa' | 'capacitor_android' | 'capacitor_ios'

export function parseAppChannel(deviceInfo: string | null): AppChannel | null {
  if (!deviceInfo) return null
  try {
    const parsed = JSON.parse(deviceInfo) as { app_channel?: AppChannel }
    const ch = parsed.app_channel
    if (
      ch === 'web' ||
      ch === 'pwa' ||
      ch === 'capacitor_android' ||
      ch === 'capacitor_ios'
    ) {
      return ch
    }
    return null
  } catch {
    return null
  }
}

export function appChannelLabel(channel: AppChannel | null): string | null {
  if (!channel) return null
  switch (channel) {
    case 'capacitor_android':
      return 'Android app'
    case 'capacitor_ios':
      return 'iOS app'
    case 'pwa':
      return 'PWA'
    default:
      return 'Web'
  }
}
