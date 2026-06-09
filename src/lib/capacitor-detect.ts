/** True when the request comes from a Capacitor WebView (iOS or Android). */
export function isCapacitorUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return userAgent.includes('Capacitor') || userAgent.includes('VenzioNative/')
}
