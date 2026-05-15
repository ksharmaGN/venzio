import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug, getWorkspaceMember } from '@/lib/db/queries/workspaces'
import { getUserLeaveRequests } from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const member = await getWorkspaceMember(workspace.id, userId)
  if (!member || member.status !== 'active') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const leaveRequests = await getUserLeaveRequests(workspace.id, userId)
  return NextResponse.json({ leaveRequests })
}
