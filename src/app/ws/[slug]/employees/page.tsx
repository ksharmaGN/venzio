import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import EmployeesClient from './EmployeesClient'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * The HR directory.
 *
 * Gated on `employees:read`, not on holding a built-in role: a custom role with
 * that cell ticked belongs here, and one without it does not - regardless of
 * what it is called. Every capability the client renders is resolved HERE and
 * passed down as a plain boolean, so no client component ever asks the
 * permission system a question of its own. The API routes re-check all of it.
 */
export default async function EmployeesPage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Employees, Action.Read)) {
    redirect('/me')
  }

  return (
    <EmployeesClient
      slug={slug}
      canWrite={can(role.permissions, Resource.Employees, Action.Write)}
      canReadDocuments={can(role.permissions, Resource.Documents, Action.Read)}
      canWriteDocuments={can(role.permissions, Resource.Documents, Action.Write)}
      canReadMembers={can(role.permissions, Resource.Members, Action.Read)}
      canReadLeaves={can(role.permissions, Resource.Leaves, Action.Read)}
    />
  )
}
