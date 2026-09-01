import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import {
  getWorkspaceBySlug,
  getActiveMemberWithDetails,
} from '@/lib/db/queries/workspaces'
import { findEmployeeByUserId } from '@/lib/db/queries/employees'
import DetailsClient from './DetailsClient'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { loadReportingTree } from '@/lib/db/queries/hierarchy'
import { subtreeOf } from '@/lib/hierarchy'

interface Props {
  params: Promise<{ slug: string; userId: string }>
}

export default async function EmployeeDetailsPage({ params }: Props) {
  const { slug, userId } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // This page shows and edits an employee record, so it is gated on the
  // employees resource rather than on holding a built-in role.
  const viewerRole = await getWsRole(workspace.id, session.sub)
  if (!viewerRole || !can(viewerRole.permissions, Resource.Employees, Action.Read)) {
    redirect('/me')
  }

  const member = await getActiveMemberWithDetails(workspace.id, userId)
  if (!member) notFound()

  const employee = await findEmployeeByUserId(workspace.id, userId)

  // Reporting-manager options.
  //
  // Anyone in this person's own subtree is excluded, because picking them would
  // close a loop - their manager would end up reporting to them. Computed on
  // the server so the tree never has to ship to the browser; PATCH /hierarchy
  // re-checks with wouldCreateCycle regardless, since a hidden option is still
  // a craftable request.
  const { tree, members: hierarchyMembers } = await loadReportingTree(workspace.id)
  const ownSubtree = new Set(subtreeOf(tree, userId))
  const canEditHierarchy = can(viewerRole.permissions, Resource.Hierarchy, Action.Write)

  const managerOptions = hierarchyMembers
    .filter((m) => !ownSubtree.has(m.user_id))
    .map((m) => ({
      userId: m.user_id,
      name: m.full_name ?? m.email,
      email: m.email,
    }))

  const currentManagerUserId =
    hierarchyMembers.find((m) => m.user_id === userId)?.manager_user_id ?? null

  return (
    <DetailsClient
      slug={slug}
      member={member}
      employee={employee}
      managerOptions={managerOptions}
      currentManagerUserId={currentManagerUserId}
      canEditHierarchy={canEditHierarchy}
    />
  )
}
