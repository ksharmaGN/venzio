# Venzio — Presence Intelligence Platform

> **Know where your team is. Own where you've been.**

Venzio is a full-stack Next.js application with two PWA surfaces:

- **User side** (`/me/*`) — mobile-first, individuals record their own presence
- **Org side** (`/ws/:slug/*`) — desktop-first, companies query presence data

---

## Tech Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript)                               |
| Database   | `better-sqlite3` in dev → `@vercel/postgres` / Neon in production |
| Auth       | Custom — email + password, OTP via `jose` + `bcryptjs`            |
| Styling    | Tailwind CSS v4 — utility only, no component libraries            |
| Email      | Resend (OTP, consent emails)                                      |
| Deployment | Vercel                                                            |

---

## Project Structure

```
src/
├── app/
│   ├── (public)/               # Marketing + auth — no auth required
│   │   ├── layout.tsx          # Passthrough layout for public routes
│   │   ├── login/page.tsx      # /login — 6-state auth flow
│   │   ├── for-teams/page.tsx  # /for-teams — org admin marketing page
│   │   ├── for-you/page.tsx    # /for-you — individual user marketing page
│   │   ├── pricing/page.tsx    # /pricing — plan cards + FAQ
│   │   ├── open-source/page.tsx# /open-source — OSS info + self-host guide
│   │   ├── privacy/page.tsx    # /privacy — full privacy policy
│   │   └── terms/page.tsx      # /terms — full terms of service
│   ├── me/                     # User PWA — requires session
│   │   ├── layout.tsx          # Header + bottom nav
│   │   ├── page.tsx            # /me — home (check-in, stats, orgs strip)
│   │   ├── timeline/page.tsx   # /me/timeline — event history with date filters
│   │   ├── orgs/               # /me/orgs — workspace memberships
│   │   │   ├── page.tsx
│   │   │   └── OrgsClient.tsx
│   │   └── settings/page.tsx   # /me/settings — profile, password, tokens, danger
│   ├── ws/                     # Org PWA — requires admin session
│   │   ├── layout.tsx          # Passthrough
│   │   ├── page.tsx            # /ws — workspace picker (multi-workspace admins)
│   │   └── [slug]/
│   │       ├── layout.tsx      # Header + nav tabs (Dashboard | People | Insights | Settings)
│   │       ├── page.tsx        # /ws/:slug — Dashboard (Today + Analytics)
│   │       ├── TodayClient.tsx       # Real-time attendance table + filters
│   │       ├── AnalyticsClient.tsx   # Date-range analytics table
│   │       ├── InsightsClient.tsx    # Interval charts (Today/Week/Month/…/Year)
│   │       ├── insights/page.tsx     # /ws/:slug/insights server wrapper
│   │       ├── people/
│   │       │   ├── page.tsx    # /ws/:slug/people — server wrapper (auth check)
│   │       │   └── PeopleClient.tsx  # Member list + invite + transfer ownership (client)
│   │       └── settings/
│   │           └── page.tsx    # /ws/:slug/settings — workspace details + domain + restore/archive
│   └── api/
│       ├── auth/
│       │   ├── check-email/route.ts    # POST — email existence check
│       │   ├── login/route.ts          # POST — email check + password verify
│       │   ├── otp/send/route.ts       # POST — send OTP
│       │   ├── otp/verify/route.ts     # POST — verify OTP + set cm_otp_ok cookie
│       │   ├── register/route.ts       # POST — create account (personal or org)
│       │   ├── reset-password/route.ts # POST — OTP-gated password reset
│       │   └── logout/route.ts         # POST — clear session
│       ├── workspace/
│       │   ├── route.ts                # GET admin workspaces · POST create (max 1)
│       │   └── check-slug/route.ts     # POST — slug availability check
│       ├── ws/
│       │   └── [slug]/
│       │       ├── route.ts                          # GET workspace · PATCH name/timezone
│       │       ├── archive/route.ts                   # POST — archive workspace (admin, soft)
│       │       ├── restore/route.ts                   # POST — restore archived workspace
│       │       ├── analytics/route.ts                 # GET — date-range analytics per member
│       │       ├── dashboard/route.ts                 # GET — today's real-time attendance
│       │       ├── insights/route.ts                  # GET — time-bucketed check-in data
│       │       ├── transfer-ownership/route.ts        # POST — OTP-gated admin transfer
│       │       ├── domain/route.ts                   # GET domains · POST add domain
│       │       ├── domain/[domainId]/route.ts         # DELETE domain
│       │       ├── domain/[domainId]/verify/route.ts  # POST — DNS TXT verification
│       │       ├── members/route.ts                   # GET all members · POST invite
│       │       └── members/[memberId]/route.ts        # DELETE member
│       ├── checkin/
│       │   ├── route.ts                # POST — create presence event
│       │   ├── checkout/route.ts       # POST — check out of most recent open event
│       │   └── extend/route.ts         # POST — extend auto-checkout by +8h
│       ├── push/
│       │   ├── subscribe/route.ts      # POST/DELETE — manage push subscriptions
│       │   └── vapid-public-key/route.ts # GET — VAPID public key
│       ├── events/
│       │   ├── route.ts                # GET — user's events (paginated, date-filtered)
│       │   └── [id]/route.ts           # PATCH note · DELETE returns 405 (data never deleted)
│       ├── me/
│       │   ├── route.ts                # GET profile · PATCH name · DELETE account
│       │   ├── password/route.ts       # POST — change password
│       │   ├── consent/route.ts        # POST — accept/decline workspace invite
│       │   └── workspaces/[workspaceId]/route.ts  # DELETE — leave workspace
│       └── tokens/
│           ├── route.ts                # GET list · POST create (returns plain token once)
│           └── [id]/route.ts           # DELETE — revoke
├── app/manifest.ts             # PWA manifest
├── lib/
│   ├── db/
│   │   ├── index.ts       # DB abstraction (SQLite ↔ Postgres)
│   │   ├── schema.ts      # All CREATE TABLE statements
│   │   └── queries/       # One file per domain — no raw SQL in routes
│   │       ├── users.ts
│   │       ├── events.ts
│   │       ├── workspaces.ts
│   │       ├── signals.ts
│   │       ├── stats.ts
│   │       ├── tokens.ts  # API token queries
│   │       └── push.ts    # Push subscription queries
│   ├── auth.ts            # JWT, cookies, bcrypt, OTP, getServerUser(), OTP cookie
│   ├── email.ts           # Resend email helpers (OTP + consent)
│   ├── geo.ts             # Haversine, IP geolocation, extractIp()
│   ├── timezone.ts        # UTC ↔ IANA timezone helpers
│   ├── plans.ts           # Plan limits (free / starter / growth)
│   ├── signals.ts         # Core dashboard query (signal matching)
│   ├── stats.ts           # User stats computation
│   ├── slug.ts            # validateSlug() — shared across check-slug, register, workspace
│   ├── password.ts        # validatePassword() — shared across register, me/password
│   ├── push.ts            # Server-side Web Push (VAPID) utility
│   └── midnight.ts        # Next midnight UTC helper
├── components/
│   ├── marketing/
│   │   ├── MarketingNav.tsx    # Sticky nav: logo, centre links, Sign in / Get started
│   │   └── MarketingFooter.tsx # Footer with all marketing page links
│   └── user/
│       ├── BottomNav.tsx       # Fixed bottom nav (client — uses usePathname)
│       ├── CheckinButtons.tsx  # "I'm here" + "I'm leaving" (client — GPS + API)
│       └── EventCard.tsx       # Presence event card with inline note edit (client)
├── proxy.ts               # Route protection (Next.js 16 — previously middleware.ts)
public/
└── sw.js                  # Service worker — push notifications + notification click actions
scripts/
└── migrate.js             # DB migration runner (plain Node.js)
```

---

## Local Development Setup

### 1. Prerequisites

- Node.js 20+
- npm 10+

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Edit `.env.local` (already exists with template values):

```bash
# Leave empty → uses SQLite at ./venzio.db (recommended for local dev)
TURSO_DATABASE_URL=xxxxxx
TURSO_AUTH_TOKEN=xxxxxx
# Generate a secret: openssl rand -base64 32
JWT_SECRET=your-random-32-char-secret

# Get a free key at resend.com — needed for OTP emails
# In dev, OTPs are also printed to console if key is missing
RESEND_API_KEY=re_xxxxxxxxxxxx

# Base URL of the app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the database migration

Creates (or updates) `venzio.db` with all tables:

```bash
node scripts/migrate.js
```

Expected output:

```
✓ Migration complete — ran 13 statement(s) against /path/to/venzio.db
```

### 5. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## Database

### Schema (13 tables + 5 column additions)

| Table                     | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `users`                   | User accounts — email, password hash, name                          |
| `otp_codes`               | 6-digit OTPs for signup and verification                            |
| `user_api_tokens`         | Personal API tokens for programmatic check-ins                      |
| `presence_events`         | Core table — every check-in/check-out, GPS, IP                      |
| `workspaces`              | Organisations — slug, name, plan, org_type, timezone, `archived_at` |
| `workspace_domains`       | Email domains for auto-enrolment                                    |
| `workspace_members`       | User ↔ workspace membership, role, consent status                   |
| `workspace_signal_config` | GPS / IP signal configs for presence matching                       |
| `admin_overrides`         | Additive admin overrides — audit log, never modifies events         |
| `user_stats`              | Pre-computed streaks, totals — upserted after every check-in        |
| `revoked_tokens`          | Invalidated JWT IDs (jti) — checked on every authenticated request  |
| `push_subscriptions`      | Web Push endpoint + VAPID keys per user/device                      |
| `rate_limit_log`          | Sliding-window rate limit log (IP-keyed for login, user-keyed for checkin) |

The migration runner is idempotent. `ALTER TABLE` column additions are wrapped in try/catch so re-running is always safe:

```bash
node scripts/migrate.js
```

### Inspect the database (dev)

```bash
# Open interactive shell
npx better-sqlite3-cli venzio.db

# Or with sqlite3 if installed
sqlite3 venzio.db ".tables"
sqlite3 venzio.db ".schema users"
```

---

## Auth System

- **Tokens:** JWT via `jose`, 30-day expiry, stored in `httpOnly; SameSite=Lax` cookie `cm_session`. Each JWT carries a unique `jti` claim (UUID).
- **Revocation:** On logout, the `jti` is inserted into `revoked_tokens` with its expiry timestamp. `getSessionFromCookies()` checks revocation before returning a session; expired rows are pruned periodically via `pruneRevokedTokens()`. Middleware (Edge runtime) does signature-only verification; revocation is enforced in Node.js route handlers and server components.
- **Passwords:** `bcryptjs` at cost factor 12, minimum 8 characters
- **OTP:** 6-digit code, 10-minute expiry, single-use, max 5 attempts before lockout, max 3 sends per 15 minutes per email
- **OTP verification cookie:** short-lived 15-min signed JWT (`cm_otp_ok`) set after OTP verify — prevents client-side trust of `otpVerified: true`
- **CSRF:** `SameSite=Lax` on `cm_session` — `Strict` was causing session loss on PWA cold-opens on Android and iOS (PWA-to-browser cross-origin navigation). `Lax` still blocks cross-site POST mutations; only same-site GET navigations carry the cookie cross-origin.

### Login / Registration flow

```
Email input
    │
    ├─ Email exists ──────────────▶ Password ──▶ Sign in ──▶ redirect
    │                                   │
    │                              Forgot password?
    │                                   │
    │                         OTP sent to email (forgotPassword)
    │                                   │
    │                         OTP verified (cm_otp_ok cookie)
    │                                   │
    │                         Enter new password (resetPassword)
    │                                   │
    │                              Password updated ──▶ redirect
    │
    └─ Email not found ───────────▶ OTP sent to email
                                         │
                                    OTP verified (sets cm_otp_ok cookie)
                                         │
                                    Account type selection
                                         │
                              ┌──────────┴──────────┐
                         Personal              Organisation
                              │                     │
                         Name + password      Org name, URL handle,
                              │               domain + name + password
                              └──────────┬──────────┘
                                    Account created ──▶ redirect
```

### Post-login routing

| Condition              | Redirects to |
| ---------------------- | ------------ |
| Admin of 1 workspace   | `/ws/:slug`  |
| Admin of 2+ workspaces | `/ws`        |
| No admin role          | `/me`        |

---

## Plans

| Plan      | Max users | History   | Locations | CSV export |
| --------- | --------- | --------- | --------- | ---------- |
| `free`    | 10        | 3 months  | 1         | No         |
| `starter` | Unlimited | 12 months | 1         | Yes        |
| `growth`  | Unlimited | 7 years   | 5         | Yes        |

Plan limits are enforced server-side in `lib/plans.ts`.

---

## User PWA — `/me/*`

All routes require a valid session cookie. The proxy redirects to `/login` if missing.

### `/me` — Home

Server-rendered shell + client-rendered state. Shows:

- Today's date (client local timezone) + status line — `"Checked in at 10:15 AM on 17 Mar 2026"` or `"Not checked in yet"` — client-rendered only, always in browser timezone.
- **"I'm here"** button (64px, full width) — visible only when CHECKED_OUT. Triggers GPS collection → check-in API call.
- **"I'm leaving"** button — visible only when CHECKED_IN. Triggers GPS collection → checkout API call.
- Three stat chips: **days / hrs / places** this calendar month
- Today's check-in list (server-rendered, refreshed via `router.refresh()` after mutations)
- Workspace strip: each workspace the user is active in, with days count

**GPS flow in CheckinButtons:** `navigator.geolocation.getCurrentPosition()` is called on button tap. If denied, check-in still proceeds with null GPS — a toast explains why.

**Stale check-in notifications:** On first check-in, the browser is asked for Notification permission. If granted, Web Push notifications are sent at 4h, 8h, 12h, 16h, 18h, 20h, 22h from check-in time. At T+12h a 15-minute warning is sent with a "Still here? Extend by 8h" action. Auto-checkout fires at T+12h from check-in via `POST /api/checkin/checkout` with `reason: maximum_hours_exceeded`. The reason is stored in `presence_events.checkout_reason`. Notification timers are cancelled on manual checkout.

### `/me/timeline`

Client component. Fetches from `GET /api/events`. Features:

- Date range pickers (default: current month, resets on page load)
- Events grouped by date, newest first
- Inline note editing on any event
- Notes editable inline on any event — presence data is never deleted

### `/me/orgs`

Server + client split. Shows:

- **Pending consent invites** — Accept / Decline buttons
- **Active workspace memberships** — with Leave button (blocked if sole admin)

### `/me/settings`

Client component with four sections:

- **Profile** — update display name
- **Password** — change with current password verification
- **API Tokens** — create named tokens (plain token shown once), revoke existing
- **Danger zone** — delete account (cascade-deletes all data via FK constraints)

---

## Org PWA — `/ws/:slug/*`

All routes require a valid session cookie AND admin membership of the workspace. Non-admins are redirected to `/me`. Non-existent slugs return 404.

### `/ws` — Workspace picker

Always accessible to authenticated users (never auto-redirects). Shows:

- **Active workspaces** — clickable cards
- **Archived workspaces** — greyed out with "Archived" badge (still accessible)
- **Big "+" create button** — always visible, opens the workspace creation form inline

### `/ws/:slug/people` — People tab

Server + client split. Features:

- **Member list** — all statuses (active, invite sent, declined), avatar initials, role badge
- **Status badges:** Active (teal), Invite sent (amber), Declined (red)
- **Invite form** — send consent email to any address; shows error if already an active member
- **Remove member** — disabled for admin roles

### `/ws/:slug/settings` — Settings tab

Full client component (uses `useParams` + `useCallback`). Two sections:

- **Workspace details** — edit name + timezone (PATCH `/api/ws/:slug`)
- **Email domain verification** — add domains, view DNS TXT records with copy buttons, check DNS verification status

---

## Domain Verification

Admins add a domain (e.g. `acme.com`) in the Settings tab. Venzio generates a DNS TXT record:

```
Name:  _venzio-verify.acme.com
Value: venzio-verify=<token>
```

The token is deterministic: `HMAC-SHA256("domain-verify:{workspaceId}:{domain}", JWT_SECRET)` (first 32 hex chars). No extra DB column needed — recomputed on each verify request.

Once DNS propagates, clicking "Check verification" calls `POST /api/ws/:slug/domain/:id/verify`, which resolves the TXT record and marks the domain verified.

**Auto-enrolment:** When a verified domain matches a user's email on `/join/:slug`, they are automatically added as an active member without needing an explicit invite.

---

## Consent Flow

Two paths to membership consent:

### Email link (non-users / non-logged-in)

1. Admin invites `colleague@company.com` from People tab
2. Consent email sent with links: `Accept` / `Decline`
3. **Decline** — resolves token, marks member declined, no login required
4. **Accept (logged in)** — resolves token, calls `acceptConsent`, redirects to `/me`
5. **Accept (not logged in)** — resolves workspace slug, redirects to `/login?invite={slug}`

After login, `/join/:slug` detects `pending_consent` status and shows Accept/Decline buttons.

### In-app (logged-in users)

If a user visits `/join/:slug` directly:

- **Active** → redirected to `/me`
- **Pending consent** → shows Accept/Decline buttons (calls `POST /api/me/consent`)
- **Domain match** → auto-enrolled without explicit consent needed
- **No path** → "Invite required" message

### `/ws/:slug` — Today dashboard

Server-rendered. Shows who is present right now, who visited today, and who hasn't checked in yet — all in the workspace's configured timezone.

**Data flow:**

1. Resolves workspace from slug, verifies admin membership
2. Computes today's UTC bounds using `todayInTz(tz)` + `localMidnightToUtc()`
3. Calls `queryWorkspaceEvents()` — applies plan history gate + signal matching
4. Fetches all active members via `getActiveMembersWithDetails()` (JOIN with users table)
5. Groups by: **In office now** (open event) | **Visited today** (all checked out) | **Not in** (no events)

**Layout:**

- Sticky header: `Venzio / Workspace Name` + `Personal →` link
- Nav tabs: `Today` | `People` | `Settings`
- Stat chips: in office · visited · not in · total members
- Per-person row: name, email, check-in→checkout times (workspace TZ), signal badge, duration

**Signal badges:**

| Badge                        | Colour     | Meaning                                                     |
| ---------------------------- | ---------- | ----------------------------------------------------------- |
| ✓ GPS+IP (all signals)       | Teal       | `verified` — all configured signals matched                 |
| ~ GPS (some signals)         | Amber      | `partial` — some configured signals matched                 |
| Unverified                   | Muted grey | `none` — no signals matched                                 |
| Override                     | Purple     | Admin override applied                                      |
| —                            | Muted      | Config-light mode (no signals configured)                   |

---

## PWA

Venzio is installable as a Progressive Web App on both mobile and desktop.

- **Manifest:** `src/app/manifest.ts` (served at `/manifest.webmanifest`)
- **Start URL:** `/me` (user PWA)
- **Display mode:** `standalone` (no browser chrome)
- **Theme colour:** `#1a1a2e` (navy)
- **Icons:** `/icon-192.png` and `/icon-512.png` — add to `public/` before deploying

The `<meta name="apple-mobile-web-app-capable">` tag is set via `appleWebApp` in the root layout metadata, enabling full-screen mode on iOS when added to the home screen.

### Push Notifications

Venzio uses Web Push (VAPID) for reliable notifications on mobile PWA and desktop.

Generate VAPID keys (one-time setup):

```bash
npx web-push generate-vapid-keys
```

Add to `.env.local`:

```
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_EMAIL=mailto:your@email.com
```

Notifications sent:

- Stale reminders at 4h, 8h, 12h, 16h, 18h, 20h, 22h from check-in
- 15-min warning before auto-checkout: "Still here? Extend by 8h"
- Auto-checkout at T+12h from check-in

---

## Marketing Site

`/` — static, publicly accessible. Features:

- Sticky nav: Venzio wordmark + Sign in / Get started links
- Hero: headline, subheadline, two CTAs (both route to `/login`)
- Feature grid (4 cards): who's in today, privacy by design, verified domains, multiple signals
- Footer

All pages are fully static Server Components — no JavaScript required. All share `MarketingNav` (sticky, glass-blur, centre links, Sign in / Get started) and `MarketingFooter`.

| Page        | Route          | Contents                                                                                                                                                |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing     | `/`            | Hero (phone + dashboard mockup), For Orgs (hybrid / field), For Individuals, How it works (teams / you), pricing preview (3 cards), open source section |
| For Teams   | `/for-teams`   | Hero, two team types (hybrid office / field force), triple-signal verification, 5-step setup walkthrough, CTA                                           |
| For You     | `/for-you`     | Hero, 6 feature cards, "works with any employer" section, privacy plain-language section, CTA                                                           |
| Pricing     | `/pricing`     | 3 plan cards with feature matrix (free ✓ / — per item), individuals callout, 6-item FAQ                                                                 |
| Open Source | `/open-source` | What's open source (4 items), what we run as a service (5 items), 4-step self-host guide with code blocks, GitHub CTA                                   |
| Privacy     | `/privacy`     | Full policy: data table, who can see data, retention (7 years), consent model, your rights (6 items), security, contact                                 |
| Terms       | `/terms`       | Full terms: acceptable use, org admin responsibilities, no warranty on signal accuracy, limitation of liability, governing law                          |

---

## Login Page — `/login`

Single entry point for all authentication. An 8-state client state machine:

| State           | Description                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `email`         | Enter email — checks existence via `/api/auth/check-email`                                 |
| `password`      | Existing user — enter password                                                             |
| `otp`           | New user — enter 6-digit code sent to email                                                |
| `accountType`   | OTP verified — choose Personal or Organisation                                             |
| `personal`      | Enter name + password                                                                      |
| `org`           | Enter org name, URL handle (live `/ws/check-slug` check), optional domain, name + password |
| `forgotPassword`| Enter email for reset code                                                                 |
| `resetPassword` | Enter new password (OTP-gated)                                                             |

**OTP security:** After verify, a 15-minute signed `cm_otp_ok` httpOnly cookie is set server-side. The register route validates this cookie — the client never sends `otpVerified: true`.

**Resend not configured?** OTPs are printed to the server console in dev:

```
[DEV] OTP for user@example.com: 481923
```

---

## Key Library Modules

### `lib/db/index.ts`

Single `db` object with `query`, `queryOne`, `execute`, `transaction`. Switches backend via `DATABASE_URL` env var. All app code uses this — never imports SQLite or Postgres directly.

### `lib/signals.ts` — `queryWorkspaceEvents()`

The core dashboard function. Given a workspace and date range:

1. Gets active member user IDs (honours plan user limit)
2. Gets signal configs (GPS / IP)
3. If **no signal configs**: returns all events (config-light mode)
4. If **signal configs exist**: tests each event against ALL configured signal types (AND semantics)
5. Returns each event with a `matched_by` field: `'verified'` (all signals matched) | `'partial'` (some matched) | `'none'` (no match) | `'override'` (admin override)

### `lib/domain-verify.ts`

- `domainVerifyToken(workspaceId, domain)` — deterministic HMAC-SHA256 token (first 32 hex chars)
- `checkDnsVerification(domain, token)` — resolves `_venzio-verify.{domain}` TXT records, returns `boolean`

### `lib/ws-admin.ts`

- `requireWsAdmin(request, slug)` — reads `x-user-id` header, validates workspace + admin+active membership. Returns `{ workspace, userId }` or `null`.

### `lib/stats.ts` — `updateUserStats()`

Called after every check-in. Computes:

- Streak (consecutive days with ≥1 check-in)
- Total check-ins and hours
- This month's check-ins
- Distinct GPS clusters this month (500m radius)

### `lib/geo.ts`

- `getIpGeo(ip)` — calls ip-api.com (free, no key, 45 req/min limit). Returns `null` for localhost/private IPs in dev.
- `haversineMetres(lat1, lng1, lat2, lng2)` — great-circle distance in metres
- `extractIp(request)` — reads `x-forwarded-for` or `x-real-ip`

### `lib/timezone.ts`

All times stored as UTC in the DB. These helpers convert for display:

- `formatInTz(utcStr, tz, 'time'|'date'|'datetime')`
- `monthBoundsUtc(year, month, tz)` — returns UTC start/end for a calendar month in a timezone
- `todayInTz(tz)` — today's date string `YYYY-MM-DD` in a given timezone
- `localMidnightToUtc(dateStr, tz)` — converts a local date to UTC ISO

### `lib/auth.ts`

- `createJwt` / `verifyJwt` — session tokens
- `setSessionCookie` / `clearSessionCookie` / `getSessionFromCookies`
- `setOtpVerifiedCookie(email)` — 15-min signed JWT in `cm_otp_ok` cookie
- `verifyOtpCookie(email)` — validates the OTP cookie server-side
- `getServerUser()` — reads `x-user-id` / `x-user-email` headers set by `proxy.ts`

---

## Middleware (Route Protection)

`src/proxy.ts` runs on every matched request via Next.js 16 Edge middleware (Next.js 16 uses `proxy.ts` natively instead of `middleware.ts`):

| Path                        | Requirement                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `/me/*`                     | Valid JWT cookie → redirect to `/login` if missing                                |
| `/ws/*`                     | Valid JWT cookie → redirect to `/login` if missing (admin role checked per-route) |
| `/api/*` (non-public)       | Valid JWT cookie → 401 if missing                                                 |
| `/api/v1/*`                 | Bearer token (handled inside route handlers)                                      |
| `/api/auth/*`               | Public — no auth required                                                         |
| `/api/auth/check-email`     | Public — no auth required                                                         |
| `/api/workspace/check-slug` | Public — no auth required                                                         |

The middleware verifies the JWT signature (Edge-compatible via `jose`). Token revocation (SQLite) is checked in `getSessionFromCookies()` which runs in Node.js server components and route handlers.

---

## Platform Walkthrough

### As a User (`/me/*`)

**Getting in**

Navigate to `/login`. A single 6-state machine handles everything:

1. Enter your email — the server checks if an account exists
2. **Existing user** → enter password → JWT issued, stored as `cm_session` httpOnly cookie → redirected to `/me`
3. **New user** → OTP sent to email → enter 6-digit code → choose account type: Personal or Organisation
4. **Personal** → name + password → account created → `/me`
5. **Organisation** → org name, URL handle (live-checked, reserved slugs blocked), optional domain, name + password → account + workspace created → `/ws/:slug`
6. **Deactivated account** → detected at email step → enter password to reactivate → normal login

**Home — `/me`**

Your presence dashboard. Everything here belongs to you:

- Status line: "Checked in at 10:15 AM" or "Not checked in yet" — always your browser's local timezone
- **"I'm here"** — visible only when checked out. Collects GPS from the browser, sends `POST /api/checkin` with lat/lng. The server creates a `presence_events` row, fires a Nominatim reverse-geocode in the background (stored as `location_label`), and updates your streak + monthly stats.
- **"I'm leaving"** — visible only when checked in. Sends `POST /api/checkin/checkout` with GPS. Stamps `checkout_at` on the open event.
- 3 stat chips: days this month / hours logged / distinct locations
- Today's event list: each card shows check-in time, check-out time, location label, and an inline note editor

**Timeline — `/me/timeline`**

Fetches `GET /api/events?start=&end=` with date pickers (default: current month). Events grouped by date, newest first. Inline note editing on any event. Presence data is never deleted.

**Orgs — `/me/orgs`**

Shows all pending consent invites (Accept / Decline) and active workspace memberships with a Leave button. Leaving is blocked if you are the sole admin.

**Settings — `/me/settings`**

| Section      | What it does                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Profile      | Update display name                                                                                                        |
| Email        | 2-step change: enter new email → OTP sent to new address → verify code → email updated (synced in `workspace_members` too) |
| Password     | Verify current password, set new one (8-char minimum enforced server-side)                                                 |
| API Tokens   | Create named tokens for `POST /api/v1/checkin` Bearer auth. Token shown once in plaintext, stored as bcrypt hash.          |
| Organisation | Link to create a workspace                                                                                                 |
| Sign out     | `POST /api/auth/logout` → jti revoked in DB → cookie cleared                                                               |
| Danger zone  | Soft-deactivates account (`deleted_at` stamped). Data preserved. Reactivate by logging back in.                            |

---

### As an Organisation Admin (`/ws/:slug/*`)

**Getting to your workspace**

After login: 1 workspace → redirected directly to `/ws/:slug`. 2+ workspaces → `/ws` picker. No admin roles → `/me`. You can always create a new workspace at `/ws/new`.

**Today dashboard — `/ws/:slug`**

The core admin view. Client fetches from `GET /api/ws/:slug/dashboard` (admin-only).

What the dashboard query does:

1. Resolves workspace from slug, validates you are an active admin
2. Computes today's date in the workspace's configured timezone (e.g. 00:00–23:59 IST → equivalent UTC bounds)
3. Calls `queryWorkspaceEvents(workspace.id, plan, { startDate, endDate })`:
   - Fetches active member IDs (capped by plan's `maxUsers`)
   - Fetches all their presence events in the date range
   - **Signal matching**: each event tested against GPS proximity (Haversine < radius), IP geolocation proximity. No match → `matched_by: 'none'`
   - Config-light mode: if no signals are configured, all events pass through
   - Admin overrides bypass signal matching entirely
4. Groups members: **In office now** (open event) · **Visited today** (closed events) · **Not in** (no events today)
5. Supports filter by status/signal type, name/email search (debounced 300ms), sort by time/name/duration, and pagination

**People tab — `/ws/:slug/people`**

All members: active, invited, declined. Invite by email → consent email sent. The consent link is validated for: correct status, not expired, and logged-in email must match the invited email (prevents token hijacking).

**Settings tab — `/ws/:slug/settings`**

- Edit workspace name and timezone
- **Signal config**: add GPS (lat/lng + radius, auto-detects workspace timezone from coordinates) or IP (geocoded from your server-side IP)
- **Domain verification**: add a domain → DNS TXT record generated → click "Check verification" → server resolves DNS, marks domain verified (scoped `WHERE id = ? AND workspace_id = ?` at DB level), auto-enrolls any existing users whose email matches
- **Archive workspace**: soft-archives the workspace (`archived_at` stamped). All data preserved. Workspace moves to "Archived" section in `/ws` picker.

---

### What the DB records for each action

| Action             | Tables written                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Register personal  | `users`, `otp_codes`                                                                                            |
| Register org       | `users`, `workspaces`, `workspace_members`, `workspace_domains`                                                 |
| Check in           | `presence_events` (insert), `user_stats` (upsert), `presence_events.location_label` (async update)              |
| Check out          | `presence_events` (stamp `checkout_at` + `checkout_reason` + checkout signals)                                  |
| Dashboard query    | Read-only: `workspace_members`, `presence_events`, `workspace_signal_config`, `admin_overrides`                 |
| Invite member      | `workspace_members` (upsert with consent token + expiry)                                                        |
| Accept invite      | `workspace_members` (status → active, link `user_id`)                                                           |
| Verify domain      | `workspace_domains` (`verified_at`, scoped to `workspace_id`), `workspace_members` (auto-enroll matching users) |
| Logout             | `revoked_tokens` (insert jti + expiry), cookie deleted                                                          |
| Deactivate account | `users.deleted_at` stamped; cookie cleared                                                                      |

---

### Security properties at a glance

| Concern                     | Mechanism                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Session auth**            | JWT (HS256, 30-day expiry), unique `jti` per token, stored in `httpOnly; SameSite=Lax` cookie                                                                                                                                                                                                         |
| **Logout invalidation**     | `jti` inserted into `revoked_tokens` on logout; `getSessionFromCookies()` checks revocation on every server-component/route-handler request                                                                                                                                                            |
| **CSRF**                    | `SameSite=Lax` on `cm_session` — `Strict` was causing session loss on PWA cold-opens on Android and iOS (PWA-to-browser cross-origin navigation). `Lax` still blocks cross-site POST mutations; only same-site GET navigations carry the cookie cross-origin.                                                                                                                                                                                                                             |
| **Password storage**        | bcrypt at cost 12. Minimum 8 chars enforced server-side on both registration and password change. Never stored in plaintext.                                                                                                                                                                           |
| **OTP brute force**         | 5-attempt lockout per code; max 3 sends per 15 minutes per email                                                                                                                                                                                                                                             |
| **Reserved slugs**          | 20+ blocked names (api, admin, me, ws, etc.) at the `check-slug` API level                                                                                                                                                                                                                             |
| **Consent token hijacking** | Three-layer validation: status must be `pending_consent`, token must not be expired, logged-in email must match invited email                                                                                                                                                                          |
| **Cross-workspace leakage** | All mutations scoped by `workspace_id` at the DB level. `requireWsAdmin` resolves slug → `workspace.id`, validates admin role on that ID, passes `ctx.workspace.id` to every subsequent query. `markDomainVerified` and `deleteSignalConfig` both require matching `workspace_id` in the WHERE clause. |
| **Event ownership**         | `getEventByIdForUser(eventId, userId)` — DB query enforces `user_id = ?` directly; no caller can skip the ownership check. `GET /api/events` never accepts `userId` from query params — always from the validated JWT.                                                                                 |
| **Domain uniqueness**       | Domains already verified by another workspace are blocked (409 `DOMAIN_CLAIMED`)                                                                                                                                                                                                                       |
| **Soft delete**             | `users.deleted_at` — data preserved; all active-user queries filter `AND deleted_at IS NULL`. API tokens checked against active user status in `POST /api/v1/checkin`.                                                                                                                                 |

---

## API Reference

All routes return JSON. Errors always return:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

### Auth

| Method | Route                   | Auth       | Description                          |
| ------ | ----------------------- | ---------- | ------------------------------------ |
| POST   | `/api/auth/check-email` | None       | Check if email has an account        |
| POST   | `/api/auth/login`       | None       | Email check or password verify       |
| POST   | `/api/auth/otp/send`    | None       | Send 6-digit OTP to email            |
| POST   | `/api/auth/otp/verify`  | None       | Verify OTP — sets `cm_otp_ok` cookie |
| POST   | `/api/auth/register`       | OTP cookie | Create account (personal or org)     |
| POST   | `/api/auth/reset-password` | OTP cookie | Reset password after OTP verification |
| POST   | `/api/auth/logout`         | Cookie     | Clear session cookie                 |

#### `POST /api/auth/check-email`

```json
// Request
{ "email": "user@example.com" }

// Response
{ "exists": true }
```

#### `POST /api/auth/login`

**Step 1 — check if email exists:**

```json
// Request
{ "email": "user@example.com" }

// Response (email exists)
{ "exists": true }
```

**Step 2 — verify password:**

```json
// Request
{ "email": "user@example.com", "password": "mypassword" }

// Response (success) — also sets cm_session cookie
{ "user": { "id": "...", "email": "...", "fullName": "..." }, "redirect": "/me" }

// Response (wrong password) — 401
{ "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }
```

#### `POST /api/auth/otp/send`

```json
// Request
{ "email": "newuser@example.com" }

// Response
{ "sent": true, "expiresIn": 600 }

// Error (rate limited) — 429
{ "error": "Too many OTP requests. Try again later.", "code": "RATE_LIMITED" }
```

#### `POST /api/auth/otp/verify`

```json
// Request
{ "email": "newuser@example.com", "code": "481923" }

// Response — also sets cm_otp_ok cookie (15 min, httpOnly)
{ "verified": true }

// Error — 400
{ "error": "Invalid or expired code", "code": "INVALID_OTP" }
```

#### `POST /api/auth/register`

```json
// Personal account
{
  "email": "newuser@example.com",
  "fullName": "Jane Doe",
  "password": "securepass",
  "accountType": "personal"
}

// Org account
{
  "email": "jane@acme.com",
  "fullName": "Jane Doe",
  "password": "securepass",
  "accountType": "org",
  "orgName": "Acme Corp",
  "orgSlug": "acme-corp",
  "orgDomain": "acme.com"
}

// Response (success) — sets cm_session cookie, clears cm_otp_ok cookie
{ "user": { "id": "...", "email": "...", "fullName": "Jane Doe" }, "redirect": "/me" }
```

### Workspace

| Method | Route                       | Auth | Description             |
| ------ | --------------------------- | ---- | ----------------------- |
| POST   | `/api/workspace/check-slug` | None | Check slug availability |

#### `POST /api/workspace/check-slug`

```json
// Request
{ "slug": "acme-corp" }

// Response
{ "available": true }
```

### Workspace Admin

All routes require session cookie + admin membership of the workspace.

| Method | Route                             | Description                                    |
| ------ | --------------------------------- | ---------------------------------------------- |
| PATCH  | `/api/ws/:slug`                   | Update workspace name and/or timezone          |
| GET    | `/api/ws/:slug/domain`            | List domains (with verify token if unverified) |
| POST   | `/api/ws/:slug/domain`            | Add a domain                                   |
| DELETE | `/api/ws/:slug/domain/:id`        | Remove a domain                                |
| POST   | `/api/ws/:slug/domain/:id/verify` | Trigger DNS TXT verification                   |
| GET    | `/api/ws/:slug/members`           | List all members (all statuses)                |
| POST   | `/api/ws/:slug/members`           | Invite member (sends consent email)            |
| DELETE | `/api/ws/:slug/members/:id`       | Remove member (blocked for admins)             |

#### `POST /api/ws/:slug/members`

```json
// Request
{ "email": "colleague@company.com" }

// Response
{ "success": true }

// Error (already active) — 409
{ "error": "This person is already an active member", "code": "ALREADY_MEMBER" }
```

#### `POST /api/ws/:slug/domain/:id/verify`

```json
// Response (verified)
{ "verified": true, "message": "Domain verified" }

// Response (not yet)
{ "verified": false, "message": "TXT record not found yet. DNS propagation can take up to 48 hours." }
```

---

## Design System

CSS variables (defined in `src/app/globals.css`):

| Variable      | Value     | Use                         |
| ------------- | --------- | --------------------------- |
| `--brand`     | `#1B4DFF` | Primary buttons, links      |
| `--navy`      | `#0D1B2A` | Headings, dark text         |
| `--teal`      | `#00D4AA` | "Present" status badge      |
| `--amber`     | `#F59E0B` | Warnings                    |
| `--danger`    | `#EF4444` | Errors, destructive actions |
| `--surface-0` | `#FFFFFF` | Card backgrounds            |
| `--surface-1` | `#F8FAFC` | Page backgrounds            |
| `--surface-2` | `#F1F5F9` | Input backgrounds           |
| `--border`    | `#E2E8F0` | All borders                 |

Fonts loaded via Google Fonts:

- **Headings:** Syne (400, 600, 700)
- **Body:** DM Sans (400, 500)
- **Code / timestamps:** JetBrains Mono (400)

Design rules:

- No drop shadows — use borders only
- No gradients — flat solid fills
- Minimum touch target: 44px height
- Skeleton loaders for async states — never spinners

---

## Environment Variables Reference

| Variable              | Required    | Description                                      |
| --------------------- | ----------- | ------------------------------------------------ |
| `TURSO_DATABASE_URL`  | No (dev)    | Turso URL for production. Empty → uses SQLite.   |
| `TURSO_AUTH_TOKEN`    | No (dev)    | Turso Auth Token for production. Empty → dev env |
| `JWT_SECRET`          | **Yes**     | Random 32+ char string for JWT signing           |
| `RESEND_API_KEY`      | Recommended | From resend.com. OTPs log to console if missing. |
| `NEXT_PUBLIC_APP_URL` | Yes         | Full app URL (`http://localhost:3000` in dev)    |
| `VAPID_PUBLIC_KEY`    | Recommended | Web Push public key. `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY`   | Recommended | Web Push private key (never expose to client)   |
| `VAPID_EMAIL`         | Recommended | Contact email for VAPID `mailto:` registration  |
