import { isSystemRole } from './catalogue'

/**
 * Role ranking - the SUBJECT axis of permissions.
 *
 * `can()` answers "may this role touch this kind of thing?". Ranking answers
 * "may this person act on THAT person?". Both are needed on the same action:
 * an admin holds `members:delete`, but must still not be able to remove the
 * owner or another admin.
 */

export const ROLE_RANK = {
  owner: 100,
  admin: 50,
  member: 10,
} as const

/**
 * Custom roles (phase 2) sit above member and below admin. They can therefore
 * never manage an admin or an owner regardless of which permission boxes are
 * ticked, which keeps the escalation ceiling fixed in code rather than in data.
 */
export const CUSTOM_ROLE_RANK = 20

export function rankOf(roleKey: string | null | undefined): number {
  if (!roleKey) return 0
  if (isSystemRole(roleKey)) return ROLE_RANK[roleKey]
  return CUSTOM_ROLE_RANK
}

/**
 * May the actor remove, demote or re-role the target?
 *
 * Strictly lower rank - equal ranks cannot manage each other, so one admin can
 * never remove another admin.
 */
export function canManage(
  actorRoleKey: string | null | undefined,
  targetRoleKey: string | null | undefined
): boolean {
  return rankOf(actorRoleKey) > rankOf(targetRoleKey)
}

/**
 * May the actor GRANT this role to someone?
 *
 * Checked in addition to canManage(actor, target). Without it an admin could
 * promote a colleague to owner and be promoted straight back - the target is
 * below them, but the role being handed out is not.
 */
export function canGrant(
  actorRoleKey: string | null | undefined,
  grantedRoleKey: string | null | undefined
): boolean {
  return rankOf(actorRoleKey) > rankOf(grantedRoleKey)
}

/**
 * "Admin or better" - owner and admin both run the workspace.
 *
 * Every place that used to compare `role === 'admin'` must use this instead.
 * Once the owner backfill renames a creator's role to 'owner', a bare
 * equality check against 'admin' silently stops matching them and locks the
 * owner out of their own org surface.
 */
export function isWorkspaceAdmin(roleKey: string | null | undefined): boolean {
  return roleKey === 'owner' || roleKey === 'admin'
}

/** Exactly the owner - for destructive and ownership-level actions only. */
export function isWorkspaceOwner(roleKey: string | null | undefined): boolean {
  return roleKey === 'owner'
}

/** Roles the actor is allowed to assign - drives the People page dropdown. */
export function assignableRoleKeys(
  actorRoleKey: string | null | undefined,
  allRoleKeys: string[]
): string[] {
  return allRoleKeys.filter((key) => canGrant(actorRoleKey, key))
}

/**
 * Where a user lands after signing in or registering.
 *
 * Keyed on which workspaces grant ORG-SURFACE ACCESS, not on holding the admin
 * role. A custom role with an entirely empty grid is legal, and that person
 * must land on /me rather than a stripped /ws shell with no navigation.
 *
 * Previously duplicated verbatim in the login and register routes.
 */
export function getRedirectAfterLogin(orgWorkspaces: { slug: string }[]): string {
  if (orgWorkspaces.length === 0) return '/me'
  if (orgWorkspaces.length === 1) return `/ws/${orgWorkspaces[0].slug}`
  return '/ws'
}
