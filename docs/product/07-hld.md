# High-Level Design

**Venzio — Presence Intelligence Platform**
*Venzio v1.0 — System architecture, schema, and key technical decisions*
Source: `07_hld_final.docx` — v2.0 Final, March 2026

---

## Architecture Overview

Venzio is a full-stack Next.js application (frontend + API routes in one repo) deployed on Vercel, backed by Supabase-managed PostgreSQL. The architecture is deliberately monolithic for MVP — one repo, one deployment, zero infrastructure to manage. The sole developer can focus entirely on product logic.

The most important architectural decision: presence_events has no workspace_id or company_id. Events are user-owned. Org context is applied at query time, not write time. This single decision enables multi-org per user, user-owned history, and the config-light field force model simultaneously.

> ⚠️ **Status check:** The monolithic Next.js-on-Vercel shape is accurate, but the datastore is not Supabase/PostgreSQL. The actual DB abstraction (`src/lib/db/index.ts`) runs on **better-sqlite3 in dev, Turso (libSQL) in production** — no Supabase project, no PostgreSQL, no Supabase Auth, no Row Level Security (`docs/architecture/HLD.md` §6 "Technology Choices"). The "no workspace_id on presence_events, org context at query time" decision is exactly correct and unchanged — it remains the platform's most important invariant today (CLAUDE.md Principle #3, PROJECT_HANDOFF_SUMMARY.md §1).

## System Components

### Frontend — Next.js 14 PWA
- Single codebase for both user-facing and admin-facing views
- PWA manifest — installable on Android Chrome home screen, desktop Chrome, bookmarkable on iOS
- Two primary views: User home (check-in, personal timeline) and Org dashboard (query results, user profiles)
- Tailwind CSS — utility-first, no component library to minimise bundle
- Browser APIs used: Geolocation API (GPS), NetworkInformation API (WiFi SSID — desktop + Android Chrome only), Fetch API
- Map preview during org setup: Leaflet.js with OpenStreetMap tiles — free, no API key
- User profile map view: same Leaflet embed showing GPS pin per event

> ⚠️ **Status check:** The framework version has moved on — the app runs on **Next.js 16** today, not Next.js 14 (`docs/architecture/HLD.md` §6). Tailwind, the two-PWA split (`/me/*`, `/ws/:slug/*`), and the no-component-library rule are all still accurate (CLAUDE.md "Design System").

### Backend — Next.js API Routes (Node.js on Vercel)
- API routes co-located with frontend — single deployment on Vercel serverless
- IP geolocation: ip-api.com free tier (10,000 requests/month — sufficient for MVP at < 300 check-ins/day)
- WiFi SSID hashing: bcrypt with cost factor 10 on registration. Comparison: hash incoming SSID and compare to stored hash.
- Haversine distance calculation for GPS geofence check — pure JavaScript, no external dependency
- Domain verification: Resend.com for transactional email (free tier: 100 emails/day)

> The live codebase uses bcrypt cost **12** for both passwords and WiFi SSID hashing (CLAUDE.md "Auth System"), not cost 10 as specced here — a minor strengthening, not a regression.

### Database — PostgreSQL via Supabase
- Managed PostgreSQL — automatic backups, connection pooling, row-level security
- Supabase Auth: Google OAuth 2.0 provider, JWT tokens in httpOnly cookies
- Row Level Security (RLS): users can only read/write their own presence_events
- Supabase free tier (500MB) sufficient for MVP. Pro ($25/month) when user base grows.

> ⚠️ **Status check:** None of this section reflects the shipped database. There is no Supabase, no managed Postgres, no Google OAuth, and no RLS policies. Auth is custom: JWT (via `jose`) issued after email + bcrypt-password login (with OTP verification for new accounts), stored in an httpOnly `cm_session` cookie, checked server-side via `getSessionFromCookies()` against a `revoked_tokens` table for revocation (CLAUDE.md "Auth System"; `docs/architecture/HLD.md` §4.2, §6). Access control is enforced in application code (`requireWsAdmin()`, `WHERE workspace_id = ?` on every query) rather than database-level RLS.

### Infrastructure — Total Cost

| Service | Usage | Cost |
|---|---|---|
| Vercel | Frontend + API serverless functions | Free tier → Pro $20/month at scale |
| Supabase | PostgreSQL + Auth + Storage | Free tier → Pro $25/month at scale |
| ip-api.com | IP geolocation lookups | Free (10k/month) → $15/month at scale |
| Resend.com | Transactional email | Free (100/day) → $20/month at scale |
| OpenStreetMap Nominatim | Address search for org setup | Free — usage policy compliant |
| Total MVP cost | — | ₹0/month |

## Complete Database Schema

### users

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | Supabase Auth UID |
| email | TEXT NOT NULL UNIQUE | — |
| full_name | TEXT | From Google profile |
| avatar_url | TEXT NULL | From Google profile |
| created_at | TIMESTAMPTZ DEFAULT NOW() | — |

> ⚠️ **Status check:** The live `users` table (`docs/architecture/HLD.md` §3) additionally carries `password_hash`, `timezone`, and `deleted_at` (soft delete) — none of which fit an "id is the Supabase Auth UID, no password" model. This is the schema-level consequence of the OAuth-vs-password drift noted above.

### presence_events — the core table

| Column | Type | Notes |
|---|---|---|
| id | UUID PK DEFAULT gen_random_uuid() | — |
| user_id | UUID NOT NULL FK → users(id) | ON DELETE CASCADE |
| event_type | TEXT NOT NULL DEFAULT 'office_checkin' | Enum: office_checkin \| client_visit \| manual_log |
| checkin_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | — |
| checkout_at | TIMESTAMPTZ NULL | NULL = no checkout. Duration computed, never stored. |
| note | TEXT NULL | Optional user-provided context |
| wifi_ssid | TEXT NULL | Raw SSID string. NULL on iOS or unavailable. |
| ip_address | INET NOT NULL | Server-side extraction |
| ip_geo_lat | DECIMAL(10,7) NULL | From ip-api.com at check-in time |
| ip_geo_lng | DECIMAL(10,7) NULL | — |
| gps_lat | DECIMAL(10,7) NULL | From browser Geolocation API. NULL if denied. |
| gps_lng | DECIMAL(10,7) NULL | — |
| gps_accuracy_m | INTEGER NULL | Browser-reported accuracy in metres |

Critical indexes:
- `CREATE INDEX idx_presence_user_time ON presence_events(user_id, checkin_at DESC)`
- `CREATE INDEX idx_presence_checkin_at ON presence_events(checkin_at DESC)`
- `CREATE INDEX idx_presence_gps ON presence_events(gps_lat, gps_lng) WHERE gps_lat IS NOT NULL`

NO hours_in_office column. Computed always as: `EXTRACT(EPOCH FROM (checkout_at - checkin_at)) / 3600.0` — returns NULL if checkout_at is NULL.

> ⚠️ **Status check:** See the fuller callout in `04-prd.md` — the live table has grown substantially: checkout-side signals (`checkout_gps_lat/lng`, `checkout_wifi_ssid`, `checkout_location_mismatch`), `scheduled_checkout_at`, `checkout_reason`, `location_label`, `device_info`, `device_timezone`, `source`, `api_token_id`, and trust columns (`trust_flags`; `trust_score` per `Instruction-Native-App.md`). The "no `hours_in_office`, always computed" rule is unchanged.

### workspaces

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| name | TEXT NOT NULL | Company name |
| plan | TEXT NOT NULL DEFAULT 'free' | free \| starter \| growth |
| created_at | TIMESTAMPTZ DEFAULT NOW() | — |
| domain_verified | BOOLEAN DEFAULT FALSE | Must be true before any user data is visible |

> The live `workspaces` table also has `slug` (unique, used for `/ws/:slug` routing), `org_type`, `timezone`, and `archived_at` (soft delete) — see `docs/architecture/HLD.md` §3.

### workspace_domains

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| workspace_id | UUID FK → workspaces(id) | — |
| domain | TEXT NOT NULL | e.g., acmecorp.com |
| verified_at | TIMESTAMPTZ NULL | NULL = not yet verified |
| verification_token | TEXT NULL | One-time email token |

### workspace_employees

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| workspace_id | UUID FK → workspaces(id) | — |
| user_id | UUID FK → users(id) | — |
| email | TEXT NOT NULL | Stored for pending-consent users who have not yet signed up |
| status | TEXT NOT NULL DEFAULT 'active' | active \| pending_consent \| declined \| revoked |
| added_at | TIMESTAMPTZ DEFAULT NOW() | — |
| consent_token | TEXT NULL | Token sent in consent email |

> This table is named `workspace_members` in the live schema, with the same status enum plus `role` (member/admin), `consent_token_expires_at`, and `joined_at`.

### workspace_signal_config

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| workspace_id | UUID FK → workspaces(id) | — |
| signal_type | TEXT NOT NULL | wifi \| gps \| ip |
| location_name | TEXT NULL | Human label: "WeWork Gurugram" |
| wifi_ssid_hash | TEXT NULL | bcrypt hash of SSID. Only for signal_type = wifi. |
| gps_lat | DECIMAL(10,7) NULL | Anchor point for GPS geofence |
| gps_lng | DECIMAL(10,7) NULL | — |
| gps_radius_m | INTEGER NULL DEFAULT 300 | Geofence radius in metres |
| ip_geo_lat | DECIMAL(10,7) NULL | Resolved coordinates of registered IP context |
| ip_geo_lng | DECIMAL(10,7) NULL | — |
| created_at | TIMESTAMPTZ DEFAULT NOW() | — |

### admin_overrides

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| workspace_id | UUID FK → workspaces(id) | — |
| presence_event_id | UUID FK → presence_events(id) | Which event is being counted |
| admin_user_id | UUID FK → users(id) | Who made the override |
| note | TEXT NULL | Optional reason |
| created_at | TIMESTAMPTZ DEFAULT NOW() | — |

## The Dashboard Query — Exact SQL Pattern

This query powers the org dashboard. It is the core of the read layer.

Config-heavy org (has signal config):
```sql
SELECT pe.*, we.workspace_id FROM presence_events pe
JOIN workspace_employees we ON pe.user_id = we.user_id
  AND we.workspace_id = :workspace_id AND we.status = 'active'
WHERE (
  -- WiFi match
  EXISTS (SELECT 1 FROM workspace_signal_config wsc
    WHERE wsc.workspace_id = :workspace_id AND wsc.signal_type = 'wifi'
    AND wsc.wifi_ssid_hash = crypt(pe.wifi_ssid, wsc.wifi_ssid_hash))
  OR
  -- GPS geofence match
  EXISTS (SELECT 1 FROM workspace_signal_config wsc
    WHERE wsc.workspace_id = :workspace_id AND wsc.signal_type = 'gps'
    AND haversine(pe.gps_lat, pe.gps_lng, wsc.gps_lat, wsc.gps_lng) < wsc.gps_radius_m)
  OR
  -- IP proximity match
  EXISTS (SELECT 1 FROM workspace_signal_config wsc
    WHERE wsc.workspace_id = :workspace_id AND wsc.signal_type = 'ip'
    AND haversine(pe.ip_geo_lat, pe.ip_geo_lng, wsc.ip_geo_lat, wsc.ip_geo_lng) < 500)
)
-- Plan gate applied in application layer before query executes
```

Config-light org (no signal config): same query but the WHERE clause is empty — returns ALL events for enrolled users.

> ⚠️ **Status check:** This `OR`-chained SQL pattern is not how the live query works, and this is the platform's single largest documentation-vs-reality gap. The current implementation is TypeScript, not raw SQL (per CLAUDE.md's "No raw SQL in routes" principle), and requires **every** configured signal type to match — `src/lib/signals.ts`:
> ```ts
> const allMatched = configuredTypes.size > 0 && [...configuredTypes].every(t => matched.has(t))
> const matched_by = allMatched ? 'verified' : anyMatched ? 'partial' : 'none'
> ```
> Only `gps` and `ip` are ever added to `configuredTypes` — WiFi is captured and hashed but not part of matching today. The config-light fallback (no signal config → all events pass through) is accurately described.

## Key Architectural Decisions

### Decision 1: No workspace_id on presence_events
Consequence: one user's events serve unlimited orgs simultaneously. User-owned history is permanent regardless of org relationship. Config-light orgs work naturally — they see everything. The architecture was designed for this from the start.

### Decision 2: No hours_in_office stored column
Hours are always computed from checkout_at - checkin_at. Storing them would create sync issues. NULL checkout = NULL duration for that event. This is not an error state — it is expected for the day's last event and for users who forgot to check out.

### Decision 3: Multiple events per day, no daily constraint
Removing the one-per-day constraint unlocks the field force use case with zero additional complexity. The schema naturally supports any number of check-ins per day.

### Decision 4: event_type enum from day one
Starting with event_type = 'office_checkin' | 'client_visit' | 'manual_log' in v1 means adding 'focus_session' and 'habit_log' in v3 is a non-breaking addition. No schema migration needed.

### Decision 5: Monolith over microservices
One Next.js repo. One Vercel deployment. One Supabase project. Split into services only when a specific component needs independent scaling — not before.

> Decisions 1–4 remain accurate and are the load-bearing architecture of the product today. Decision 5's "one Supabase project" detail is the exception — see the database drift callout above.

## Security Decisions

- WiFi SSID: bcrypt-hashed on registration. Comparison uses crypt() in PostgreSQL. Plaintext never stored after initial hash.
- GPS coordinates: stored as exact coordinates for admin verification use. Disclosed in user onboarding. Users can see which orgs have access to their data.
- presence_events: no UPDATE, no DELETE ever permitted on this table. Supabase RLS policy enforces this at database level.
- Admin overrides: additive records only. The original event is immutable.
- JWT: stored in httpOnly cookies. Not accessible to JavaScript.
- RLS: users can only SELECT their own presence_events. Org dashboard query runs with admin JWT that has elevated select policy.

> ⚠️ **Status check:** Immutability of `presence_events` and additive-only `admin_overrides` both hold true today, but they are enforced by **application-level discipline** (query functions in `lib/db/queries/` never issue UPDATE/DELETE against the table, except the `note` field), not by a database RLS policy — there is no Postgres, so no RLS exists. "crypt() in PostgreSQL" doesn't apply either; SSID comparison uses Node's `bcrypt.compare()` (CLAUDE.md "Auth System"; `docs/architecture/signal-matching.md` §9).

---

*Document owner: Engineering (Founding Team) | HLD v2.0 Final | March 2026*
