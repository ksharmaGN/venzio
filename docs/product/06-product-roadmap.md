# Product Roadmap

**Venzio — Presence Intelligence Platform**
*Now / Next / Later — Venzio feature sequence*
Source: `06_product_roadmap_final.docx` — Final, March 2026

---

## Roadmap Philosophy

Every feature must pass this test: does it help existing customers stay, or bring new customers in? If it does neither in the next 90 days, it goes to Later.

The roadmap is deliberately sequenced around what breaks at each scale. v1 is the tool that works. v2 is the tool that calculates. v3 is the tool that replaces other tools entirely.

## NOW — v1 (Weeks 1–6): The Presence Layer

Goal: Ship to our own company. Prove the system works. Get 5 external companies on it.

| Feature | Why now | Serves |
|---|---|---|
| Google OAuth sign-in, any email | Auth foundation | Both |
| presence_events table with event_type, multi-event per day | Core data model — must be right from day 1 | Both |
| User home screen: "I'm here" button, today's timeline | User daily habit formation | User |
| Optional "I'm leaving" check-out | Enables duration tracking for field agents | User |
| Optional note on check-in | Field agents label their visits; office workers optional | User |
| WiFi SSID + GPS + IP capture on check-in | Signal data collection | Both |
| Org workspace creation + domain verification | Org foundation | Org |
| Signal config registration (at-office GPS/WiFi/IP capture) | Config-heavy org setup | Org (Type 1) |
| Config-light mode (no signal config required) | Field force orgs work immediately | Org (Type 2) |
| Personal email consent flow | Protects users, enables field force onboarding | Both |
| Admin dashboard: today view + monthly view | Core admin need | Org |
| User profile with full event history + match explanation | Dispute resolution mechanism | Org |
| Admin manual override (count this event) | Edge case resolution without system complexity | Org |
| Plan gates: Free 10 users / 3 months, Starter 12 months, Growth all-time | Monetisation | Org |
| CSV export (Starter + Growth) | Direct payroll workflow integration | Org |
| PWA manifest + installable on home screen | Daily habit — app-like without app store | User |

> ⚠️ **Status check:** "Google OAuth sign-in" was never shipped — auth is email + bcrypt password + mandatory OTP for new accounts (CLAUDE.md "Auth System"). Everything else in this v1 table is live today in some form, though signal matching evaluates GPS + IP only (not WiFi) — see the callout in `04-prd.md`.

## NEXT — v2 (Months 3–8): The Calculation Layer

Goal: 50 paying organisations. Add features that make existing customers sticky and convert free to paid.

| Feature | Why next | Trigger to build |
|---|---|---|
| Allowance config per user (rate, min days, cap) — display only, no payment | Top request from hybrid-work companies | When 5+ customers ask at month-end "can it calculate the allowance?" |
| Leave request + approval flow (per org) | Completes the month-end picture for hybrid-work orgs | When 10+ customers also use a separate leave tool and ask to consolidate |
| User home analytics — streak, monthly summary, time-per-location | Makes user open app for themselves, not just company | After 500 daily active users — retention metric |
| Org-wide analytics dashboard (Growth plan) | Makes Growth plan worth the premium | When Starter plan NPS scores lower than Growth |
| Email nudge — "You haven't checked in today" | Reduces forgotten check-ins | When false-negative rate > 3% after 30 days live |
| Map view in user profile (GPS pin per event) | Field force managers need visual location verification | When first 5 field-force orgs are onboarded |
| Slack integration for check-in | Office workers who live in Slack prefer one fewer app | When 10+ customers request it explicitly |

> ⚠️ **Status check:** "Leave request + approval flow (per org)" is already live, and considerably ahead of this "months 3–8, triggered by customer demand" placement — `workspace_leave_types` + `leave_requests` ship today (CLAUDE.md "Leave System"). It differs from the spec here in one important way: it is *not* an approval flow — submissions are auto-approved instantly with no admin review step. "Allowance config per user" and the email nudge / Slack integration were not found in the codebase and remain unbuilt, consistent with this roadmap.

## LATER — v3 (Year 2): The Platform Layer

Goal: 500 paying organisations. Venzio replaces Zoho Leave + attendance tool + field force tracker. Payroll integration makes it infrastructure.

| Feature | Why later | What unlocks it |
|---|---|---|
| Full leave tracker: types, balances, accrual, carry-over | Replaces Zoho Leave for existing customers | 100+ customers, validated leave request flow from v2 |
| National holiday calendar (India, state-level) | Required for compliant leave management | After leave tracker ships |
| Leave approval workflows (single + two-level) | Required for 50+ employee companies | After leave tracker ships |
| Payroll data pipe: Razorpay Payroll + Zoho Payroll | Closes the attendance → salary loop | 200+ customers, validated payroll formats confirmed |
| User productivity layer: focus sessions (Pomodoro), habit tracking | Makes Venzio a daily-open app regardless of employer | After 1,000 daily active users — organic demand signal |
| Google Calendar sync (read events as presence context) | Completes user's day picture | After focus sessions ship and are used by 20%+ of users |
| Native iOS + Android app | Better GPS, WiFi SSID on iOS, background presence | When GPS accuracy complaints exceed 10% of disputes |
| Enterprise plan: SSO, SAML, bulk user management, SLA | Enterprises 200–500 employees start asking | When average deal size consistently > ₹20,000/month |
| Form 16 / compliance export | CAs and tax professionals need structured attendance for payroll compliance | When payroll integration is live and 50+ companies use it |

> ⚠️ **Status check:** Two of these "Year 2, 100+ customers" items are already built at a basic level: a per-workspace **holiday calendar** (`workspace_holidays`, admin + member APIs, CSV/XLSX bulk import) and a **leave tracker** with types and computed balances (`workspace_leave_types`, `leave_requests`) both ship today (CLAUDE.md "Holiday Calendar", "Leave System"). What's *not* built yet, matching this roadmap: accrual carry-over, multi-level approval workflows (current leave requests are instantly auto-approved), the payroll data pipe, the productivity layer (focus/habit tracking), calendar sync, a native app, SSO/enterprise plan, and Form 16 export.

## What Is Never on This Roadmap

- Building a payroll engine — we pipe data in, we never process salaries
- Hardware integrations — biometrics, BLE, access cards
- Recruitment, performance management, or learning management
- On-premise or self-hosted deployment
- International launch before 500 Indian paying customers

> A later internal architecture note (`Instruction-Native-App.md`) does propose BLE beacon presence and native mock-location detection as part of a "native trust" evolution — this represents a change in direction from "never on this roadmap" for hardware/native integrations, and as of writing remains a proposal, not shipped code.

---

*Document owner: Founding Team | Roadmap Final | March 2026 | Reviewed monthly*
