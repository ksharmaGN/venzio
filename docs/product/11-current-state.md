# Venzio — Current State (Ground Truth)

**Purpose:** A factual snapshot of what Venzio actually does today, verified directly against the codebase (not against the strategy docs in `01-vision-mission.md` through `10-design-spec.md`, which predate several pivots and contain drift — see `00-index.md` for the full list). Pair this file with `01-vision-mission.md` when brainstorming market fit, ICP, or GTM: one is where the product is going, this is where it actually is.

Last verified: 2026-07-28, against the codebase in this repo.

---

## What it is

A presence-verification platform with two PWA surfaces, no native app:
- `/me/*` — mobile-first, individuals check themselves in/out and view their own history
- `/ws/:slug/*` — desktop-first, org admins view org presence data

Core architectural bet: `presence_events` rows carry no `workspace_id`. Events belong to the user; a workspace's admin view is a *query* over a user's events, filtered by that workspace's signal config. This is what lets one check-in serve multiple employers and lets a user's history survive a job change.

## Signal verification — what's actually live

Two signal types are implemented and matched: **GPS** and **Network**.

- **GPS**: browser geolocation at check-in and checkout, matched by Haversine distance against an admin-registered lat/lng + radius (default 300m).
- **Network** (internal `signal_type: 'ip'`): an admin registers a signal once, which geolocates *their own* current public IP via ip-api.com and stores that as a fixed point. Check-in events are matched by proximity (default 500m) between the event's geolocated IP and that stored point. This is not a literal IP-string match — it can't be, since a residential/office IP changes on DHCP renewal.
- **AND semantics**: if a workspace has both configured, both must match for `matched_by: 'verified'`. One matching = `'partial'`. Neither = `'none'`. No signals configured at all = config-light mode, where every event is `'verified'` by default (not `'none'` — this was a bug in older architecture docs, now fixed).
- **Admin overrides** bypass matching entirely, stored in a separate `admin_overrides` table, never touching the original event.

**WiFi SSID matching does not exist.** No check-in client collects an SSID, no comparison code runs. It appears in old pitch decks and strategy docs as a third signal; treat that as roadmap, not shipped. DB columns/API stubs may exist as scaffolding only.

## Auth

Email + password (bcrypt, cost 12) + mandatory OTP verification for new accounts. No Google OAuth, no SSO, despite most of the strategy docs assuming Google-OAuth-only. JWT session cookie (30 days), separate short-lived OTP-verified cookie (15 min). Edge middleware does signature-only verification; real route handlers check a revocation table.

## Plans & pricing (live, from `lib/plans.ts` and the `/pricing` page)

| Plan | Max users | History | Signal locations | CSV export |
|---|---|---|---|---|
| Free | 10 | 3 months | 1 | No |
| Starter | unlimited | 12 months | 1 | Yes |
| Growth | unlimited | 7 years | 5 | Yes |

Live prices: Starter ₹69/user/mo, Growth ₹99/user/mo (the strategy docs say ₹49/₹89 — stale). Leave management is not actually plan-gated in code today, though the pricing table implies it should be.

No payroll integration, no allowance auto-calculation, no org-level analytics dashboard beyond what's described below, no calendar sync — these are all still roadmap items correctly labeled as such in the roadmap doc.

## Leave

Per-workspace leave types (name, accrual frequency, accrual credits). Employees submit requests that are **approved instantly — there is no approval workflow**. Balance is computed on the fly (accrued − used), never stored. This shipped well ahead of the original roadmap's "Year 2" placement for it.

## Holidays

Per-workspace holiday calendar, soft-deleted, admin-managed, CSV/XLSX bulk import. Also shipped ahead of its original roadmap slot, and simpler than specced (no multi-region holiday sets).

## Employees

A separate employee-records feature (HR fields — PAN, Aadhaar, bank account) exists, with sensitive fields AES-256-GCM encrypted at rest. Recent addition, not in any of the original strategy docs.

## Design system (what's actually shipped in `globals.css`, not what the docs say)

- Brand color is `#1d9e75`, a deep emerald green — not the `#1B4DFF` blue the design-spec doc and the old `CLAUDE.md` table both claimed.
- Typography: **Playfair Display** (headings, serif) + **Plus Jakarta Sans** (body) + **JetBrains Mono** (data/timestamps) — not Syne/DM Sans.
- A dark theme (`.vz-dark`, with dedicated dark surface/glow tokens) is fully defined in CSS but **applied nowhere in the app** as of this writing — dark mode is dormant infrastructure, not a shipped feature.
- The "no drop shadows, no gradients" rule in the old docs is already broken by shipped code (a hover-state box-shadow exists on workspace cards). Treat that rule as aspirational-only, not enforced.

## Delivery model

Browser-only PWA. No Capacitor shell, no App Store/Play Store presence, no push-notification guarantees that survive an iOS PWA being backgrounded for long periods. This matters for the "hard to fake" pitch: anything requiring OS-level sensors, background execution, or app-store-gated APIs (continuous WiFi scanning without user action, background geofencing, secure enclave attestation) is not available at the PWA layer and would require a native rebuild to claim honestly. See `Instruction-Native-App.md` (outside this docs folder) for the fuller native-trust roadmap thinking.

## Stack

Next.js 16, Tailwind CSS v4, SQLite (dev) / Turso libSQL (prod) — not Postgres, no row-level security (authorization is enforced in application code via `requireWsAdmin()` and friends). Hand-rolled `src/locales/en.ts` for copy, not `next-intl` as the PRD assumed.

## The honest gap list (for GTM/positioning conversations)

Things the older pitch materials imply or claim that are **not currently true**, so any positioning work should not lean on them until they ship:
1. Triple-signal (GPS+WiFi+Network) verification — only two signals are live.
2. "Native, hard-to-spoof" trust layer — today it's a browser PWA; native-level anti-spoofing guarantees don't exist yet.
3. Org-level productivity/analytics layer, payroll pipe, allowance auto-calc, calendar sync — all still unbuilt, but these are already correctly labeled "future" in the roadmap doc, not overclaimed.
4. 7-year hard-delete retention cron — doesn't exist; retention is a query-time gate only, which is actually more consistent with the platform's own "never hard-delete" principle than the docs' claim of a delete cron.

Full itemized drift list with file references: `00-index.md`.
