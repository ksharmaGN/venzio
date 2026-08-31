# Known gaps and traps

A register of findings that are **knowingly deferred**, not forgotten. Produced by
two review passes (correctness + interaction) over the `feat/revamp` branch on
2026-09-01. P0 and P1 correctness findings from those passes were fixed on the
branch; everything here was deferred by an explicit decision.

Revisit condition: before the next feature round on `/me` or the employee modules,
or immediately if any item below is reported by a real user.

### Accepted risk — user decision, do not "fix" without asking

**`user_id` is assignable via the employee write payload.** `employees/route.ts:127`
and `[id]/route.ts:154` both `pick(body, 'user_id')`; `_validate.ts` never mentions
it; `idx_employees_user` is **non-unique**; `findEmployeeByUserId` is `LIMIT 1` with
no `ORDER BY`. So a holder of `employees:write` can point an employee record at
another member's user id, and that member's `/me` then serves them someone else's
**decrypted PAN / Aadhaar / bank account** plus their document folder. The likelier
accident is two rows sharing a `user_id`, making which record a member sees
non-deterministic.

Accepted on the basis that `employees:write` is already a high-trust permission.
Sits alongside the existing accepted risk that any `employees:read` holder gets
fully decrypted PII (`docs/architecture/employee-records.md:178-213`).

### P2 races — deferred

| Finding | Where |
|---|---|
| Workspace A's documents paint under workspace B; `busyKey` is one slot for N uploads | `me/documents/DocumentsScreen.tsx:191-219` |
| `save()` can adopt workspace A's employee record into B; lost-update on concurrent edits | `me/profile/ProfileScreen.tsx:274-327` |
| Filter refetch races; `loadMore` appends unfiltered rows; detail fetch has no catch → permanent skeleton | `ws/[slug]/employees/EmployeesClient.tsx` |
| Accepting an invite never shows the workspace (`activeList` never re-syncs after `router.refresh()`) | `me/orgs/OrgsClient.tsx:23-24,61-76` |
| Navigating away from a `?ws=` deep link silently swaps workspace (`initialSlug` is fixed at first layout render) | `me/workspace-scope.tsx:92-98` |
| `/me` home filters "today" on the **UTC** date while everything else uses workspace tz — evening check-ins vanish in UTC− zones | `me/page.tsx:52,173-176` |
| 30s poll has no ordering guard; failed `/overview` leaves a permanent skeleton | `ws/[slug]/attendance/AttendanceClient.tsx:73-100` |
| Enter key bypasses the submit guard → duplicate domain / duplicate leave type | `DomainsTab.tsx:198`, `LeaveTypesSection.tsx:144` |
| Approve stays clickable during a Decline → both PATCH, employee gets the rejection push | `leaves/LeaveRequestsTab.tsx:97` |
| Loading states stick forever on a rejected fetch | `LeaveTypesSection`, `SignalsTab`, `OpeningBalancesSection`, `DomainsTab:80-93` |
| Failures reported as successes (413 renders as green "0 imported"; year-step shows wrong year's rows) | `OpeningBalancesSection:124-146`, `HolidaysClient:43-54`, `LeaveScreen:543`, `RosterScreen:119` |

### Validation gaps — found while fixing, not fixed

`confirmation_date` and `probation_end_date` have **no server-side validation at
all** in `src/app/api/ws/[slug]/employees/_validate.ts`, despite being date fields
the wizard collects and validates client-side. Adding it would newly reject
payloads that are accepted today, so it was left. Any API client can currently
store arbitrary strings in both columns.

### Cosmetic follow-ups from the P0/P1 fix round

- `ApprovalsClient.tsx` still renders the **"Documents" filter tab** for a viewer without `documents:read`; it will simply be empty. No data is exposed (the items are never fetched), but the tab is pointless for that role.
- `wsEmployees.documentByCompany` / `documentByEmployee` in `src/locales/en/ws-people.ts` are now unused, superseded by `documents.owner.*`.

### Consistency gaps found during the docs re-sync

- **The `/ws` pill swatch does not match the `/me` pill** for the same workspace. `WsLayoutClient.tsx` paints a flat `var(--brand)` with the first initial; `/me` uses `swatchColor()` seeded on the workspace id. A user who recognises a workspace by colour on mobile gets a different colour on the admin surface.
- **`AVATAR_COLORS` is duplicated inline** in `PeopleClient.tsx:56` and `EmployeesClient.tsx:34` — the same hash with a different palette, i.e. exactly the duplication `src/lib/workspace-color.ts` was extracted to prevent. (Deliberately a *different* palette: that one colours people, not workspaces. The duplication is the issue, not the separation.)
- **The sole-admin leave refusal** (`DELETE /api/me/workspaces/[workspaceId]`, `409 SOLE_ADMIN`) returns a hardcoded English string that is not in `src/locales/en.ts` and does not name the workspace.

### P3 — dead code

`AccessContext.visibleMemberIds` is read by nothing, yet `getActiveMemberIds()` runs
on **every `requireWsAccess` call** i.e. every workspace API request. Unreferenced:
`getRemindersSentOn`, `listAssetsForEmployee`, `getPendingDocumentCount`,
`softDeleteEmployee`. Attendance page gates `dashboard:read` but fetches an
`approvals:read` endpoint → silent 403 panel. Raw `db.query()` in
`api/me/ws/[slug]/counts/route.ts:17` violates CLAUDE.md principle #1.

### Interaction pass — 24 findings, deferred

Headline: `.page-enter` (380ms) wraps every route and `.fx-spring` (480ms) + stagger
fire *inside* it, so one `/ws` sidebar click costs **~740ms of compounding nested
motion** on a 100+/day action. Real bugs in that set: `Toast` has no `key` so a
second toast never replays its animation; `.ci-fade-target`/`.ci-fade-in` are
hardcoded together so the check-in crossfade is dead code; `.progress > div`
animates on mount but snaps on every subsequent change. Nothing has an exit
animation. Full table in the round-2 review output.

### Pre-existing landmine the new code leans on

`src/lib/db/index.ts:58-68` — the **local SQLite** `transaction()` wraps an awaited
async callback in raw `BEGIN`/`COMMIT` on one shared connection, so two overlapping
`db.transaction()` calls interleave and one can commit or roll back the other's
writes. Turso's path is correct, so this is dev-only — but `createEmployee`,
`archiveEmployee`, `restoreEmployee`, `deleteDocument` and `insertDocumentBlob` are
all new transaction users, so dev hits it far more often now.

---
