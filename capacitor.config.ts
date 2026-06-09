import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? 'https://venzio.ai/me'

const config: CapacitorConfig = {
  appId: "ai.venzio.app",
  appName: "Venzio",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    allowNavigation: [
      "venzio.ai",
      "*.venzio.ai",
      "localhost",
      "127.0.0.1",
      "10.0.2.2",
    ],
  },
  ios: {
    contentInset: "automatic",
    appendUserAgent: "VenzioNative/1",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_venzio",
      iconColor: "#1B4DFF",
    },
  },
};

export default config
