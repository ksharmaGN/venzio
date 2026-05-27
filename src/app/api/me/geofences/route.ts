import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { getMemberOfficeGeofences } from '@/lib/db/queries/geofences'

export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const geofences = await getMemberOfficeGeofences(user.userId)
  return NextResponse.json({
    geofences: geofences.map((g) => ({
      id: g.id,
      workspace_id: g.workspace_id,
      workspace_slug: g.workspace_slug,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      radius_m: g.radius_m,
    })),
  })
}
