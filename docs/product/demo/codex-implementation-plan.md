# Codex Implementation Plan — Building the Pitch Demo's UX Into the Real App

**Source of truth for intent:** `docs/product/demo/venzio-pitch-demo.html` (single-file mock, no backend) is the validated UX reference — every screen, animation, and interaction pattern it now contains has been reviewed and approved as the direction to build. This document translates that demo into real changes across the actual Next.js app (`src/`), against the real DB (`scripts/migrate.js`), following every non-negotiable in the root `CLAUDE.md` (query-layer isolation, `requireWsAdmin()`, no raw SQL in routes, soft deletes, immutable events, etc).

**Read this first:** not every demo change requires new backend work. The table below sorts the 13 source items into three buckets so Codex doesn't rebuild what already exists.

| Bucket | Items | What it means |
|---|---|---|
| **A — Frontend-only, real APIs already sufficient** | Monthly Activity view (CONFIRMED already built, see A1), Overview line graph (CONFIRMED already built, see A1b), member-list search/pagination (REAL GAP, see A1c), check-in flicker audit, employee home summary, leave IA tabs, dashboard card-height fix | No migration, no new route. Verify current behavior against the spec below, then adjust components/queries-already-available. |
| **B — Frontend feature, existing data, no schema change** | Workspace switcher, timeline pagination/filter | New UI composing data that already exists; timeline needs one small API parameter addition (date-range), not a new table. |
| **C — New backend + frontend** | Owner/Admin/Member roles, employee documents, regularization requests | Needs a migration, new query functions, new API routes, and new UI on both `/me` and `/ws` surfaces. |

**Update log:** a follow-up round of stakeholder feedback on the demo (Gantt-style Monthly Activity, an Overview line graph, workspace-switcher data isolation, and capped/searchable member lists) prompted a direct read of `MonthlyClient.tsx` and `TodayClient.tsx` to check these against reality — see A1/A1b/A1c above for what that confirmed. The demo itself was updated to match; this doc was updated to record what that research found, since two items turned out to already be fully shipped (no work needed) and one turned out to be a real, previously-undocumented gap in the live product.

Work bucket A and B in any order (they're independent). Do bucket C in the sequence given in "Implementation Order" — the role model underpins permission checks the other two buckets C items need.

---

## Bucket A — Frontend-only

### A1. Monthly Activity view — CONFIRMED already fully built, no work needed
**Update (post-stakeholder-review):** this item is resolved. `src/app/ws/[slug]/monthly/MonthlyClient.tsx` (behind the sidebar's "Activity" nav item) already renders exactly the Gantt/heatmap grid this task originally called for — rows per employee, one colored cell per day (`office`/`remote`/`absent`/`leave`/`holiday`/`weekend`/pre-join, via `dayColor()`/`dayBorder()`), a legend, month navigation gated by the plan's `historyMonths`, and an XLSX export (`src/app/api/ws/[slug]/export/route.ts`, `?year&month` mode) with a two-sheet workbook (data + legend). Data comes from `summarizeAttendanceDays()` in `attendance-summary.ts` joined with holidays/leave, exactly as this task originally specified. **No action required** — the earlier "confirm which nav item renders this" uncertainty in this doc has been resolved by direct source inspection; there is nothing left to build here. (The pitch demo's Monthly Activity tab was rebuilt to visually mirror this real page, replacing an earlier numbers-only version — the demo now follows the product, not the other way around.)

### A1b. Overview dashboard line graph — CONFIRMED already fully built, no work needed
Also resolved during the same review: the admin Overview dashboard (`TodayClient.tsx`) already has an `OfficePresenceGraph` — an hourly SVG line/area chart with a smooth bezier curve and hover crosshair/tooltip, refetched every 10s from `GET /api/ws/[slug]/insights?interval=today`. The pitch demo's Overview tab was missing this and has been updated to add an equivalent (fake hourly data, same curve-smoothing algorithm) purely for demo completeness. **No real-app work needed.**

### A1c. Member-list search + pagination — REAL GAP, not yet built
**This one is a genuine gap**, found while auditing `MembersModal` (`TodayClient.tsx:140-292`, opened by clicking a dashboard stat card) against the pitch demo's newly-added member-list modal. The real `MembersModal` renders the *entire* `members` array at once inside a scrollable `<div>` (`maxHeight:'600px', overflowY:'auto'`) — **no search input, no pagination of any kind**. For a workspace with hundreds of employees, this is the same "which cards are in the office today" needle-in-a-haystack problem the stakeholder raised about the demo, except it's live in the shipped product today, not just a demo gap.
- **UI:** add a search input (name/email substring match, client-side is fine since `members` is already fully fetched) to the top of `MembersModal`, and cap the initial render to a small page size (e.g. 20) with a "Load more" button — mirroring the demo's `openMemberModal()`/`filterMemberModal()`/`loadMoreMemberModal()` pattern (`docs/product/demo/venzio-pitch-demo.html`).
- **No API change** — `DashboardResponse.counts`/`all_members` already returns the full member list to the client; this is a pure component-level fix.
- **Acceptance criteria:** opening any stat card's modal for a workspace with 50+ members shows the first page immediately with no perceptible lag; typing in the search box narrows the visible list without an API round-trip; "Load more" reveals additional members without losing the current search term.

### A2. Check-in animation audit
**Real-app reality:** the demo's flicker bug was a symptom of its own `innerHTML`-replace renderer replaying CSS `animation` keyframes on every tick — a real React app with proper component boundaries and stable `key`s shouldn't have this specific failure mode. This is an **audit task**, not an assumed bug fix:
- Find the client component driving check-in state transitions (idle → acquiring-gps → acquiring-network → done) on `/me`.
- Confirm each state transition updates local component state (not a full page remount) and that entrance animations are applied via a `transition` on a class toggle (or a Framer-Motion `AnimatePresence`/layout animation) scoped to the status card only — not a CSS `animation` re-triggered by the whole card tree remounting.
- If an existing flicker is found, the fix is the same principle used in the demo: isolate the animated region so sibling content (header, stats, "This week" chart) never unmounts on a substate change.
- **Acceptance criteria:** recording a check-in end-to-end shows a single continuous transition per state change, with zero visible re-pop of unrelated page content.

### A3. Employee home summary
- **UI:** add a 4-tile row (WFO days / WFH days / Leave taken / Leave remaining) to the `/me` home screen, above or below the check-in card, sized like the existing 3-tile grid pattern already used on the workspace roster screen.
- **Data source:** `attendance-summary.ts` for WFO/WFH/leave day counts (current month, current workspace context), `getLeaveTypesWithBalance()` for leave remaining (sum of `available_days` across active leave types).
- **Acceptance criteria:** figures match what an admin sees for the same employee on the Monthly Activity view (A1) for the same month — the two must never disagree, since they read the same underlying classifier.

### A4. Leave information architecture
- **UI:** restructure the existing `/me/ws/[slug]` leave accordion (office/remote/leave/onLeave/holidays/myLeaves tabs) into four clearer top-level tabs: **Balance**, **Apply**, **History**, **Holidays** — mirroring the demo's `.tabbar` pattern. Merge overlapping concepts: "Balance" = leave-type cards, "Apply" = the request form, "History" = the full request list (all statuses, no truncation) + (after Bucket C's regularization work lands) "Your correction requests," "Holidays" = the full holiday list.
- **No API change** — same `GET /api/me/ws/[slug]/leave-types` and `POST /api/me/ws/[slug]/leave` endpoints, same `leave_requests` pending→approved/rejected lifecycle (already correctly documented in root CLAUDE.md after this pass's correction).
- **Acceptance criteria:** every field/action currently reachable in the accordion remains reachable in the new tabs; no regression in the existing "Leave workspace" (unenroll) action, which is a distinct concept from leave-of-absence and must stay clearly separated (its own row, not inside any of the 4 new tabs).

### A5. Overview dashboard card-height fix
- **UI:** on `TodayClient.tsx` (or wherever the admin Overview's stat-card grid lives), cap any card whose content length varies (a pending-approvals list, a department breakdown) to a fixed height with internal scroll — same pattern as the demo's `.card-fixed-h`/`.scroll-body` (`display:flex;flex-direction:column;min-height:...;max-height:...` + `flex:1;overflow-y:auto` on the inner list).
- **Acceptance criteria:** adding synthetic long content to any one card in a row does not change the height of its row siblings; verified at both desktop and the app's existing mobile breakpoint.

### A2. Check-in animation audit
**Real-app reality:** the demo's flicker bug was a symptom of its own `innerHTML`-replace renderer replaying CSS `animation` keyframes on every tick — a real React app with proper component boundaries and stable `key`s shouldn't have this specific failure mode. This is an **audit task**, not an assumed bug fix:
- Find the client component driving check-in state transitions (idle → acquiring-gps → acquiring-network → done) on `/me`.
- Confirm each state transition updates local component state (not a full page remount) and that entrance animations are applied via a `transition` on a class toggle (or a Framer-Motion `AnimatePresence`/layout animation) scoped to the status card only — not a CSS `animation` re-triggered by the whole card tree remounting.
- If an existing flicker is found, the fix is the same principle used in the demo: isolate the animated region so sibling content (header, stats, "This week" chart) never unmounts on a substate change.
- **Acceptance criteria:** recording a check-in end-to-end shows a single continuous transition per state change, with zero visible re-pop of unrelated page content.

### A3. Employee home summary
- **UI:** add a 4-tile row (WFO days / WFH days / Leave taken / Leave remaining) to the `/me` home screen, above or below the check-in card, sized like the existing 3-tile grid pattern already used on the workspace roster screen.
- **Data source:** `attendance-summary.ts` for WFO/WFH/leave day counts (current month, current workspace context), `getLeaveTypesWithBalance()` for leave remaining (sum of `available_days` across active leave types).
- **Acceptance criteria:** figures match what an admin sees for the same employee on the Monthly Activity view (A1) for the same month — the two must never disagree, since they read the same underlying classifier.

### A4. Leave information architecture
- **UI:** restructure the existing `/me/ws/[slug]` leave accordion (office/remote/leave/onLeave/holidays/myLeaves tabs) into four clearer top-level tabs: **Balance**, **Apply**, **History**, **Holidays** — mirroring the demo's `.tabbar` pattern. Merge overlapping concepts: "Balance" = leave-type cards, "Apply" = the request form, "History" = the full request list (all statuses, no truncation) + (after Bucket C's regularization work lands) "Your correction requests," "Holidays" = the full holiday list.
- **No API change** — same `GET /api/me/ws/[slug]/leave-types` and `POST /api/me/ws/[slug]/leave` endpoints, same `leave_requests` pending→approved/rejected lifecycle (already correctly documented in root CLAUDE.md after this pass's correction).
- **Acceptance criteria:** every field/action currently reachable in the accordion remains reachable in the new tabs; no regression in the existing "Leave workspace" (unenroll) action, which is a distinct concept from leave-of-absence and must stay clearly separated (its own row, not inside any of the 4 new tabs).

### A5. Overview dashboard card-height fix
- **UI:** on `TodayClient.tsx` (or wherever the admin Overview's stat-card grid lives), cap any card whose content length varies (a pending-approvals list, a department breakdown) to a fixed height with internal scroll — same pattern as the demo's `.card-fixed-h`/`.scroll-body` (`display:flex;flex-direction:column;min-height:...;max-height:...` + `flex:1;overflow-y:auto` on the inner list).
- **Acceptance criteria:** adding synthetic long content to any one card in a row does not change the height of its row siblings; verified at both desktop and the app's existing mobile breakpoint.

---

## Bucket B — New frontend, existing data

### B1. Workspace switcher
**Real-app reality:** confirmed no persistent switcher exists — `WorkspacesStrip.tsx` (`/me`) is a static directory list, and `/ws` has a full-page workspace list; switching means leaving the current view entirely. `getUserWorkspaces()` and `getAdminWorkspacesForUser()` (`lib/db/queries/workspaces.ts`) already return everything needed — this is purely a new UI composition.
- **UI:** a persistent header control (both `/me` and `/ws` shells) showing the active workspace name + a colored initials swatch + chevron, opening a bottom-sheet/dropdown listing every workspace the user belongs to, each showing its role for that workspace, plus a "My view" / "Admin view" segmented toggle — "Admin view" only enabled where the user's role in the *active* workspace permits it (see Bucket C's role model for the permission check once it lands; until then, gate on `role === 'admin'`).
- **Behavior on switch:** re-resolve the target route for the new workspace (`/me/ws/[newSlug]` or `/ws/[newSlug]`), matching the demo's `switchWorkspace()` — reset any workspace-scoped view to its default screen rather than preserving a screen key that may not apply.
- **Acceptance criteria:** switching workspace never shows another workspace's data mixed with the new one (full navigation, not a partial data swap); a Member-role workspace never exposes an enabled "Admin view" toggle regardless of how it's reached.

### B2. Timeline pagination + custom range
**Real-app reality:** `/me/timeline` already does offset-based pagination via `GET /api/events` / `GET /api/me/ws/[slug]/events` (`limit`/`offset`, default `limit=10`, capped 500) with a "View more" button and skeleton-rows-while-loading — the same shape as the demo's redesign, just with different numbers.
- **Frontend change:** change the initial page size to 8 ("Today" + previous 7) and the "load more" increment to 7, to match the approved spec exactly.
- **API change (small, additive):** add optional `start`/`end` (`YYYY-MM-DD`) query params to both `GET /api/events` and `GET /api/me/ws/[slug]/events`; when present, bypass `limit`/`offset` pagination and return the full matching range (mirroring the demo's `filterEventsByRange`). Validate `start <= end` server-side (400 on violation) — do not trust client-side validation alone, per CLAUDE.md's "server validates everything" principle.
- **UI:** add the demo's "📅 Custom range" toggle revealing From/To date inputs + Apply/Clear, replacing "View more" while a range filter is active.
- **Acceptance criteria:** default load shows exactly 8 rows (or fewer if the account is new); each "Load more" tap adds exactly 7; a custom range request returns only events in that window with no pagination controls shown; clearing the filter returns to the default 8-row view, not to wherever pagination had reached before the filter was applied.

---

## Bucket C — New backend + frontend

### C0. Foundational migration (do this first — B1's permission gating and both C1/C2 below depend on it)
Add to `scripts/migrate.js` (the single migration script, must stay fully idempotent/additive per CLAUDE.md):
```sql
-- workspace_members.role: extend from 'admin'|'member' to 'owner'|'admin'|'member'
-- SQLite has no native enum; if `role` is a TEXT CHECK constraint, widen it; otherwise
-- this is purely an application-level value change — no migration needed beyond
-- backfilling the correct workspace's creator to 'owner'.
```
- **Backfill:** for every existing workspace, set the earliest-added `admin` member (by `added_at`) to `role='owner'`. This subsumes today's implicit "sole admin can't leave" rule in `leaveWorkspace()`/`getSoleAdminWorkspaces()` — once an explicit Owner exists, that protection logic should move to "the Owner cannot leave/be demoted" rather than "no workspace may reach zero admins," which is a related but not identical invariant. Keep the multi-admin case working: a workspace may still have zero *additional* Admins as long as an Owner exists.
- **New query functions** (`lib/db/queries/workspaces.ts`): `promoteToAdmin(workspaceId, userId)`, `demoteToMember(workspaceId, userId)` — both must reject demoting/removing the Owner, and both must go through `requireWsAdmin()` (or a stricter `requireWsOwner()` if promote/demote should be Owner-only — recommend Owner-only, since letting any Admin mint new Admins is a wider blast radius than the demo's flat model implied).
- **New API route:** `PATCH /api/ws/[slug]/members/[userId]/role` — `{ role: 'admin' | 'member' }`, Owner-only, 403 on attempting to set/unset `owner`.
- **Frontend:** promote/demote buttons on the Employee Details page (see C3), a Role column on the Employees directory table, and role badges wherever a member is listed (switcher sheet from B1, directory, detail page).
- **Acceptance criteria:** an Owner can promote/demote any Admin or Member; an Admin (non-Owner) cannot access the role-change route (403, verified server-side even if hidden client-side); a workspace always has exactly one Owner; attempting to "demote" the Owner returns 400.

### C1. Employee documents
- **Migration:** new `employee_documents` table — `id, employee_id, workspace_id, key (offer|pan|aadhaar|bank), status (missing|pending|verified|rejected), file_path, uploaded_at, reviewed_by, reviewed_at, reject_reason, created_at`. Soft-deletes not needed (rows are replaced on re-upload, per the demo's `uploadMyDocument` overwrite behavior) but keep an audit trail if compliance requires it — flag this open question to the product owner before finalizing the schema, since PAN/Aadhaar documents are sensitive enough that an immutable audit log may be required even if the *current* document reference is mutable.
- **Storage:** file storage is out of scope for this plan (needs an infra decision — local disk vs S3-compatible bucket); stub the upload route to accept multipart and store a `file_path` reference, leaving actual blob storage as a follow-up infra task.
- **API routes:**
  - `POST /api/me/ws/[slug]/documents/[key]` — multipart upload, employee-only, sets `status='pending'`, `uploaded_at=now()`.
  - `GET /api/me/ws/[slug]/documents` — employee's own document statuses.
  - `PATCH /api/ws/[slug]/employees/[userId]/documents/[key]` — `{ action: 'verify' | 'reject', reason? }`, admin-only via `requireWsAdmin()`, `reason` required when rejecting.
- **UI — employee side:** new `/me/documents` (or a tab on the existing profile/more area), reusing the existing dropzone visual pattern already in the admin employee-onboarding flow if one exists, or the demo's `.dropzone` treatment if not.
- **UI — admin side:** extend `DetailsClient.tsx`'s existing documents display with approve/reject icon-buttons on `pending` rows (inline reject-reason textarea, not a native `prompt()`), and surface pending documents in the Overview "pending approvals" feed for discoverability (same cross-surface visibility principle as leave/regularization approvals).
- **Acceptance criteria:** an employee can upload a replacement for any `missing`/`rejected` document; an admin sees every pending document across the org from one place (Overview) as well as on the individual's detail page; a rejected document shows its reason to the employee and reverts to an upload-needed state.

### C2. Regularization requests (employee-submitted corrections)
**Real-app reality:** today's only correction path is admin-initiated, via the Alerts/Disputes page (`src/app/ws/[slug]/disputes/`) creating an `admin_overrides` row. This item adds the missing employee-initiated half.
- **Migration:** new `regularization_requests` table — `id, workspace_id, user_id, presence_event_id, requested_change (enum or free text, matching the demo's vocabulary: verified-network-only | wfo-manual | wfh | other), reason, status (pending|approved|rejected), created_at, reviewed_by, reviewed_at`. Keep this **separate** from `admin_overrides` — they have different actors and different lifecycles (employee-submitted + pending vs. admin-only + immediate); on approval, an admin's action should *create* the corresponding `admin_overrides` row (reusing the existing override mechanism as the actual effect), rather than merging the two tables.
- **API routes:**
  - `POST /api/me/ws/[slug]/regularizations` — `{ presence_event_id, requested_change, reason }`, employee-only, creates a `pending` row. Validate the event belongs to the requesting user and is not already `verified`/`override` (only `partial`/`none` events are eligible, matching the demo's gating).
  - `GET /api/me/ws/[slug]/regularizations` — employee's own requests + statuses.
  - `PATCH /api/ws/[slug]/regularizations/[id]` — `{ action: 'approve' | 'reject' }`, admin-only; approving calls the existing `createAdminOverride()` path internally so the actual attendance effect goes through the one audited mechanism the codebase already trusts.
- **UI — employee side:** a "Request correction" action on `partial`/`none` timeline rows (inline expand form: change-type select + reason textarea), and a "Your correction requests" section in the Leave → History tab (or a dedicated Timeline sub-section — match wherever A4's IA lands, since the demo colocates it with leave history for account-level visibility, not because it's conceptually a leave feature).
- **UI — admin side:** extend the existing Alerts/Disputes page to show employee-submitted regularization requests alongside admin-flagged unmatched events, visually distinguished (e.g., "Requested by [employee]" vs "Flagged — signals unmatched"), both feeding the same approve/decline action pattern already built there.
- **Acceptance criteria:** an employee cannot submit a regularization for an already-verified or already-overridden event; an approved regularization results in exactly one new `admin_overrides` row (no double-application if approved twice — guard with a status check); the employee sees their request's status update after an admin acts on it, without needing to refresh mid-session if real-time updates are already used elsewhere in the app (otherwise, standard reload-to-see-status is acceptable, matching current leave-request UX).

---

## Documentation updates (already applied in this pass, listed here for traceability)
- `docs/product/11-current-state.md` — added a "Pitch demo — forward-looking features not yet shipped" section; corrected the stale "leave instantly approved" claim.
- `docs/product/06-product-roadmap.md` — added the three Bucket-C items to the v2/Next table; corrected two stale "instant approval" status-check callouts.
- `docs/product/00-index.md` — added a new drift entry documenting that the demo shows features *ahead* of the codebase (the inverse of every other drift entry, which shows old docs *behind* the codebase).
- Root `CLAUDE.md` — corrected the Leave System section's stale instant-approval claim and balance-formula omissions (`opening_balance`, `leave_cutover_date` anchor, approved-only filter).

**Follow-up doc task for whoever implements this plan:** once Bucket C ships, update root `CLAUDE.md`'s "Key Invariants" and "What NOT to Do" sections to add the new Owner-only role-change rule and the employee-documents/regularization non-negotiables (e.g., "Never let a non-Owner call the role-change route," "Regularization approval must always route through `createAdminOverride()`, never write attendance state directly").

---

## Implementation order & dependencies

1. **C0 (role model migration + backfill)** — blocks B1's permission gating and C1/C3's admin-only checks referencing Owner.
2. **Bucket A items (A1–A5)** — fully independent of everything else; can run in parallel with step 1.
3. **B2 (timeline API + UI)** — independent; can run in parallel with steps 1–2.
4. **B1 (workspace switcher)** — depends on C0 for correct Admin-view gating (can be stubbed with the old `role==='admin'` check and revisited once C0 lands, if parallelizing).
5. **C1 (employee documents)** — depends on C0 only for the admin-only route guard; otherwise independent. Resolve the file-storage infra question before starting.
6. **C2 (regularization requests)** — depends on C0 (admin-only guard) and benefits from A4 (Leave IA) already being in place, since its employee-facing status view was designed to live inside that tab structure.
7. **Final cross-cutting pass** — re-run the "functional consistency" check from the demo's own Phase 9: every new employee action (document upload, regularization submit) has an admin management view; every new admin action (promote/demote, document verify/reject, regularization approve/reject) is visible to the affected employee; update `CLAUDE.md` per the follow-up doc task above.

## Verification
- Unit/integration tests for every new query function (`promoteToAdmin`, `demoteToMember`, document upload/verify, regularization submit/approve) following the existing test patterns in `lib/db/queries/` (if a test suite exists — if not, at minimum manual verification against a local SQLite DB via `npm run migrate` + `npm run dev`).
- Manual click-through of every acceptance criterion listed above, on both `/me` and `/ws` surfaces, before merging.
- Confirm no regression in the existing sole-admin protection behavior once it's superseded by the Owner concept (C0) — a workspace with an Owner and zero Admins must still function identically to one with an Owner and several Admins.
