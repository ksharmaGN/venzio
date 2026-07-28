# User Journeys

**Venzio — Presence Intelligence Platform**
*All flows — both org types, all edge cases*
Source: `05_user_journeys_final.docx` — v4.0 Final, March 2026

---

## Journey Index

| # | Journey | Actor | Type |
|---|---|---|---|
| 1 | First-time user sign-up and check-in | User | All users |
| 2 | Config-heavy org setup (hybrid company at office) | Admin | Type 1 |
| 3 | Config-light org setup (field force company) | Admin | Type 2 |
| 4 | Daily check-in — office worker | User | All users |
| 5 | Multiple check-ins in one day — field agent | User | Field agent |
| 6 | Admin views field agent's daily location diary | Admin | Type 2 |
| 7 | Config-heavy org month-end review | Admin | Type 1 |
| 8 | Free plan hits 10-user limit | Admin | All orgs |
| 9 | Personal email consent flow | Admin + User | All orgs |
| 10 | Multi-org user daily experience | User | Multi-org |

## Journey 1: User — First Sign-Up and Check-In

Goal: User is marking presence within 60 seconds. No friction, no gates, no admin required.

| Step | Actor | Action | System response | Edge case |
|---|---|---|---|---|
| 1 | User | Opens venzio.ai on phone or laptop | Google OAuth sign-in screen | — |
| 2 | User | Signs in with any Google account | Account created. Domain silently checked against all verified workspaces. | No workspace match → user created as standalone. No message shown about this. |
| 3 | System | Domain match found | User auto-enrolled in workspace. No notification to user or admin — it just happens. | Multiple matches → enrolled in all matching workspaces simultaneously |
| 4 | User | Lands on home screen. Sees "I'm here" button prominently. Brief tooltip: "Tap whenever you arrive somewhere." | — | — |
| 5 | User | Taps "I'm here" | Browser requests GPS permission (first time only) | User denies GPS → shown: "Check-in saved without GPS. Location helps orgs verify your presence." Event saves anyway. |
| 6 | System | Saves presence_event: wifi_ssid, ip_address, gps_lat/lng, checkin_at | Returns success | — |
| 7 | User | Sees: "Checked in at 9:38 AM" — clean confirmation. Today's timeline shows one event. | — | — |

> ⚠️ **Status check:** Steps 1–2 describe Google OAuth sign-in. Actual sign-up is email + password with mandatory OTP verification for new accounts (CLAUDE.md "Auth System"; Key Invariant #3) — there is no Google account flow in the codebase.

## Journey 2: Config-Heavy Admin — Workspace Setup at the Office

Goal: Admin is physically at their office. Registers location and WiFi from their actual environment. Under 10 minutes.

| Step | Actor | Action | System response | Edge case |
|---|---|---|---|---|
| 1 | Admin | Signs in with work email. Sees "Create workspace" prompt. | — | — |
| 2 | Admin | Enters company name, email domain (e.g., acmecorp.com). Clicks "Verify domain". | Verification email sent to admin@acmecorp.com and support@acmecorp.com. | DNS TXT alternative shown. Admin picks either route. |
| 3 | Admin | Clicks verify link in email. | Domain marked verified. "Register your office to start seeing attendance." prompt shown. | — |
| 4 | Admin | At the office. Clicks "Register this location". Browser requests GPS permission. | GPS captured. Map shown with pin at current location. | GPS denied → cannot register location. Must grant permission. |
| 5 | Admin | Types location name: "WeWork Gurugram Sector 44". Adjusts geofence slider to 300m. | Geofence circle shown on map. Admin sees which areas are inside/outside. | Admin can search address via Nominatim to confirm pin is correct. |
| 6 | Admin | Connected to office WiFi. Clicks "Register this network". | Browser reads SSID. Shows: "You are on: CoWork GGN. Register this?" — one tap confirm. | SSID unavailable on iOS → admin can type it manually as fallback. |
| 7 | Admin | Clicks "Register IP context". | Server records admin's current IP. Resolves to coordinates. Saved as IP signal context. | — |
| 8 | Admin | Adds second location (client office). Clicks "Register this location" again. Names it "HDFC Nehru Place". | Second location added with its own GPS anchor and geofence radius. | Up to unlimited locations on Growth. 1 location on Starter. |
| 9 | Admin | Setup complete. | Dashboard shows enrolled employees (anyone who signed in with @acmecorp.com). Presence events already flowing if any employees have checked in. | — |

> ⚠️ **Status check:** Step 8 says unlimited locations on Growth — the live plan limit is 5 locations on Growth, 1 on Free and Starter (`lib/plans.ts`, CLAUDE.md "Plan Limits"). Registering WiFi (step 6) still writes to `workspace_signal_config`, but this signal is not evaluated in the current AND-matching query — see the callout in `04-prd.md`.

## Journey 3: Config-Light Admin — Field Force Company Setup

Goal: Insurance branch manager sets up workspace in 5 minutes. No office to register. No WiFi. Just the team.

| Step | Actor | Action | System response | Edge case |
|---|---|---|---|---|
| 1 | Admin | Signs in with work email. Creates workspace: "LIC Delhi Branch 4". | — | — |
| 2 | Admin | Enters company email domain (or skips if agents use personal email). | Domain verified (if applicable). | If agents use personal emails: skip domain. Go straight to step 4. |
| 3 | Admin | Sees prompt: "Register your office signal config" — skips it entirely. Clicks "Add team members" instead. | System notes workspace has no signal config. This is valid. Dashboard will show all events for enrolled users. | — |
| 4 | Admin | Adds agent emails: rahul.agent@gmail.com, priya.lic@gmail.com, amit.insurance@gmail.com | Consent emails sent to each address immediately. | — |
| 5 | Admin | Done. Dashboard shows "Waiting for agents to accept consent and check in." | — | — |
| 6 | Admin (next day) | Opens dashboard after agents have accepted and started checking in. | Dashboard shows all events for all consented agents — unfiltered. Every check-in, every location, all day. | No signal config = no filtering. Admin sees everything. |

## Journey 4: User — Daily Check-In, Office Worker

Goal: Under 10 seconds. Open, tap, done.

- User opens Venzio — PWA icon on phone or browser bookmark on laptop
- Home screen shows: today's date, "No check-ins yet today", large "I'm here" button
- User taps "I'm here"
- GPS captured (cached from previous session — near instant), WiFi SSID read, IP extracted server-side
- Event saved. User sees: "Checked in at 9:42 AM"
- User closes app and starts working

End of day — optional check-out: User taps "I'm leaving" before leaving office. Checkout time saved. Duration shows: "3h 47m at this location." If they forget — no problem. checkout_at stays NULL. Duration is NULL for that event. Not an error.

## Journey 5: Field Agent — Multiple Check-Ins in One Day

Goal: Agent visits 6 clients in one day. Each visit is recorded with a tap. Manager sees the full day's trail.

| Time | Action | What saves |
|---|---|---|
| 8:55 AM | Arrives at office for morning briefing. Taps "I'm here". | Event 1: checkin_at 8:55, wifi_ssid "BranchOffice_WiFi", GPS = office location |
| 9:30 AM | Leaves for first client. Taps "I'm leaving". | Event 1 closed: checkout_at 9:30, duration 35 min |
| 10:15 AM | Arrives at Client 1 (HDFC Bank Sector 44). Taps "I'm here". Adds note: "HDFC Sector 44 — new policy pitch". | Event 2: checkin_at 10:15, GPS = Sector 44 coordinates, note saved |
| 11:00 AM | Leaves Client 1. Taps "I'm leaving". | Event 2 closed: checkout_at 11:00, duration 45 min |
| 11:45 AM | Arrives at Client 2 (Bajaj Allianz, Dwarka). Taps "I'm here". Note: "Bajaj Dwarka — renewal". | Event 3: checkin_at 11:45, GPS = Dwarka coordinates |
| 12:30 PM | Leaves Client 2. Taps "I'm leaving". | Event 3 closed: 45 min duration |
| 2:00 PM | Arrives at Client 3 (home visit, Vasant Kunj). Taps "I'm here". Note: "Mr Sharma home visit". | Event 4: checkin_at 2:00, GPS = Vasant Kunj residential coordinates |
| 2:45 PM | Leaves. Taps "I'm leaving". | Event 4 closed: 45 min |
| End of day | Does not check in anywhere else. App shows: 4 events today, 2h 50m total logged. | No unclosed events — all checked out today |

That's the agent's day — 4 events, 4 GPS locations, 4 timestamps, 4 notes. All stored in presence_events. All visible to the manager in the dashboard.

## Journey 6: Config-Light Admin — Views Agent's Daily Location Diary

Goal: Branch manager opens Rahul's profile to verify he visited 6 clients today.

- Admin opens Venzio dashboard. Clicks "Today" view.
- Sees Rahul: "4 events today". Clicks on Rahul's name.
- Rahul's profile shows today's events in timeline order:
  - 8:55 AM → 9:30 AM | BranchOffice_WiFi | 28.4601, 77.0263 | 35 min
  - 10:15 AM → 11:00 AM | No WiFi | 28.4489, 77.0650 (Sector 44) | 45 min | "HDFC Sector 44 — new policy pitch"
  - 11:45 AM → 12:30 PM | No WiFi | 28.5921, 77.0595 (Dwarka) | 45 min | "Bajaj Dwarka — renewal"
  - 2:00 PM → 2:45 PM | No WiFi | 28.5494, 77.1550 (Vasant Kunj) | 45 min | "Mr Sharma home visit"
- Admin can click any event to see the GPS pin on a map (OpenStreetMap embed).
- Admin is satisfied — Rahul visited 4 locations with timestamps and GPS proof.
- Admin adds a note on event 4: "Confirmed — Mr Sharma is a valid prospect."
- At month end, admin exports CSV. Each row is one event. Filters by agent name. Sees full month's visit log.

## Journey 7: Config-Heavy Admin — Month-End Review

Goal: Ops lead reviews March attendance, resolves edge cases, exports for payroll. Under 10 minutes.

- Admin opens Monthly view for March. Sees all employees with day counts.
- Priya: 18 days. Amit: 14 days. Rahul: 10 days. (Minimum is 10 for allowance eligibility.)
- Admin clicks Rahul. His profile shows 10 matched events — but 2 events not matched by org config.
- Unmatched event 1: March 14th, GPS 380m from office (just outside 300m geofence). WiFi matched "CoWork GGN". Admin sees this is borderline — clicks "Count this day".
- Unmatched event 2: March 22nd, GPS 2.1km from office. WiFi "HomeNetwork_Rahul". Admin does not count it — Rahul was clearly at home.
- Rahul now shows 11 matched days. Eligible.
- Admin exports CSV. Finance uses it for allowance calculation. Done.

Total time: 6 minutes. Previously: 4 hours.

> ⚠️ **Status check:** "WiFi matched 'CoWork GGN'" as a reason an event is borderline-but-not-fully-matched no longer applies the way this journey describes it, since WiFi is not evaluated by the live matching engine at all today — only GPS and IP are (see `04-prd.md` callout). The admin override mechanic itself (`admin_overrides`, "Count this day") is accurate and unchanged.

## Journey 8: Free Plan Hits 10-User Limit

- 12th employee Deepa signs up with @acmecorp.com. She is auto-enrolled. She marks presence. Her data is stored. She sees her own analytics. Zero disruption to her.
- Admin opens dashboard. Still sees exactly 10 employees (sorted by most recent activity).
- Yellow banner: "12 people from your domain are on Venzio. You're seeing 10 on your Free plan. Upgrade to Starter to see everyone."
- "See who's not visible" shows first names of the 2 hidden users — enough to confirm who they are.
- Admin upgrades. All 12 employees immediately visible.

The 11th and 12th user never know they were hidden from their admin. They use the platform normally throughout.

## Journey 9: Personal Email Consent

- Admin adds rahul.agent@gmail.com to the workspace.
- Consent email sent to Rahul immediately: "LIC Delhi Branch 4 has added you to Venzio. They will see your attendance and location data. Accept or Decline."
- Admin dashboard shows: rahul.agent@gmail.com — Pending consent.
- Rahul reads email. Clicks Accept.
- Rahul enrolled in workspace. All his existing presence_events become queryable by this org (within plan history window).
- Dashboard updates: Rahul appears with his full event history.

If Rahul declines: org sees "Declined". Cannot re-invite for 30 days. Rahul's data completely private.

## Journey 10: Multi-Org User Daily Experience

Rahul works for Acme Corp and consults for ClientCo. One check-in. Two org dashboards update independently.

- Rahul opens Venzio. Taps "I'm here" from Acme Corp's office. One event saved.
- Acme Corp's query: Rahul's GPS matches their WeWork location. WiFi "CoWork GGN" matches. Rahul counted as Present.
- ClientCo's query: their registered location is Okhla. Rahul's GPS does not match. Not counted.
- Next day, Rahul is at ClientCo's Okhla office. Taps "I'm here". GPS matches ClientCo's config. WiFi matches. Counted there.
- Acme Corp's query for that day: GPS is 18km from WeWork. Not counted.

Both orgs see accurate, independent data. Rahul did nothing different — just tapped once in each location.

> This multi-workspace transparency principle is preserved and extended today: on `/me/timeline`, selecting a specific workspace calls `GET /api/me/ws/[slug]/events`, which runs `queryWorkspaceEvents()` for that workspace so the user sees the same AND-semantics `matched_by` their admin would see (CLAUDE.md, "Multi-workspace users").

---

*Document owner: Founding Team | User Journeys v4.0 Final | March 2026*
