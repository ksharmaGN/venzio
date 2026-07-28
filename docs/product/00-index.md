# Product Documentation Index

This directory is a faithful markdown transcription of Venzio's ten founding strategy documents (originally `.docx` files under "Check Mark/Docs", written when the product was still called **CheckMark**). "CheckMark" has been renamed to "Venzio" throughout except where a passage narrates the rename itself. The content, structure, and decisions of each source document are preserved as written — including anything that has since drifted from how the product actually works.

Where a document's claims contradict current reality (per `CLAUDE.md` and the live codebase), the original text is **left intact** and followed by an inline callout:

> ⚠️ **Status check:** ...

This index exists to make those callouts scannable in one place, as a seed for a separate feasibility audit.

## Documents

| File | One-line description |
|---|---|
| [01-vision-mission.md](./01-vision-mission.md) | Founding vision, mission, non-negotiable data-ownership model, v1→v3 scope, and success metrics. |
| [02-icp-personas.md](./02-icp-personas.md) | The two ideal customer profiles (hybrid-work vs field-force orgs), anti-ICP, and five buyer/user personas. |
| [03-competitive-analysis.md](./03-competitive-analysis.md) | Market map against HRMS tools, field-force trackers, and WhatsApp; differentiation matrix and competitive risks. |
| [04-prd.md](./04-prd.md) | The authoritative v5 PRD — data model, functional requirements (user + org side), timezone/retention policy, API tokens, gamification architecture, NFRs. |
| [05-user-journeys.md](./05-user-journeys.md) | Ten end-to-end journeys covering sign-up, config-heavy/config-light org setup, daily check-in, disputes, plan limits, consent, and multi-org use. |
| [06-product-roadmap.md](./06-product-roadmap.md) | Now/Next/Later feature sequencing across v1 (presence layer), v2 (calculation layer), v3 (platform layer). |
| [07-hld.md](./07-hld.md) | v2 high-level design — system components, full DB schema, the dashboard query pattern, and security decisions. |
| [08-gtm.md](./08-gtm.md) | Go-to-market phases, channels, sales pitches, and first-90-days OKRs. |
| [09-pricing.md](./09-pricing.md) | Free/Starter/Growth plan tiers, upgrade triggers, the double-billing model, and unit economics. |
| [10-design-spec.md](./10-design-spec.md) | Brand, colour system, typography, user-side and org-side UI patterns, and interaction rules. |
| [11-current-state.md](./11-current-state.md) | Ground-truth snapshot of what's actually shipped today, verified against the live codebase — pair with `01-vision-mission.md` for market-fit/GTM brainstorming. |

## Known Drift from Current Build

Aggregated from every ⚠️ **Status check** callout across the ten documents above. Grouped by theme; each links back to its source file for full context.

### Authentication
- **Google OAuth vs email+password+OTP** — Every source document (PRD, HLD, User Journeys) specs Google OAuth as the sole sign-in method with "no passwords." The live product uses email + bcrypt password (cost 12, min 8 chars) with mandatory OTP verification for new accounts, JWT in an httpOnly `cm_session` cookie. No Google OAuth exists anywhere in the codebase.
  → [04-prd.md](./04-prd.md#what-venzio-is), [05-user-journeys.md](./05-user-journeys.md#journey-1-user--first-sign-up-and-check-in), [07-hld.md](./07-hld.md#database--postgresql-via-supabase)

### Database & infrastructure
- **Supabase/PostgreSQL vs SQLite/Turso** — PRD and HLD both specify Supabase-managed PostgreSQL with Row Level Security, Supabase Auth, and Vercel deployment. The actual stack is `better-sqlite3` (dev) / Turso libSQL (prod), with authorization enforced entirely in application code (`requireWsAdmin()`, explicit `WHERE workspace_id = ?` filters) — there is no Postgres, no RLS, no Supabase project.
  → [04-prd.md](./04-prd.md#what-venzio-is), [07-hld.md](./07-hld.md#architecture-overview), [07-hld.md](./07-hld.md#security-decisions)
- **Framework version** — HLD says Next.js 14; the app runs on Next.js 16.
  → [07-hld.md](./07-hld.md#frontend--nextjs-14-pwa)

### Signal matching (the core USP)
- **OR semantics vs AND semantics** — This is the single largest drift. The PRD and HLD both describe the dashboard query as `wifi matches OR gps within geofence OR ip within 500m`. The live engine (`src/lib/signals.ts` → `queryWorkspaceEvents()`) requires **every configured signal type** to match for `matched_by = 'verified'`; partial matches are tracked separately and do not count as office presence. This AND-semantics rule is Venzio's stated core USP today (CLAUDE.md, opening paragraph).
  → [04-prd.md](./04-prd.md#functional-requirements--organisation-side), [07-hld.md](./07-hld.md#the-dashboard-query--exact-sql-pattern)
- **WiFi is dormant** — Every source document treats WiFi SSID as a fully live, equally-weighted verification signal alongside GPS and IP. In the current codebase, WiFi is captured and hashed but is **not evaluated** by the matching engine at all — only `gps` and `ip` are ever added to `configuredTypes` in `signals.ts`. This matches the gap documented in `Instruction-Native-App.md`.
  → [03-competitive-analysis.md](./03-competitive-analysis.md#venzios-differentiation-matrix), [04-prd.md](./04-prd.md#fr-o05-dashboard--the-query-layer), [05-user-journeys.md](./05-user-journeys.md#journey-2-config-heavy-admin--workspace-setup-at-the-office), [05-user-journeys.md](./05-user-journeys.md#journey-7-config-heavy-admin--month-end-review), [06-product-roadmap.md](./06-product-roadmap.md#now--v1-weeks-16-the-presence-layer), [08-gtm.md](./08-gtm.md#the-two-sales-pitches), [07-hld.md](./07-hld.md#the-dashboard-query--exact-sql-pattern)
- **Checkout is not signal-free** — PRD FR-U04 says checkout collects a timestamp only. Checkout today re-collects GPS/WiFi/IP and computes `checkout_location_mismatch`, which can zero out counted hours even for a `verified` check-in.
  → [04-prd.md](./04-prd.md#fr-u04-check-out)

### Data retention
- **No hard-delete retention cron exists** — PRD and NFRs describe a 7-year hard maximum with a nightly deletion cron, 30-day pre-deletion notice, and hard delete on account closure. `lib/plans.ts`'s `historyMonths: 84` for Growth is only a query-time history *gate*, not a deletion policy — no such cron was found. This also conflicts with the platform's own "soft deletes everywhere, never hard-delete" principle.
  → [04-prd.md](./04-prd.md#data-retention-policy), [04-prd.md](./04-prd.md#non-functional-requirements)

### Leave & holiday features shipped ahead of roadmap
- The Vision doc and Roadmap both place a full leave tracker and holiday calendar in **v3 / Year 2 / 100+ customers**. Both are already live today, in simpler form: leave requests (`workspace_leave_types`, `leave_requests`) are auto-approved instantly with no approval workflow and no accrual carry-over; a per-workspace holiday calendar (`workspace_holidays`) supports CSV/XLSX bulk import.
  → [01-vision-mission.md](./01-vision-mission.md#product-scope--v1-to-long-term), [06-product-roadmap.md](./06-product-roadmap.md#next--v2-months-38-the-calculation-layer), [06-product-roadmap.md](./06-product-roadmap.md#later--v3-year-2-the-platform-layer)

### Pricing
- **Prices have moved** — Pricing doc lists Starter at ₹49/user/month and Growth at ₹89/user/month. The live `/pricing` page shows ₹69 and ₹99 respectively. Plan *limits* (users/history/locations) still match `lib/plans.ts` exactly.
  → [09-pricing.md](./09-pricing.md#plan-tiers)
- **Leave management is not plan-gated** — Pricing doc gates leave management behind Starter (add-on) / Growth (included). In the codebase, the leave system is available to any workspace regardless of plan.
  → [09-pricing.md](./09-pricing.md#plan-tiers)

### i18n
- **next-intl vs hand-rolled locale file** — PRD and NFRs specify the `next-intl` library. The actual approach is a single `src/locales/en.ts` object with nested keys, no `next-intl` dependency.
  → [04-prd.md](./04-prd.md#global-scope--what-the-platform-handles-and-what-it-does-not)

### Brand & design
- **Brand colour palette has changed twice** — The Design Spec (and CLAUDE.md's own "Design System" table) describe a blue/white palette (`--brand: #1B4DFF`, Syne + DM Sans). The live `src/app/globals.css` ships a green, dark-first palette (`--brand: #1d9e75`, Plus Jakarta Sans + Playfair Display) per the later `VENZIO_BRAND_IMPLEMENTATION.md` rebrand. Both the original docx **and** CLAUDE.md's design tokens are stale on this point.
  → [10-design-spec.md](./10-design-spec.md#colour-system), [10-design-spec.md](./10-design-spec.md#typography)
- **Logo concept superseded** — Design Spec's "checkmark that doubles as a pin" logo concept was replaced by a pin-with-a-V-shaped-checkmark mark during the Venzio rebrand.
  → [10-design-spec.md](./10-design-spec.md#brand)
- **Bottom nav has 4 items, not 3** — Design Spec caps mobile bottom navigation at 3 items (Home, Timeline, Orgs). The live `BottomNav.tsx` has 4 (adds Settings).
  → [10-design-spec.md](./10-design-spec.md#mobile-first-layout-rules)

### Not yet built (confirmed absent, no drift — expectations already correctly labeled "future" by the source docs)
- Payroll data pipe / Razorpay integration, allowance auto-calculation, org-wide analytics dashboard (Growth v2), user productivity layer (focus sessions, habit tracking, the `/me/space` Notes/To-dos/Pomodoro concept from `VENZIO_RENAME_AND_SPACE.md`), Google Calendar sync, native iOS/Android app (Capacitor), SSO/enterprise plan, Form 16 export, leave accrual carry-over, and multi-level leave approval workflows.

---

*Generated as a companion to the ten transcribed strategy documents above, for use in a follow-up feasibility audit.*
