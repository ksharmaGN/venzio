import { db } from '../index'

export interface TrustedDevice {
  id: string
  user_id: string
  device_hash: string
  platform: string
  first_seen_at: string
  last_seen_at: string
}

export async function upsertTrustedDevice(params: {
  userId: string
  deviceHash: string
  platform: string
}): Promise<TrustedDevice> {
  const existing = await db.queryOne<TrustedDevice>(
    'SELECT * FROM trusted_devices WHERE user_id = ? AND device_hash = ?',
    [params.userId, params.deviceHash],
  )
  if (existing) {
    await db.execute(
      `UPDATE trusted_devices SET last_seen_at = datetime('now'), platform = ? WHERE id = ?`,
      [params.platform, existing.id],
    )
    return (
      (await db.queryOne<TrustedDevice>('SELECT * FROM trusted_devices WHERE id = ?', [
        existing.id,
      ])) ?? existing
    )
  }
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO trusted_devices (id, user_id, device_hash, platform, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, params.userId, params.deviceHash, params.platform],
  )
  return db.queryOne<TrustedDevice>('SELECT * FROM trusted_devices WHERE id = ?', [
    id,
  ]) as Promise<TrustedDevice>
}

export async function isKnownDevice(userId: string, deviceHash: string): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    'SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ?',
    [userId, deviceHash],
  )
  return !!row
}

export async function getTrustedDevicesForUser(userId: string): Promise<TrustedDevice[]> {
  return db.query<TrustedDevice>(
    'SELECT * FROM trusted_devices WHERE user_id = ? ORDER BY last_seen_at DESC',
    [userId],
  )
}
