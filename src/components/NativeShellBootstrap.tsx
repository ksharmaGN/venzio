'use client'

import { useEffect } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { isNativeApp } from '@/lib/client/app-channel'
import { restoreNativeSession } from '@/lib/client/native-session'
import { requestNativeNotificationPermission } from '@/lib/client/native-notifications'

/**
 * Runs on every page in the native shell (login + /me).
 * Restores cookies and prompts for notifications without PWA/Safari flows.
 */
export default function NativeShellBootstrap() {
  useEffect(() => {
    if (!isNativeApp()) return
    void (async () => {
      await restoreNativeSession()
      await requestNativeNotificationPermission()
      await Geolocation.requestPermissions().catch(() => {})
    })()
  }, [])

  return null
}
