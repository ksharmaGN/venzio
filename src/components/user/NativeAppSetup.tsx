'use client'

import { useEffect } from 'react'
import { isNativeApp } from '@/lib/client/app-channel'
import {
  onGeofenceEnter,
  startGeofenceMonitoring,
  stopGeofenceMonitoring,
  type GeofenceCircle,
} from '@/lib/client/native-geofence'
import { notifyOfficeArrival } from '@/lib/client/native-notifications'

/** Starts native geofence monitoring when running inside Capacitor. */
export default function NativeAppSetup({ isCheckedIn }: { isCheckedIn: boolean }) {
  useEffect(() => {
    if (!isNativeApp()) return

    let removeListener = () => {}

    async function setup() {
      try {
        const res = await fetch('/api/me/geofences')
        if (!res.ok) return
        const data = (await res.json()) as {
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
        await startGeofenceMonitoring(circles)
        removeListener = onGeofenceEnter(({ name }) => {
          if (!isCheckedIn) void notifyOfficeArrival(name)
        })
      } catch {
        /* best-effort */
      }
    }

    void setup()
    return () => {
      removeListener()
      void stopGeofenceMonitoring()
    }
  }, [isCheckedIn])

  return null
}
