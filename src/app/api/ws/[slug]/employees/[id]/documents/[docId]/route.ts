import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  getDocument,
  setDocumentReview,
  updateDocumentMeta,
  deleteDocument,
} from '@/lib/db/queries/documents'
import { documentStore } from '@/lib/storage'

interface Props { params: Promise<{ slug: string; id: string; docId: string }> }

function notFound() {
  return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── PATCH /api/ws/[slug]/employees/[id]/documents/[docId] ────────────────────
// Body: { status: 'verified' | 'rejected', reject_reason? } and/or { name }
//
// The verification decision and the label are the only mutable parts of a
// document. Replacing the FILE is a POST to the collection, which re-uses the
// slot - so the bytes and the review state can never disagree about which
// upload was approved.

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id, docId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Write)
  if (!ctx) return forbidden()

  const existing = await getDocument(docId, ctx.workspace.id)
  // The employee id in the path is part of the resource identity, so a docId
  // that belongs to a different employee is a 404, not a silent success.
  if (!existing || existing.employee_id !== id) return notFound()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const hasStatus = 'status' in body
  const hasName = 'name' in body

  if (!hasStatus && !hasName) {
    return NextResponse.json(
      { error: 'At least one of status or name is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  let document = existing

  if (hasName) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json(
        { error: 'name must be a non-empty string', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    const updated = await updateDocumentMeta(docId, ctx.workspace.id, { name })
    if (!updated) return notFound()
    document = updated
  }

  if (hasStatus) {
    // Only the two review verdicts are settable here. 'missing', 'pending' and
    // 'issued' are consequences of upload, not decisions an admin makes.
    if (body.status !== 'verified' && body.status !== 'rejected') {
      return NextResponse.json(
        { error: 'status must be "verified" or "rejected"', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }

    if (!existing.file_name) {
      return NextResponse.json(
        { error: 'Cannot review a document with no file', code: 'NO_FILE' },
        { status: 409 },
      )
    }

    const rejectReason =
      body.status === 'rejected'
        ? typeof body.reject_reason === 'string' ? body.reject_reason.trim() : ''
        : null

    if (body.status === 'rejected' && !rejectReason) {
      return NextResponse.json(
        { error: 'reject_reason is required when rejecting', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }

    const updated = await setDocumentReview(docId, ctx.workspace.id, {
      status: body.status,
      reject_reason: rejectReason,
      verifiedBy: ctx.userId,
    })
    if (!updated) return notFound()
    document = updated
  }

  return NextResponse.json({ document })
}

// ─── DELETE /api/ws/[slug]/employees/[id]/documents/[docId] ───────────────────
// Soft-deletes the metadata, then hard-deletes the bytes through the storage
// seam - the only thing that knows where bytes actually live. In that order:
// once the row is soft-deleted nothing can serve the file (getDocumentBlob
// filters deleted_at), so a failed byte delete leaves unreachable orphans
// rather than a live row with a shredded file.

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id, docId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Delete)
  if (!ctx) return forbidden()

  const existing = await getDocument(docId, ctx.workspace.id)
  if (!existing || existing.employee_id !== id) return notFound()

  const deleted = await deleteDocument(docId, ctx.workspace.id)
  if (!deleted) return notFound()

  await documentStore.delete(ctx.workspace.id, docId)

  return NextResponse.json({ success: true })
}
