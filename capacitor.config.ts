import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? 'https://venzio.ai/me'

const config: CapacitorConfig = {
  appId: 'ai.venzio.app',
  appName: 'Venzio',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
