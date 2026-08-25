import { db } from '../index'
import { parsePermissions } from '@/lib/permissions/can'
import type { PermissionGrid, Scope } from '@/lib/permissions/catalogue'

export interface WorkspaceRole {
  id: string
  workspace_id: string
  key: string
  name: string
  description: string | null
  permissions: string // raw JSON
  scope: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** A role row with its grid already parsed - what callers actually want. */
export interface ResolvedRole {
  id: string
  key: string
  name: string
  description: string | null
  permissions: PermissionGrid
  scope: Scope
}

function resolve(row: WorkspaceRole): ResolvedRole {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    permissions: parsePermissions(row.permissions),
    scope: (row.scope === 'all' ? 'all' : 'self') as Scope,
  }
}

export interface MembershipWithRole {
  member_id: string
  workspace_id: string
  user_id: string | null
  email: string
  status: string
  role_key: string
  role_id: string | null
  role_name: string | null
  role_description: string | null
  role_permissions: string | null
  role_scope: string | null
}

/**
 * The hot path: one query returning the caller's membership AND their role
 * definition. requireWsAccess() runs this on every request, so it must stay a
 * single round trip - today's requireWsAdmin already fetches the membership
 * row, and this adds a join to it rather than a second query.
 *
 * LEFT JOIN, not INNER: a membership whose role key has no matching row (a
 * deleted custom role, or a database seeded before this migration) must still
 * resolve, with no permissions, rather than vanishing and reading as
 * "not a member".
 */
export async function getMembershipWithRole(
  workspaceId: string,
  userId: string,
): Promise<MembershipWithRole | null> {
  return db.queryOne<MembershipWithRole>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.status,
            wm.role as role_key,
            wr.id as role_id, wr.name as role_name, wr.description as role_description,
            wr.permissions as role_permissions, wr.scope as role_scope
     FROM workspace_members wm
     LEFT JOIN workspace_roles wr
       ON wr.workspace_id = wm.workspace_id
      AND wr.key = wm.role
      AND wr.deleted_at IS NULL
     WHERE wm.workspace_id = ? AND wm.user_id = ?`,
    [workspaceId, userId],
  )
}

/** Turn the joined row into a role, falling back to no access when unmatched. */
export function roleFromMembership(row: MembershipWithRole): ResolvedRole {
  return {
    id: row.role_id ?? '',
    key: row.role_key,
    name: row.role_name ?? row.role_key,
    description: row.role_description,
    permissions: parsePermissions(row.role_permissions),
    scope: (row.role_scope === 'all' ? 'all' : 'self') as Scope,
  }
}

export async function listWorkspaceRoles(workspaceId: string): Promise<ResolvedRole[]> {
  const rows = await db.query<WorkspaceRole>(
    `SELECT * FROM workspace_roles
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId],
  )
  return rows.map(resolve)
}

export async function getRoleByKey(
  workspaceId: string,
  key: string,
): Promise<ResolvedRole | null> {
  const row = await db.queryOne<WorkspaceRole>(
    `SELECT * FROM workspace_roles
     WHERE workspace_id = ? AND key = ? AND deleted_at IS NULL`,
    [workspaceId, key],
  )
  return row ? resolve(row) : null
}

/** How many active members hold each role key - drives the roles list UI. */
export async function getRoleMemberCounts(
  workspaceId: string,
): Promise<Record<string, number>> {
  const rows = await db.query<{ role: string; c: number }>(
    `SELECT role, COUNT(*) as c FROM workspace_members
     WHERE workspace_id = ? AND status = 'active'
     GROUP BY role`,
    [workspaceId],
  )
  return Object.fromEntries(rows.map((r) => [r.role, r.c]))
}
