import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import {
  getRoleById,
  updateWorkspaceRole,
  deleteWorkspaceRole,
} from '@/lib/db/queries/roles'
import { Scope, Action, Resource } from '@/lib/permissions/catalogue'
import { validateGridForSave, guardSystemRole } from '@/lib/permissions/guards'

interface Props { params: Promise<{ slug: string; id: string }> }

/**
 * Scope a CUSTOM role may be given.
 *
 * `Self` is excluded on purpose: it means "no org surface at all", so a custom
 * role holding it would show tabs its grid allows and no data behind them. It
 * stays reserved for the seeded `member` role.
 */
function parseSelectableScope(raw: unknown): Scope | null {
  return raw === Scope.All || raw === Scope.Subtree ? raw : null
}


/**
 * PUT /api/ws/[slug]/roles/[id]
 *
 * Replaces the role's whole grid in one atomic update. Deliberately not a
 * per-checkbox PATCH: a half-applied permission grid is a security state
 * nobody designed.
 */
export async function PUT(request: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Roles, Action.Write)
  if (!ctx) return forbidden()

  const role = await getRoleById(id, ctx.workspace.id)
  if (!role) {
    return NextResponse.json({ error: 'Role not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // owner/admin/member can never be edited.
  const systemFailure = guardSystemRole(role.key)
  if (systemFailure) {
    return NextResponse.json({ error: systemFailure.message, code: systemFailure.code }, { status: 409 })
  }

  let body: { name?: string; description?: string | null; permissions?: unknown; scope?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'A role name is required', code: 'INVALID_NAME' }, { status: 400 })
  }

  // Runs guardCatalogue then guardEscalation (see lib/permissions/guards.ts).
  const validation = validateGridForSave({
    actorPermissions: ctx.role.permissions,
    rawPermissions: body.permissions ?? {},
  })
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.failure.message, code: validation.failure.code },
      { status: validation.failure.code === 'ESCALATION' ? 403 : 400 },
    )
  }

  const description = body.description ?? null
  // Keep the role's existing scope when the body omits or misnames one, rather
  // than silently widening it to All.
  const scope = parseSelectableScope(body.scope) ?? role.scope

  // The key is NOT changed on rename - workspace_members.role points at it.
  await updateWorkspaceRole({
    roleId: role.id,
    workspaceId: ctx.workspace.id,
    name,
    description,
    permissions: validation.permissions,
    scope,
  })

  return NextResponse.json({
    role: {
      id: role.id,
      key: role.key,
      name,
      description,
      permissions: validation.permissions,
      scope,
      isSystem: false,
    },
  })
}

/**
 * DELETE /api/ws/[slug]/roles/[id]
 *
 * Soft delete. Everyone holding the role falls back to `member` in the same
 * transaction, so nobody is left pointing at a role that no longer exists.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Roles, Action.Delete)
  if (!ctx) return forbidden()

  const role = await getRoleById(id, ctx.workspace.id)
  if (!role) {
    return NextResponse.json({ error: 'Role not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const systemFailure = guardSystemRole(role.key)
  if (systemFailure) {
    return NextResponse.json({ error: systemFailure.message, code: systemFailure.code }, { status: 409 })
  }

  // Deleting the role you hold yourself would demote you mid-request.
  if (role.key === ctx.role.key) {
    return NextResponse.json(
      { error: 'You cannot delete the role you currently hold', code: 'SELF_ROLE_DELETE' },
      { status: 400 },
    )
  }

  const membersReassigned = await deleteWorkspaceRole({
    roleId: role.id,
    workspaceId: ctx.workspace.id,
    roleKey: role.key,
  })

  return NextResponse.json({ ok: true, membersReassigned })
}
