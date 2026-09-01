import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug, getActiveMemberIds } from './db/queries/workspaces'
import { getMembershipWithRole, roleFromMembership, type ResolvedRole } from './db/queries/roles'
import { can } from './permissions/can'
import { Scope, type Action, type Resource } from './permissions/catalogue'
import { loadReportingTree } from './db/queries/hierarchy'
import { subtreeOf } from './hierarchy'
// Resource / Action are enums, not loose strings: every call site names a
// catalogue entry the compiler has checked. See lib/permissions/catalogue.ts.
import type { Workspace } from './db/queries/workspaces'

export interface AccessContext {
  workspace: Workspace
  userId: string
  memberId: string
  role: ResolvedRole
  /**
   * Which members this viewer may see, decided by their role's scope.
   *
   * Every data query on the org surface must be filtered by this. It is
   * resolved once per request here rather than in each route, so a route cannot
   * forget to ask - the only way to reach the data is through this gate.
   */
  visibleMemberIds: string[]
}

/**
 * The single door to every workspace-admin route.
 *
 * Replaces requireWsAdmin's binary "is this person an admin?" with
 * "may this role perform this action on this resource?".
 *
 * Returns null on any failure - the caller turns that into a 403, exactly as
 * it did before. The returned object is a SUPERSET of the old AdminContext,
 * so existing `ctx.workspace` / `ctx.userId` destructuring keeps working.
 */
export async function requireWsAccess(
  request: NextRequest,
  slug: string,
  resource: Resource,
  action: Action,
): Promise<AccessContext | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) return null

  const membership = await getMembershipWithRole(workspace.id, userId)
  if (!membership || membership.status !== 'active') return null

  const role = roleFromMembership(membership)
  if (!can(role.permissions, resource, action)) return null

  return {
    workspace,
    userId,
    memberId: membership.member_id,
    role,
    visibleMemberIds: await resolveVisibleMemberIds(workspace.id, userId, role.scope),
  }
}

/**
 * Turn a role's scope into a concrete list of member ids.
 *
 * `All`     - every active member, which is what admins and owners get.
 * `Subtree` - the viewer plus everyone beneath them in the reporting tree.
 *             Unassigned members roll up to the owner, so the owner's subtree
 *             is everyone even before the tree is filled in.
 * `Self`    - just the viewer. In practice unreachable from a /ws route, since
 *             `Self` belongs to the seeded `member` role whose grid is empty,
 *             but it is handled rather than assumed away.
 */
export async function resolveVisibleMemberIds(
  workspaceId: string,
  userId: string,
  scope: Scope,
): Promise<string[]> {
  if (scope === Scope.Self) return [userId]
  if (scope === Scope.All) return getActiveMemberIds(workspaceId)

  const { tree } = await loadReportingTree(workspaceId)
  return subtreeOf(tree, userId)
}

/**
 * Resolve the caller's role without asserting a permission.
 *
 * For pages and routes that need to know WHO is asking in order to decide what
 * to render - the workspace layout, the People page - rather than to gate a
 * single action. Membership must still be active.
 */
export async function getWsRole(
  workspaceId: string,
  userId: string,
): Promise<ResolvedRole | null> {
  const membership = await getMembershipWithRole(workspaceId, userId)
  if (!membership || membership.status !== 'active') return null
  return roleFromMembership(membership)
}

/** The standard refusal, so every route returns an identical shape. */
export function forbidden() {
  return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
}
