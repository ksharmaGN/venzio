'use client'

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { isNativeApp } from '@/lib/client/app-channel'
import {
  onGeofenceEnter,
  startGeofenceMonitoring,
  type GeofenceCircle,
} from '@/lib/client/native-geofence'
import {
  notifyOfficeArrival,
  requestNativeNotificationPermission,
} from '@/lib/client/native-notifications'
import { restoreNativeSession } from '@/lib/client/native-session'

async function hasOpenCheckInToday(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const res = await fetch(
    `/api/events?start=${today}T00:00:00.000Z&end=${today}T23:59:59.999Z&limit=20`,
  )
  if (!res.ok) return false
  const data = (await res.json()) as { events?: { checkout_at: string | null }[] }
  return (data.events ?? []).some((e) => e.checkout_at == null)
}

/** Native-only: geofence monitoring + Android back → home (stay in recents). */
export default function NativeAppBackground() {
  useEffect(() => {
    if (!isNativeApp()) return

    let removeListener = () => {}
    let backHandle: { remove: () => void } | null = null

    async function setup() {
      try {
        await restoreNativeSession()
        await requestNativeNotificationPermission()

        const [geoRes, reminderRes] = await Promise.all([
          fetch('/api/me/geofences'),
          fetch('/api/me/reminders'),
        ])
        if (!geoRes.ok || !reminderRes.ok) return

        const reminders = (await reminderRes.json()) as { office_arrival?: boolean }
        if (reminders.office_arrival === false) return

        const data = (await geoRes.json()) as {
          geofences: {
            id: string
            workspace_id: string
            name: string
            lat: number
            lng: number
            radius_m: number
          }[]
        }
        const circles: GeofenceCircle[] = data.geofences.map((g) => ({
          id: g.id,
          workspaceId: g.workspace_id,
          name: g.name,
          lat: g.lat,
          lng: g.lng,
          radiusM: g.radius_m,
        }))
        if (circles.length === 0) return

        await startGeofenceMonitoring(circles)
        removeListener = onGeofenceEnter(({ name }) => {
          void (async () => {
            if (await hasOpenCheckInToday()) return
            void notifyOfficeArrival(name)
          })()
        })
      } catch {
        /* best-effort */
      }
    }

    void setup()

    if (Capacitor.getPlatform() === 'android') {
      void App.addListener('backButton', () => {
        void App.minimizeApp()
      }).then((h) => {
        backHandle = h
      })
    }

    return () => {
      removeListener()
      backHandle?.remove()
    }
  }, [])

  return null
}
