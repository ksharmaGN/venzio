# Product Requirements Document

**Venzio — Presence Intelligence Platform**
*Venzio v1.0 — Complete final specification for development*
Source: `04_prd_final.docx` — v5.0 Final, March 2026

---

## What Venzio Is

Venzio is a presence intelligence platform. Users tap once to record where they are. Organisations query that record according to their own rules. The platform is free for users and paid for organisations.

- Product name: Venzio
- Tagline: Presence Intelligence Platform
- Version: 1.0 MVP
- PRD version: 5.0 — Final — hand this to Claude Code
- Primary mobile target: Android Chrome (GPS + WiFi SSID + IP)
- Secondary targets: Desktop Chrome (GPS + WiFi SSID + IP), iOS Safari (GPS + IP only)
- Deployment: Vercel (frontend + API) + Supabase (PostgreSQL + Auth)
- Map / address search: OpenStreetMap Nominatim — free, no API key required
- Scope: Global from day 1 — UTC timestamps, IANA timezone support, locale-aware display

> ⚠️ **Status check:** The deployment target described here (Vercel + Supabase/PostgreSQL + Auth) is not what the codebase runs on. The actual DB abstraction (`src/lib/db/index.ts`) is SQLite (`better-sqlite3`) in dev and Turso (libSQL) in production — there is no Supabase, no PostgreSQL, and no Supabase Auth anywhere in the stack (CLAUDE.md "Database Patterns", `docs/architecture/HLD.md` §6 "Technology Choices").

## Change Log v4 → v5

| Section | What changed |
|---|---|
| Signal config — defaults + session override | Org registers default signal config. Dashboard always uses defaults. Admin can send one-time override params for the current session (does not save). Admin can also permanently update defaults. Both paths fully specced. |
| Data retention policy | 7-year hard limit on all presence_events. Nightly cron deletion. 30-day user/org notification before any deletion. Satisfies Indian IT Act, GDPR, and labour audit requirements. |
| Timezone architecture | UTC stored everywhere in DB. Org sets display timezone (IANA string) in workspace settings. User's display timezone auto-derived from browser — no setting required. CSV exports include both UTC and org-timezone columns. |
| User time-range filtering | Users can filter their own timeline by any date range within their plan window. Orgs can filter their dashboard by any date range within their plan window. |
| Gamification architecture | user_stats materialized view pre-computed from day 1. Streak and presence score fields defined. Gamification UI ships in v2 but data structure correct from v1 schema. |
| Personal API token layer | Users can generate personal API tokens. Third-party tools (AI agents, MCP clients, browser automation) can call POST /api/v1/checkin with the token on the user's behalf. Token infrastructure built in v1, exposed publicly in v2. |
| AI automation vision | CoWork/MCP/browser-agent check-in flow specced. User grants token once. AI agent calls the check-in API without user opening the app. This is a v2 feature built on v1 token infrastructure. |
| Global scope note | International note added — data model is inherently global. Locale-specific items are timezone display, date format, and currency — all handled. Labour law compliance is org responsibility, not platform responsibility. |

## Core Data Model — Non-Negotiable Foundations

presence_events has no workspace_id and no company_id. Events belong to the user unconditionally. Organisations query them at read time. No hours_in_office stored column — always computed. Multiple events per day is natural and expected.

> This foundational rule is still true today and is the single most-preserved architectural decision across every rewrite of the codebase (CLAUDE.md, Principle #4 and #3).

### The presence_events table

| Column | Type | Notes |
|---|---|---|
| id | UUID PK DEFAULT gen_random_uuid() | — |
| user_id | UUID NOT NULL FK → users(id) | ON DELETE CASCADE |
| event_type | TEXT NOT NULL DEFAULT 'office_checkin' | Enum: office_checkin \| client_visit \| manual_log. v2 adds: focus_session \| habit_log |
| checkin_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Stored in UTC always |
| checkout_at | TIMESTAMPTZ NULL | Stored in UTC. NULL = no checkout. Never auto-set. |
| note | TEXT NULL | Optional free-text from user |
| wifi_ssid | TEXT NULL | Raw SSID string. NULL on iOS or unavailable. |
| ip_address | INET NOT NULL | Extracted server-side. Never collected client-side. |
| ip_geo_lat | DECIMAL(10,7) NULL | Resolved from IP at check-in time via ip-api.com |
| ip_geo_lng | DECIMAL(10,7) NULL | — |
| gps_lat | DECIMAL(10,7) NULL | From browser Geolocation API. NULL if permission denied. |
| gps_lng | DECIMAL(10,7) NULL | — |
| gps_accuracy_m | INTEGER NULL | Browser-reported accuracy in metres |
| source | TEXT NOT NULL DEFAULT 'user_app' | user_app \| api_token \| admin_override. Tracks how the event was created. |
| api_token_id | UUID NULL FK → user_api_tokens(id) | Populated when source = api_token. Identifies which token was used. |

NO hours_in_office column. Computed always as: `EXTRACT(EPOCH FROM (checkout_at - checkin_at)) / 3600.0` — returns NULL if checkout_at is NULL. Total day duration = SUM of all non-null event durations for that user on that date.

> ⚠️ **Status check:** The live `presence_events` schema (`src/lib/db/schema.ts`, `docs/architecture/HLD.md` §3) has grown well beyond this v5 snapshot — it also carries checkout-side signals (`checkout_gps_lat/lng`, `checkout_wifi_ssid`, `checkout_location_mismatch`), `scheduled_checkout_at`, `checkout_reason`, `location_label`, `device_info`, `device_timezone`, and trust-scoring columns (`trust_flags`, and `trust_score` per `Instruction-Native-App.md`). The "no `hours_in_office` column, always computed" rule itself is unchanged and still holds.

Required indexes:
- `CREATE INDEX idx_presence_user_time ON presence_events(user_id, checkin_at DESC)`
- `CREATE INDEX idx_presence_checkin_at ON presence_events(checkin_at DESC)`
- `CREATE INDEX idx_presence_gps ON presence_events USING GIST(point(gps_lng, gps_lat)) WHERE gps_lat IS NOT NULL`
- `CREATE INDEX idx_presence_source ON presence_events(source)`

## User Onboarding Principle — Absolute and Non-Negotiable

No user is ever blocked, redirected, or shown a message that references their employer's plan status. Every guard in this product lives on the organisation side of the API. The user-facing API has zero plan checks, zero domain checks, zero seat limits.

| User situation | What happens | What user sees |
|---|---|---|
| Domain not verified by org | User created as standalone. Events stored normally. | Normal home screen. No mention of any org. |
| Personal email not yet consented | User created. Events stored. Not linked to that org. | Normal home screen. No mention of consent or org. |
| 13th employee at free-plan org | User auto-enrolled normally. Events stored. Org cannot query this user. | Normal home screen and analytics. Completely unaware they are invisible to their org. |
| No org at all | User created as standalone. Events stored. | Normal home screen with personal timeline. Fully functional. |
| User in 2+ orgs | Enrolled in all matching orgs simultaneously. | Home screen with org strip at bottom. All personal analytics visible. |

## Functional Requirements — User Side

### FR-U01: Sign up and auto-enrolment
- Any Google account signs up — work email, Gmail, any domain
- System silently checks domain against all verified workspace domains
- If match: user auto-enrolled in matching workspace(s). Silent — no user notification.
- If personal email in whitelist with accepted consent: enrolled in that workspace
- If no match: standalone user. Full product access. No messages about missing org.
- First-time user sees single onboarding screen: "Tap I'm here whenever you arrive somewhere. That's it."

> ⚠️ **Status check:** There is no Google account sign-up. Registration is email + password (bcrypt, cost 12) with mandatory OTP verification before account creation (`cm_otp_ok` cookie, checked server-side) — see CLAUDE.md "Auth System" and Key Invariant #3. Domain-based auto-enrolment concepts still apply conceptually to workspace membership, but the entry point itself is not OAuth.

### FR-U02: Home screen
- "I'm here" button — primary action, always visible, always active
- "I'm leaving" button — appears only when there is an open check-in (checkout_at IS NULL on most recent event today)
- Today's timeline: list of events in chronological order. Each shows: time, duration (if checked out), note, location label
- This month: 3 stat chips — N days checked in, N total hours logged, N locations visited
- Org strip at bottom (only if enrolled in 1+ orgs): org name + days counted this month per org. Collapsible.
- Time range filter: user can filter their timeline to any date range within their plan window

The home screen must be valuable to a user with zero org attached. Personal timeline is the primary value.

### FR-U03: Check-in
- User taps "I'm here"
- Browser collects simultaneously: GPS (Geolocation API), WiFi SSID (NetworkInformation API — desktop/Android), IP (server-side)
- GPS permission not granted: browser shows permission prompt. If denied: event saves with gps = NULL. User sees brief note: "Check-in saved without GPS."
- Server creates presence_events row: event_type = office_checkin, source = user_app, all available signals, checkin_at = NOW() UTC
- User sees: "Checked in at [local time]" — time shown in user's browser locale timezone
- Optional note prompt: appears below confirmation. Pre-populated chips: "At office" / "Client visit" / "Home". Or free text.

### FR-U04: Check-out
- User taps "I'm leaving" — updates checkout_at on the most recent open event for today
- No signal verification — check-out is a timestamp only
- Duration displayed immediately: "3h 24m at this location"
- If no open check-in: button not shown
- No automatic checkout at midnight or any other time — checkout_at stays NULL if user does not tap

> ⚠️ **Status check:** Checkout is no longer signal-free. The live checkout flow collects GPS/WiFi/IP again and computes `checkout_location_mismatch`, which affects whether hours count as verified office presence (CLAUDE.md "Trust signals", `docs/architecture/signal-matching.md` §6, `eventCountsAsOfficePresence()` in `src/lib/signals.ts`).

### FR-U05: Personal timeline and history
- Full chronological list of all presence_events for this user
- Date range filter: from/to date picker. Defaults to current month. Any range selectable within plan window.
- Each event detail: checkin_at (local timezone), checkout_at (local timezone), duration, event_type label, note, GPS pin link (opens OpenStreetMap), WiFi SSID, IP address
- Calendar month view: each day is a tile showing event count. Tap to expand that day's events.
- Horizontal swipe to move between months
- User can edit their note on any event (note field only — no other event data editable)

### FR-U06: User stats and gamification foundation
The gamification UI ships in v2. The data structure is built in v1 so v2 requires no schema changes.

A user_stats materialized view is pre-computed nightly (and after every check-in) with:
- current_streak: consecutive days with at least one check-in (calendar days, not working days)
- longest_streak: all-time longest streak for this user
- total_checkins: all-time count
- total_hours_logged: sum of all non-null durations
- checkins_this_month: count for current calendar month
- distinct_locations_this_month: count of meaningfully distinct GPS clusters this month
- presence_score: a computed score (algorithm TBD in v2 design) — reserved column, initially NULL

These stats are available via API in v1 for any frontend component that wants them, even if the gamification UI itself ships later.

## Functional Requirements — Organisation Side

### FR-O01: Workspace creation and domain verification
- Admin creates workspace with company name and email domain(s) (up to 5 domains)
- Domain verification: email sent to admin@ and support@ at the domain with one-click link (48h TTL). Alternative: DNS TXT record.
- Until verified: workspace exists but no user data queryable. Dashboard shows only the verification prompt.
- After verification: all users with that domain auto-enrolled and queryable

### FR-O02: Signal configuration — config-heavy orgs

Registration (done physically at office):
- Admin clicks "Register this location" — browser GPS auto-captured. Admin names location.
- Admin clicks "Register this network" — browser reads current WiFi SSID. Admin confirms.
- Admin clicks "Register IP context" — server records admin's current IP, resolves to coordinates.
- Each registered signal becomes a default filter for this workspace's dashboard query
- Admin can register unlimited locations, multiple SSIDs, multiple IP contexts

Default config behaviour: every dashboard load uses the workspace's saved signal config as default filters. The query runs automatically with these defaults. Admin never needs to re-apply filters.
- Default GPS geofence radius: 300m (configurable per location, 100m–500m)
- Default WiFi match: exact SSID hash comparison
- Default IP match: within 500m of resolved IP coordinates
- These defaults are saved in workspace_signal_config and persist across sessions

Session-level filter override (temporary, does not save):
- Adjust GPS radius for this view: slider shows current default, admin drags to override (e.g., 300m → 500m)
- Add or remove specific SSIDs from this view
- Expand to show all events regardless of signal match (temporarily remove all signal filters)
- Apply IP prefix filter (e.g., show only events from 103.24.x.x)
- When admin refreshes or navigates away: filters reset to saved defaults
- A "Using overrides" badge visible in the filter bar while overrides are active
- A "Reset to defaults" button clears all overrides instantly

Permanent default update:
- Admin opens Settings → Signal Config → edits any saved config item
- Changes saved to workspace_signal_config — become the new permanent defaults for all future sessions
- Example: change default GPS radius from 300m to 500m — all future dashboard loads use 500m

### FR-O03: Config-light orgs — no signal configuration
- Config-light orgs skip signal registration entirely
- Their dashboard query returns ALL presence_events for enrolled users — unfiltered by signal
- Filter bar is still available: admin can apply session-level filters on top of the unfiltered data
- This is the natural mode for field force companies — they want to see everything
- Admin can add signal config at any time if they later want to filter

### FR-O04: Personal email consent
- Admin adds personal email — consent email sent immediately
- Consent email: "Acme Corp has added you to Venzio. They will see your attendance data. Accept or Decline."
- Until accepted: user shows as "Pending consent" in org team list. No data visible.
- Declined: "Declined" status. Cannot re-invite for 30 days.
- User can revoke consent anytime from their profile. Disappears from org immediately.

### FR-O05: Dashboard — the query layer

The query logic:
- Config-heavy org: return presence_events where user is enrolled AND (wifi matches OR GPS within geofence OR IP within 500m of IP context) AND checkin_at within plan window AND date range filter.
- Config-light org: return ALL presence_events where user is enrolled AND checkin_at within plan window AND date range filter.

> ⚠️ **Status check:** This is the single biggest drift from the shipped product. Venzio's core USP today is **AND semantics, not OR** — "when a workspace has GPS + WiFi + IP signals configured, ALL must match for a check-in to count as verified" (CLAUDE.md, top of document; `docs/architecture/signal-matching.md`). The current implementation (`src/lib/signals.ts` → `queryWorkspaceEvents()`) computes `matched_by = 'verified'` only when *every* configured signal type matches, `'partial'` when some but not all match, and `'none'` when none match. It also only evaluates GPS and IP as configured types today — WiFi is not wired into the matching set at all (see the callout in `03-competitive-analysis.md`). The config-light behaviour described here (all events pass through when no signals are configured) is accurate and unchanged.

Dashboard views:
- Today view: enrolled users list with status Present (at least one matched event today) / Not marked
- Monthly view: calendar grid per user. Each working day: Present / Not marked. Working days = Mon–Fri minus admin-marked non-working dates.
- Date range: admin selects any from/to range within plan history window. Defaults to current month.

Filter bar (always visible):
- WiFi SSID: select from registered SSIDs, or type a custom value for session-only filter
- GPS radius: slider overriding current default for this session
- Date range: from/to date picker
- Event type: office_checkin | client_visit | manual_log | all
- Match status: matched by config | unmatched | all (all = disables signal filter entirely for this session)
- Specific user: search and select from enrolled employees
- "Using overrides" badge when any filter differs from saved defaults. "Reset to defaults" button.

### FR-O06: Org-level date range filtering
- Admin can filter any dashboard view to any date range: custom from/to picker
- Constraint: date range cannot exceed plan history window
- Free plan: range must be within last 3 months
- Starter plan: range must be within last 12 months
- Growth plan: any range within the 7-year data retention window
- Range selection persists for the session. Resets to current month on next login.

> The plan history windows (Free 3 months / Starter 12 months / Growth 7 years) match `lib/plans.ts` today exactly.

### FR-O07: User profile — full transparent history
- Admin clicks any enrolled user → right-panel slides open (not a new page)
- Shows ALL presence_events for this user within plan history window — including events NOT matched by org's signal config
- Matched events: normal style. Unmatched events: muted with label "Not counted — GPS 420m from nearest location (threshold: 300m)"
- "Count this event" button on any unmatched event — creates admin_override record
- Admin override confirmation: "Mark [date] [time] as Present for [org]? This creates a manual override and cannot be undone automatically."
- Admin can add a note to any override: "Confirmed with employee — was at client site"

Admin sees this user's raw signal data (WiFi SSID, GPS, IP) for every event, but cannot see which other organisations this user belongs to. They only see signals, not org context.

### FR-O08: Plan enforcement — all guards org-side only

| Situation | Backend behaviour | User sees | Admin sees |
|---|---|---|---|
| Unverified domain | No user data queryable. | Normal product experience. | Verification prompt banner. |
| Personal email, no consent | User not enrolled. Events stored normally for user. | Normal product experience. | Pending consent status for that email. |
| Free plan, 11th+ user in domain | User enrolled normally. Events stored. Query LIMIT 10 by most recent activity excludes them. | Completely normal experience. | Banner: "X more users on Venzio. Upgrade to see all." |
| Free, CSV export requested | API returns 403. | N/A | Upgrade modal. |
| Free, data > 3 months requested | Query enforces AND checkin_at >= NOW() - INTERVAL '3 months' | User always sees full own history. | Org sees 3-month window only. |
| Starter, data > 12 months | Query enforces 12-month window. | User sees full history always. | Upgrade to Growth to see older data. |
| Growth, 6th location config | API returns 400. | N/A | "5-location limit reached on Growth." |
| User revokes consent | workspace_employees row marked revoked. Excluded from all queries. | Confirmation shown to user. | User disappears from dashboard immediately. |

### FR-O09: CSV export
- Available on Starter and Growth plans
- One row per presence_event. Columns: user_email, event_type, checkin_at_utc, checkin_at_org_tz, checkout_at_utc, checkout_at_org_tz, duration_hours, note, wifi_ssid, ip_address, gps_lat, gps_lng, gps_accuracy_m, matched_org_config, source, admin_override
- checkin_at_utc: ISO 8601 UTC. checkin_at_org_tz: formatted in org's configured timezone.
- Generated on demand. Not stored server-side.
- Starter: last 12 months. Growth: any range within 7-year retention window.

## Timestamp and Timezone Architecture

All timestamps stored as UTC in PostgreSQL TIMESTAMPTZ columns. Display timezone is applied at the presentation layer — never at storage layer. This is the only correct approach for a global product.

> ⚠️ **Status check:** "PostgreSQL TIMESTAMPTZ" doesn't apply to the current stack — timestamps are stored as ISO 8601 strings in SQLite/Turso (no native `TIMESTAMPTZ` type), but the underlying rule (store UTC, convert only at display time) is preserved and still followed.

### Storage
- All timestamps in DB: UTC TIMESTAMPTZ — PostgreSQL ensures this regardless of server timezone
- API requests: client sends local time OR server uses NOW() UTC — server always wins for checkin_at
- No timezone information stored on the event itself — timezone is a display concern, not a data concern

### Org timezone configuration
- Admin sets workspace display timezone in Settings: a dropdown of IANA timezone strings (e.g., "Asia/Kolkata", "America/New_York", "Europe/London")
- Default: "Asia/Kolkata" (UTC+5:30) for India-registered workspaces
- This setting affects: all timestamp display in the org dashboard, CSV export org-timezone columns, monthly view date boundaries
- If org has locations in multiple timezones (global org): they set one primary timezone for reporting. Individual location timezones can be stored on workspace_signal_config for future use.

### User timezone display
- User's timestamps shown in their browser's local timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
- No timezone setting required from the user — it is automatic
- If user travels to a different timezone: their check-ins are shown in the timezone they were in when viewing, not when checking in
- This is correct — the user wants to see "I checked in at 9:42 AM" relative to where they are right now

### Date boundaries for monthly views
- A "day" in the org dashboard is defined as midnight-to-midnight in the org's configured timezone
- A "day" in the user's home view is midnight-to-midnight in the user's browser timezone
- CSV export: working_date column shows the calendar date in org timezone (e.g., "2026-03-16")

### API responses
- All timestamps in API JSON responses: ISO 8601 UTC (e.g., "2026-03-16T04:12:33Z")
- Frontend converts UTC → display timezone using the browser's Intl API
- No timezone conversion happens server-side — always UTC out, convert on client

## Data Retention Policy

All presence_events stored for a maximum of 7 years from checkin_at date. After 7 years, records are permanently deleted. This satisfies Indian IT Act requirements, GDPR retention limits, and most labour audit requirements globally.

> ⚠️ **Status check:** No hard-delete retention cron exists in the codebase today. `lib/plans.ts` defines Growth's `historyMonths: 84` (7 years), but this is only a query-time history *gate* used by `queryWorkspaceEvents()` — it limits how far back a dashboard query can look, it does not delete anything. This also runs against CLAUDE.md's global principle: "Soft deletes everywhere... Never hard-delete user or workspace data" (Principle #5). There is no nightly deletion cron, no 30-day pre-deletion notification, and no hard-delete-on-account-deletion flow implemented.

### Retention rules
- Maximum retention: 7 years from checkin_at date
- Deletion method: hard delete from presence_events table. Not soft delete, not archive — permanent deletion.
- Deletion schedule: nightly cron job at 02:00 UTC. Deletes all events where checkin_at < NOW() - INTERVAL '7 years'
- Associated records deleted in same transaction: admin_overrides referencing deleted events

### Notification before deletion
- 30 days before any user's oldest event reaches 7 years: email notification to the user
- Email content: "Some of your older check-in records (from [year]) will be permanently deleted on [date] as part of our 7-year data retention policy."
- Admin notification: if any enrolled employee's records are due for deletion, admin receives a summary notification
- No way to extend retention — 7 years is the hard limit for all users on all plans

### User-initiated deletion
- User can request full account deletion from their profile
- 30-day grace period: account deactivated but data retained. User can reactivate within 30 days.
- After 30 days: all presence_events, user record, and workspace_employees rows permanently deleted
- Organisation data (workspace config, overrides) is not deleted — it belongs to the org

## Personal API Token Layer

Users can generate personal API tokens that allow third-party tools — AI agents, MCP clients, browser automation tools — to create check-in events on their behalf. This is the infrastructure for the AI automation vision.

### Token table

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| user_id | UUID FK → users(id) | — |
| name | TEXT NOT NULL | User-given name: "My CoWork Agent", "Claude Desktop" |
| token_hash | TEXT NOT NULL | bcrypt hash of the token. Plaintext shown only once at creation. |
| scopes | TEXT[] NOT NULL | Array of allowed actions. v1: ['checkin:write']. Future: ['checkin:read', 'profile:read'] |
| last_used_at | TIMESTAMPTZ NULL | Updated on each successful use |
| created_at | TIMESTAMPTZ DEFAULT NOW() | — |
| revoked_at | TIMESTAMPTZ NULL | NULL = active |

> The live `user_api_tokens` table matches this shape and adds one more column not in this spec: `token_prefix` — the first 8 characters of the raw token, stored and indexed so `POST /api/v1/checkin` can do an O(1) prefix lookup before bcrypt comparison, rather than an O(n) scan (CLAUDE.md Key Invariant #9, `docs/architecture/HLD.md` §4.6).

### Token-based check-in API — v1 infrastructure, v2 public launch
Endpoint: POST /api/v1/checkin
Authentication: Bearer token in Authorization header
Request body: same as user check-in (gps_lat, gps_lng, wifi_ssid, note, event_type)
Behaviour: identical to user check-in. Event saved with source = 'api_token', api_token_id = token.id

The token API is built in v1 but not publicly documented until v2. It is used internally for testing and the CoWork integration preview. Public launch with documentation in v2.

### AI automation flow (v2 — built on v1 token infrastructure)
The vision: user says "mark me present" to an AI assistant (CoWork, Claude, any MCP client). The AI calls the Venzio API with the user's personal token. The event is recorded. The user never opens the Venzio app.

- User generates a token in Venzio Settings → API Tokens → "Create new token" → names it "CoWork Agent"
- User pastes the token into their CoWork or Claude MCP configuration (one-time setup)
- User tells CoWork: "Mark me present at the office"
- CoWork calls POST /api/v1/checkin with Bearer [token], gps from device, note = "Marked via CoWork"
- Event saved with source = api_token, api_token_id = token.id
- User sees the check-in in their Venzio timeline labelled with the token name: "Checked in via CoWork Agent"
- Org dashboard sees the event with source = api_token — flagged for transparency, counted normally

Token-based check-ins are fully transparent to the user. They see which token created which event. Orgs see the source field. Nothing is hidden.

## Gamification and Engagement Architecture

The goal is for users to open Venzio because they want to, not because their employer requires it. The architecture enables this from v1. The gamification UI ships in v2.

### What ships in v1 — data foundation
- user_stats materialized view: current_streak, longest_streak, total_checkins, total_hours_logged, checkins_this_month, distinct_locations_this_month
- Refreshed after every check-in (via Supabase edge function or trigger) and nightly
- The home screen shows raw versions of these stats (N days this month, N hours) — not gamified yet, but data is live
- Event notes encourage habit formation: pre-populated chips make noting a visit take 1 tap

### What ships in v2 — the engagement layer
- Streak display: prominent streak counter on home screen ("12 day streak!") with flame icon
- Streak freeze: if user misses one day, streak preserved with a "freeze" (limit: 2 per month — like Duolingo)
- Monthly presence badge: "You've been in office 15+ days this month" — shareable card
- Personal best notifications: "New record — 8 locations visited this month!"
- Weekly summary: Sunday evening notification showing week's presence, hours, streak
- Presence score: a single number that represents overall presence consistency. Algorithm in v2 design.

### What ships in v3 — the full productivity layer
- Focus sessions: Pomodoro-style timer. User starts a 25-minute session — creates a focus_session event. On completion: checkout_at set, 5-min break counted.
- Habit tracking: user defines habits (gym, reading, meditation). Daily tap to log. Streaks per habit.
- Day summary: end-of-day push notification showing: time at office, focus sessions, habits completed
- Calendar context: read Google Calendar events and show them alongside presence timeline — "You had 3 meetings today and 2 focus sessions. Here's your full day."
- AI insights (v3+): "Your most productive days are Tuesdays when you arrive before 9:30 AM." — derived from presence + focus session correlation.

The productivity features are a user retention and engagement strategy, not a core business feature. They exist to make Venzio a daily-open app so that the check-in happens as a natural side effect of using the app the user already loves.

> ⚠️ **Status check:** None of the v3 productivity layer (focus sessions, habit tracking, calendar sync) exists in the codebase, consistent with this being marked "v3." A separate rename-era planning document (`VENZIO_RENAME_AND_SPACE.md`) specced a "Space" tab with Notes/To-dos/Pomodoro under `/me/space`, but no such route exists under `src/app/me/` today — it remains unbuilt.

## Global Scope — What the Platform Handles and What It Does Not

### What the platform handles
- Timezones: UTC storage, IANA timezone display, per-org and per-user timezone settings — covered fully
- Date formats: ISO 8601 in API, locale-formatted in UI using Intl.DateTimeFormat
- Currency: INR in v1. USD/EUR/GBP tiers added when expanding internationally — pricing configured per region in Razorpay
- Language: English v1. Internationalisation (i18n) structure built into Next.js from start (next-intl library) — translations added later
- Character encoding: UTF-8 everywhere — handles all scripts including Devanagari, Arabic, CJK

> ⚠️ **Status check:** The i18n approach described (`next-intl` library) is not what's in the codebase. Copy lives in a hand-rolled `src/locales/en.ts` with nested keys, imported directly as `en` — no `next-intl` dependency (CLAUDE.md "Copy (strings)"). There is also no Razorpay integration for currency/region pricing today.

### What the platform deliberately does not handle
- Labour law compliance: Venzio provides data. What constitutes a valid work day, minimum hours, overtime — entirely the org's responsibility under their jurisdiction's law
- Tax calculation: not a payroll engine. Data pipe only.
- Legal entity verification: we verify domain ownership, not company registration. GST/CIN/company number fields are optional metadata only.

Venzio's terms of service explicitly state that compliance with local labour laws, data protection regulations, and employment standards is the responsibility of the subscribing organisation. Venzio provides the data layer — interpretation and compliance is theirs.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Check-in write: < 300ms end-to-end. Dashboard query for 200 employees: < 1.5s. CSV generation: < 5s for full 12-month dataset. user_stats view refresh: < 100ms via trigger. |
| Uptime | 99.5% monthly. Vercel + Supabase SLAs. |
| Data integrity | presence_events: no UPDATE, no DELETE permitted (except 7-year retention cron and user account deletion). All other data changes are additive. admin_overrides are new records, never edits. |
| Security | TLS 1.3. OAuth only — no passwords. wifi_ssid stored as bcrypt hash. API tokens stored as bcrypt hash (plaintext shown once at creation only). JWT in httpOnly cookies. |
| Privacy | User controls all consent. Can revoke any org access anytime. Can download full personal data as JSON. Can request account deletion. Can see which orgs have access to their data. |
| Data retention | 7-year hard maximum. Nightly deletion cron. 30-day user notification before deletion. Account deletion: 30-day grace then hard delete. |
| Scalability | presence_events grows ~3 rows/user/day. At 10,000 users after 1 year: ~11M rows. PostgreSQL + GIST index handles geospatial queries at this scale. Supabase Pro supports 500GB+. |
| Browser | Android Chrome 90+: full (GPS + WiFi + IP). Desktop Chrome 90+: full. iOS Safari 15+: GPS + IP (WiFi unavailable — logic adapts). Firefox: GPS + IP (no WiFi SSID API). |
| Internationalisation | UTF-8 everywhere. IANA timezone support. next-intl structure in place from v1 even if only English translations exist. |

> ⚠️ **Status check:** "Security: OAuth only — no passwords" is inaccurate today — auth is email + bcrypt password (cost 12, min 8 chars) plus OTP verification (CLAUDE.md "Auth System"). JWT-in-httpOnly-cookie is accurate (`cm_session`, `cm_otp_ok`). "wifi_ssid stored as bcrypt hash" describes the *workspace signal config* hash, not the raw event column — `presence_events.wifi_ssid` still stores the user's own raw SSID string as their personal record (see the PRD's own presence_events table above), while the workspace's registered SSID is the bcrypt-hashed side of the comparison.

## Long-Term Vision — Encoded in Architecture Today

Every architectural decision in v1 is made with the 3-year vision in mind. The schema does not need to change to support what is coming.

| v1 decision | What it enables in v2/v3 |
|---|---|
| event_type enum from day 1 | Adding focus_session and habit_log in v3 requires no schema change — just new enum values |
| source column on presence_events | API token events, AI agent events, admin overrides all distinguishable from day 1. Audit trail is complete. |
| No workspace_id on events | One user's events serve unlimited orgs simultaneously. Multi-org model works without any schema change. |
| api_token_id FK column (v1, nullable) | AI automation layer (CoWork, MCP, browser agent) plugs in via the token column that is already there |
| user_stats materialized view | Gamification, streaks, presence score, and productivity insights all read from this view — no new computation needed |
| UTC everywhere | Global launch requires zero data migration — timestamps are already correct |
| 7-year retention defined upfront | Compliance-grade product from day 1 — no retroactive policy awkwardness |
| note field on events | Client visit labels, focus session topics, habit names — all stored in the same field with event_type as discriminator |

---

*Document owner: Founding Team | PRD v5.0 Final | March 2026*
*This document is the authoritative specification. Hand docs 04, 07, and 10 together to Claude Code to start building.*
