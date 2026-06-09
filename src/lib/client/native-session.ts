import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './app-channel'
export interface NativeSessionPlugin {
  persistSession(options: { token: string; origin: string }): Promise<void>
  restoreSession(options: { origin: string }): Promise<void>
  clearSession(options: { origin: string }): Promise<void>
}

const NativeSession = registerPlugin<NativeSessionPlugin>('NativeSession')

export function getWebOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

/** Request header so auth APIs may return session_token for native cookie backup. */
export function nativeSessionHeaders(): HeadersInit {
  return isNativeApp() ? { 'X-Venzio-Native': '1' } : {}
}

/** After login/register/reactivate: mirror httpOnly cookie into WebView + SharedPreferences. */
export async function persistNativeSession(sessionToken: string | undefined): Promise<void> {
  if (!isNativeApp() || !sessionToken) return
  const origin = getWebOrigin()
  if (!origin) return
  await NativeSession.persistSession({ token: sessionToken, origin })
}

/** Re-apply stored session before API calls (cold start). */
export async function restoreNativeSession(): Promise<void> {
  if (!isNativeApp()) return
  const origin = getWebOrigin()
  if (!origin) return
  await NativeSession.restoreSession({ origin })
}

export async function clearNativeSession(): Promise<void> {
  if (!isNativeApp()) return
  const origin = getWebOrigin()
  if (!origin) return
  await NativeSession.clearSession({ origin })
}

/** Use for login/register/reactivate so cookies + native backup stay in sync. */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...nativeSessionHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
}

export async function completeAuthFromResponse(data: {
  session_token?: string
}): Promise<void> {
  if (data.session_token) {
    await persistNativeSession(data.session_token)
  }
}
