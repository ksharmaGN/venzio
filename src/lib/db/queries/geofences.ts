import { db } from '../index'

export interface MemberGeofence {
  id: string
  workspace_id: string
  workspace_slug: string
  workspace_name: string
  name: string
  lat: number
  lng: number
  radius_m: number
}

/** Office GPS circles from all active workspaces the member belongs to. */
export async function getMemberOfficeGeofences(userId: string): Promise<MemberGeofence[]> {
  return db.query<MemberGeofence>(
    `SELECT
       wsc.id,
       wsc.workspace_id,
       w.slug AS workspace_slug,
       w.name AS workspace_name,
       COALESCE(wsc.location_name, w.name) AS name,
       wsc.gps_lat AS lat,
       wsc.gps_lng AS lng,
       COALESCE(wsc.gps_radius_m, 300) AS radius_m
     FROM workspace_signal_config wsc
     INNER JOIN workspaces w ON w.id = wsc.workspace_id AND w.archived_at IS NULL
     INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       AND wm.user_id = ? AND wm.status = 'active'
     WHERE wsc.is_active = 1
       AND wsc.signal_type = 'gps'
       AND wsc.gps_lat IS NOT NULL
       AND wsc.gps_lng IS NOT NULL`,
    [userId],
  )
}
