/**
 * The permission catalogue - the single list of what can be permissioned.
 *
 * This file is DATA ONLY. It is imported by client components (the future
 * Roles grid), by route handlers, and by the seed grids below, so it must not
 * pull in server-side logic or database code.
 *
 * A resource declares which actions are meaningful for it. Anything not
 * declared here does not exist: you cannot "delete" a dashboard, so the
 * dashboard resource simply has no delete action. Server validation and (in
 * phase 2) the checkbox grid both read this list, so they can never disagree
 * about which cells are real.
 */

export type Action = 'read' | 'write' | 'delete'

export interface ResourceDef {
  key: string
  /** Human label - shown in the phase 2 roles grid. */
  label: string
  actions: readonly Action[]
}

export const RESOURCES = [
  { key: 'dashboard', label: 'Dashboard',           actions: ['read'] },
  { key: 'analytics', label: 'Analytics & insights', actions: ['read'] },
  { key: 'activity',  label: 'Activity',            actions: ['read'] },
  { key: 'export',    label: 'Export',              actions: ['read'] },

  { key: 'members',   label: 'Members',             actions: ['read', 'write', 'delete'] },
  { key: 'employees', label: 'Employee records',    actions: ['read', 'write', 'delete'] },
  { key: 'holidays',  label: 'Holidays',            actions: ['read', 'write', 'delete'] },
  { key: 'leaves',    label: 'Leave',               actions: ['read', 'write', 'delete'] },
  { key: 'approvals', label: 'Approvals',           actions: ['read', 'write'] },
  { key: 'signals',   label: 'Signal config',       actions: ['read', 'write', 'delete'] },
  { key: 'domains',   label: 'Domains',             actions: ['read', 'write', 'delete'] },
  { key: 'settings',  label: 'Workspace settings',  actions: ['read', 'write'] },

  // Split out from `members` deliberately: inviting someone and changing
  // someone's role are wildly different risk levels. Keeping them on separate
  // rows means the grid stays three columns wide instead of five.
  { key: 'members.role', label: 'Assign roles',     actions: ['write'] },
  { key: 'roles',        label: 'Roles',            actions: ['read', 'write', 'delete'] },

  // Transfer ownership, archive/restore, plan and billing.
  { key: 'ownership',    label: 'Ownership & billing', actions: ['write', 'delete'] },
] as const satisfies readonly ResourceDef[]

export type Resource = (typeof RESOURCES)[number]['key']

const BY_KEY = new Map<string, ResourceDef>(
  RESOURCES.map((r) => [r.key, r as ResourceDef])
)

export function getResource(key: string): ResourceDef | null {
  return BY_KEY.get(key) ?? null
}

/** True when the action is meaningful for the resource (see file header). */
export function resourceSupports(key: string, action: string): boolean {
  const resource = BY_KEY.get(key)
  return !!resource && (resource.actions as readonly string[]).includes(action)
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Roles Venzio owns. They are seeded into every workspace and can never be
 * edited or deleted - if an owner could untick `settings:write` on the owner
 * role they would permanently lock every human out of their own workspace.
 *
 * There is no `is_system` column: lockedness is derived from the key, and this
 * constant is the one place that decides it.
 */
export const SYSTEM_ROLE_KEYS = ['owner', 'admin', 'member'] as const
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number]

export function isSystemRole(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key)
}

/** How much of the workspace a role may see. `subtree` arrives with phase 3. */
export type Scope = 'all' | 'self'

export type PermissionGrid = Record<string, Action[]>

/**
 * The seeded grids for the three system roles.
 *
 * Admin is "owner minus the things that destroy data or take the workspace
 * away from you": no ownership/billing, and no assigning roles.
 *
 * Member is deliberately empty. Members live on /me and have no org-surface
 * access at all; deny-by-default is the correct answer, not an oversight.
 *
 * NOTE: scripts/migrate.js keeps its own copy of these grids because it is
 * CommonJS and cannot import TypeScript. If you change them here, change them
 * there too - `npm run lint:permissions` is not a thing, so nothing catches it
 * for you.
 */
export const SYSTEM_ROLE_GRIDS: Record<SystemRoleKey, PermissionGrid> = {
  owner: Object.fromEntries(
    RESOURCES.map((r) => [r.key, [...r.actions]])
  ) as PermissionGrid,

  admin: Object.fromEntries(
    RESOURCES
      .filter((r) => r.key !== 'ownership' && r.key !== 'members.role')
      .map((r) => [r.key, r.key === 'roles' ? ['read'] : [...r.actions]])
  ) as PermissionGrid,

  member: {},
}

export const SYSTEM_ROLE_NAMES: Record<SystemRoleKey, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}
