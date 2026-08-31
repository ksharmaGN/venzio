import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import PeopleClient from './PeopleClient'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { en } from '@/locales/en'
import { wsPeopleUi } from '@/locales/en/ws-people'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Membership, not HR. Who is in the workspace, what they may do, and how they
 * leave. The employee RECORD - designation, bank details, documents - lives on
 * /ws/:slug/employees; these are two screens on purpose, because inviting
 * someone and holding their Aadhaar are different jobs with different risks.
 */
export default async function PeoplePage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Gate on the PERMISSION, not on holding a built-in role. A custom role with
  // members:read must reach this page - checking isWorkspaceAdmin here would
  // silently bounce every custom role no matter what its grid says.
  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Members, Action.Read)) {
    redirect('/me')
  }

  return (
    <div>
      <h1 className="t-h1">{en.wsPeople.pageTitle}</h1>
      <p className="t-secondary" style={{ margin: '4px 0 16px' }}>{wsPeopleUi.subtitle}</p>
      <PeopleClient slug={slug} viewerUserId={session.sub} />
    </div>
  )
}
