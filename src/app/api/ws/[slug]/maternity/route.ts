import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getEmployee } from '@/lib/db/queries/employees'
import {
  listMaternityCases,
  createMaternityCase,
  findOpenCaseForEmployee,
  isMaternityStatus,
  MaternityCaseOpenError,
} from '@/lib/db/queries/maternity'
import { maternity as maternityCopy } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Maternity is filed under the Leaves resource rather than getting one of its
 * own. It is leave administration by any reading, and a workspace that has
 * given someone leave:write has already decided they handle absence.
 */
const RESOURCE = Resource.Leaves

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return undefined
  return value.trim()
}

// ─── GET /api/ws/[slug]/maternity ─────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Read)
  if (!ctx) return forbidden()

  const sp = req.nextUrl.searchParams
  const statusParam = sp.get('status')
  const status = isMaternityStatus(statusParam) ? statusParam : undefined
  const employeeId = sp.get('employee_id') ?? undefined

  const cases = await listMaternityCases(ctx.workspace.id, { status, employeeId })
  return NextResponse.json({ cases })
}

// ─── POST /api/ws/[slug]/maternity ────────────────────────────────────────────
// Body: { employee_id, due_date?, start_date?, end_date?, weeks?, notes? }

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Write)
  if (!ctx) return forbidden()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
  if (!employeeId) {
    return NextResponse.json(
      { error: 'employee_id is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  // Resolved against this workspace: the id came from the client.
  const employee = await getEmployee(employeeId, ctx.workspace.id)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }, { status: 404 })
  }

  const fields: Record<string, string> = {}
  const dueDate = parseDate(body.due_date)
  const startDate = parseDate(body.start_date)
  const endDate = parseDate(body.end_date)
  if (dueDate === undefined && body.due_date !== undefined) fields.due_date = 'INVALID'
  if (startDate === undefined && body.start_date !== undefined) fields.start_date = 'INVALID'
  if (endDate === undefined && body.end_date !== undefined) fields.end_date = 'INVALID'

  let weeks: number | undefined
  if (body.weeks !== undefined && body.weeks !== null) {
    const num = typeof body.weeks === 'number' ? body.weeks : Number(body.weeks)
    if (!Number.isInteger(num) || num <= 0 || num > 104) fields.weeks = 'INVALID'
    else weeks = num
  }

  if (startDate && endDate && endDate < startDate) fields.end_date = 'BEFORE_START'

  if (Object.keys(fields).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 422 },
    )
  }

  // One running case per employee. Closed ('returned') cases are history and
  // do not block a later pregnancy.
  //
  // This read is a courtesy - it turns the common case into a clean 409 with
  // no failed INSERT behind it. The GUARANTEE is the partial unique index
  // idx_maternity_cases_one_open, because this check and the insert below are
  // two statements and two simultaneous requests can both pass it.
  const open = await findOpenCaseForEmployee(ctx.workspace.id, employeeId)
  if (open) {
    return NextResponse.json(
      { error: maternityCopy.errors.caseOpen, code: 'CASE_OPEN' },
      { status: 409 },
    )
  }

  let maternityCase
  try {
    maternityCase = await createMaternityCase({
      workspaceId: ctx.workspace.id,
      employeeId,
      due_date: dueDate ?? null,
      start_date: startDate ?? null,
      end_date: endDate ?? null,
      weeks,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    })
  } catch (err) {
    // Lost the race against a concurrent POST. Same answer as the pre-check
    // above - the caller does not need to know it was a photo finish.
    if (err instanceof MaternityCaseOpenError) {
      return NextResponse.json(
        { error: maternityCopy.errors.caseOpen, code: 'CASE_OPEN' },
        { status: 409 },
      )
    }
    throw err
  }

  return NextResponse.json({ case: maternityCase }, { status: 201 })
}
