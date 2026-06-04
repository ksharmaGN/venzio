import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceMemberByEmail } from '@/lib/db/queries/workspaces'
import { getWorkspaceLeaveTypes, setLeaveBalanceAdjustment, nextQuarterStart } from '@/lib/db/queries/leaves'

const MAX_FILE_BYTES = 2 * 1024 * 1024

interface Props { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

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
  if (ext !== 'csv') {
    return NextResponse.json({ error: 'Only .csv files are supported', code: 'INVALID_FILE_TYPE' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2 MB limit', code: 'FILE_TOO_LARGE' }, { status: 413 })
  }

  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
  const workbook = new ExcelJS.Workbook()
  try {
    const stream = new Readable({ read() {} })
    stream.push(buffer)
    stream.push(null)
    await workbook.csv.read(stream)
  } catch {
    return NextResponse.json({ error: 'Could not parse CSV', code: 'PARSE_ERROR' }, { status: 422 })
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return NextResponse.json({ error: 'File has no data', code: 'EMPTY_FILE' }, { status: 422 })
  }

  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? '').toLowerCase().trim())
  })

  const rawRows: Record<string, unknown>[] = []
  sheet.eachRow((_row, rowNumber) => {
    if (rowNumber === 1) return
    const row = sheet.getRow(rowNumber)
    const obj: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      const v = row.getCell(idx + 1).value
      obj[header] = v instanceof Date ? v : v
    })
    rawRows.push(obj)
  })

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'File contains no data rows', code: 'EMPTY_FILE' }, { status: 422 })
  }

  const leaveTypes = await getWorkspaceLeaveTypes(ctx.workspace.id)
  const leaveTypeMap = new Map(leaveTypes.map((t) => [t.name.toLowerCase(), t]))
  const effectiveDate = nextQuarterStart()

  let imported = 0
  const errors: { row: number; email: string; leave_type: string; error: string }[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2
    const raw = rawRows[i]

    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      errors.push({ row: rowNum, email: String(raw.email ?? ''), leave_type: String(raw.leave_type ?? ''), error: 'INVALID_EMAIL' })
      continue
    }

    const leaveTypeName = typeof raw.leave_type === 'string' ? raw.leave_type.trim() : ''
    if (!leaveTypeName) {
      errors.push({ row: rowNum, email, leave_type: '', error: 'LEAVE_TYPE_NOT_FOUND' })
      continue
    }

    const leaveType = leaveTypeMap.get(leaveTypeName.toLowerCase())
    if (!leaveType) {
      errors.push({ row: rowNum, email, leave_type: leaveTypeName, error: 'LEAVE_TYPE_NOT_FOUND' })
      continue
    }

    const rawBalance = raw.balance_days
    const balanceDays = typeof rawBalance === 'number' ? rawBalance : parseFloat(String(rawBalance ?? ''))
    if (isNaN(balanceDays) || balanceDays < 0) {
      errors.push({ row: rowNum, email, leave_type: leaveTypeName, error: 'INVALID_BALANCE' })
      continue
    }

    const member = await getWorkspaceMemberByEmail(ctx.workspace.id, email)
    if (!member || !member.user_id || member.status !== 'active') {
      errors.push({ row: rowNum, email, leave_type: leaveTypeName, error: 'MEMBER_NOT_FOUND' })
      continue
    }

    await setLeaveBalanceAdjustment({
      workspaceId: ctx.workspace.id,
      userId: member.user_id,
      leaveTypeId: leaveType.id,
      balanceDays,
      effectiveDate,
      createdBy: ctx.userId,
    })
    imported++
  }

  return NextResponse.json({ imported, errors }, { status: 200 })
}
