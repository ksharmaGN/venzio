import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  listHolidays,
  createHoliday,
  findHolidayByNameAndDate,
  bulkUpsertHolidays,
} from '@/lib/db/queries/holidays'
import type { HolidayImportRow } from '@/lib/db/queries/holidays'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/holidays ───────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  console.log("get_holidays")
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : undefined

  const holidays = await listHolidays(ctx.workspace.id, year)
  return NextResponse.json({ holidays })
}

// ─── POST /api/ws/[slug]/holidays ─────────────────────────────────────────────
// JSON body  → create single holiday
// multipart  → bulk import (CSV / XLSX)

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return handleCreate(req, ctx.workspace.id, ctx.userId)
  }

  return handleImport(req, ctx.workspace.id, ctx.userId)
}

// ─── Single-holiday create ─────────────────────────────────────────────────────

async function handleCreate(req: NextRequest, workspaceId: string, userId: string) {
  let body: { name?: unknown; date?: unknown; description?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''

  if (!name || !date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: 'name (string) and date (YYYY-MM-DD) are required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const description =
    body.description === null ? null
    : typeof body.description === 'string' ? body.description.trim() || null
    : undefined

  const duplicate = await findHolidayByNameAndDate(workspaceId, name, date)
  if (duplicate) {
    return NextResponse.json(
      { error: 'A holiday with this name and date already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  const holiday = await createHoliday({
    workspaceId,
    name,
    date,
    description: description ?? undefined,
    createdBy: userId,
  })

  return NextResponse.json({ holiday }, { status: 201 })
}

// ─── Bulk file import ──────────────────────────────────────────────────────────

async function handleImport(req: NextRequest, workspaceId: string, userId: string) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data', code: 'INVALID_BODY' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided', code: 'MISSING_FILE' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx' && ext !== 'csv') {
    return NextResponse.json(
      { error: 'Only .xlsx and .csv files are supported', code: 'INVALID_FILE_TYPE' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2 MB limit', code: 'FILE_TOO_LARGE' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let rawRows: Record<string, unknown>[]
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) {
      return NextResponse.json({ error: 'File has no sheets', code: 'EMPTY_FILE' }, { status: 422 })
    }
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  } catch {
    return NextResponse.json({ error: 'Could not parse file', code: 'PARSE_ERROR' }, { status: 422 })
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'File contains no data rows', code: 'EMPTY_FILE' }, { status: 422 })
  }

  const valid: HolidayImportRow[] = []
  const errors: { row: number; reason: string }[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // row 1 is header
    const raw = normalizeKeys(rawRows[i])

    const name = typeof raw.name === 'string' ? raw.name.trim() : null
    if (!name) {
      errors.push({ row: rowNum, reason: 'Missing or empty "name"' })
      continue
    }

    const dateStr = parseDate(raw.date)
    if (!dateStr) {
      errors.push({ row: rowNum, reason: 'Invalid or missing "date" — expected YYYY-MM-DD' })
      continue
    }

    const description = nullableString(raw.description)
    valid.push({ name, date: dateStr, description })
  }

  const result = await bulkUpsertHolidays(workspaceId, userId, valid)

  return NextResponse.json({ inserted: result.inserted, updated: result.updated, errors })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase().trim(), v]))
}

function nullableString(value: unknown): string | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  return s || null
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return null
  }
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (!parsed) return null
      const m = String(parsed.m).padStart(2, '0')
      const d = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${m}-${d}`
    } catch {
      return null
    }
  }
  return null
}
