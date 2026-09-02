import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getEmployee } from '@/lib/db/queries/employees'
import NewEmployeeClient from './NewEmployeeClient'

interface Props {
  params: Promise<{ slug: string }>
  /** `?draft=<employee id>` - an add that has already saved at least one step. */
  searchParams: Promise<{ draft?: string }>
}

/**
 * Add an employee, then offer to invite them.
 *
 * A route rather than a view flag on the directory, so it is deep-linkable and
 * a half-filled wizard survives a back button. It replaces the old inline
 * "invite someone" email box on the People screen: an email address on its own
 * was never enough to run payroll, holidays or documents against, and it left
 * every new joiner as a row nobody had filled in.
 */
export default async function NewEmployeePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { draft: draftId } = await searchParams

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Employees, Action.Write)) {
    redirect('/me')
  }

  // Inviting is a separate permission from creating the record - a role may be
  // trusted to keep HR data without being trusted to hand out workspace access.
  // The modal is simply not offered when they lack it.
  const canInvite = can(role.permissions, Resource.Members, Action.Write)

  // Resume an in-progress add. Loaded on the server so a refresh paints the
  // filled form on first render - a client fetch would flash an empty wizard,
  // which is the very thing this is here to stop looking like.
  //
  // `getEmployee` is scoped by workspace id, so a `?draft=` pointing at another
  // workspace's record resolves to null and the wizard simply starts fresh
  // rather than leaking a row across the tenant boundary.
  const draft = draftId ? await getEmployee(draftId, workspace.id) : null

  return <NewEmployeeClient slug={slug} canInvite={canInvite} draft={draft} />
}
