import { randomBytes } from 'crypto'
import { db } from '../index'
import type { EmergencyContact } from '@/lib/types/employees'

export async function addEmergencyContact(
  employeeId: string,
  workspaceId: string,
  contact: { name: string; relationship?: string | null; phone: string },
): Promise<EmergencyContact> {
  const id = randomBytes(16).toString('hex')
  await db.execute(
    `INSERT INTO employee_emergency_contacts
     (id, employee_id, workspace_id, name, relationship, phone)
     VALUES (?,?,?,?,?,?)`,
    [id, employeeId, workspaceId, contact.name, contact.relationship ?? null, contact.phone],
  )
  return { id, name: contact.name, relationship: contact.relationship ?? null, phone: contact.phone }
}

export async function removeEmergencyContact(
  id: string,
  employeeId: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await db.execute(
    `DELETE FROM employee_emergency_contacts WHERE id = ? AND employee_id = ? AND workspace_id = ?`,
    [id, employeeId, workspaceId],
  )
  return result.changes > 0
}
