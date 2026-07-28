# Vision + Mission

**Venzio — Presence Intelligence Platform**
*Why Venzio exists and where it is going*
Source: `01_vision_mission_final.docx` — Final, March 2026

---

## Vision

A world where every person owns a tamper-resistant record of where they were and what they did — and every organisation can verify presence without hardware, IT setup, or manual chasing.

The way we track physical presence today is broken on both sides. Employees are forced to self-report attendance into tools they hate using. Field workers photograph themselves on WhatsApp to prove they visited clients. Companies manually reconcile spreadsheets at month-end, pay for unverified claims, and have no audit trail when disputes arise.

Venzio flips this entirely. The user owns their presence history — every check-in, every location, every timestamp. Organisations pay to query and understand that data according to their own rules. The user is never a product or a subject. The user is the source of value, and they are rewarded with a tool that is genuinely useful to them regardless of whether any company ever pays for their data.

## Mission

We give every professional a personal presence and time intelligence layer they actually want to use — and give every organisation a reliable, queryable record of workforce presence without hardware, app installs, or IT dependency.

We serve two distinct markets from one shared data layer. For hybrid-work companies, we solve the office attendance verification problem. For field-force organisations — insurance, pharma, banking — we replace WhatsApp-photo workflows with structured, GPS-verified visit records. In both cases, the user taps once. The intelligence flows to whoever needs it.

## The Core Model — Non-Negotiable

**Users own their data**
A check-in event belongs to the user, not to any company. It is stored independently of any organisation. The user can see their full history at any time. No company can delete, modify, or hide a user's events from the user.

**Organisations query, they do not own**
When an organisation's admin opens their dashboard, the system runs a query: find presence events from enrolled users that match this organisation's signal configuration. The result is a filtered view of user-owned data — not a company record.

**Users are never blocked**
No user is ever told their domain is not verified, their plan does not support them, or they need to contact their admin. All plan limits and access controls apply exclusively to the organisation side of the platform.

**Organisations choose their filter depth**
A software company registers their office WiFi, GPS coordinates, and IP context. Their dashboard filters presence events to office-matched events only. An insurance company registers nothing except their employee list — their dashboard shows every presence event for every enrolled agent, giving field managers a complete location diary with no configuration required.

## What Venzio Is — One Sentence

Venzio is a presence intelligence platform where users record their location-time history freely, and organisations pay to query it according to their own verification needs.

## Product Scope — v1 to Long-Term

### v1 — The wedge (build now)
- Presence event recording: multi-check-in per day, wifi + GPS + IP captured, optional note
- Two org types: config-heavy (office signal matching) and config-light (field force — all events visible)
- User home: personal timeline of events, own analytics
- Org dashboard: filtered event view, CSV export, user profile with full transparent history

### v2 — Stickiness (months 4–8)
- Allowance configuration per user per org (rate, min days, cap) — calculation shown, not paid
- Leave requests per org — user applies, admin approves
- Org-wide analytics — presence trends, peak days, field visit counts
- User home analytics — streaks, monthly summaries, time-at-locations

### v3 — Platform (year 2)
- Full leave tracker — types, balances, accrual, carry-over, approval workflows
- National + company holiday calendar
- Payroll data pipe — Razorpay, Zoho Payroll
- User productivity layer — focus sessions, habit tracking, optional calendar sync

> ⚠️ **Status check:** A leave system and a holiday calendar are already live today — much earlier than this "year 2" placement suggests. `workspace_leave_types` + `leave_requests` (`src/lib/db/queries/leaves.ts`) and `workspace_holidays` (`src/lib/db/queries/holidays.ts`) both ship now. They are simpler than described here, though: leave requests are auto-approved on submission with no approval workflow, and there is no accrual carry-over — balance is `periods_elapsed × accrual_credits − used_days`, recomputed on the fly (see CLAUDE.md "Leave System"). The payroll data pipe and user productivity layer (focus sessions/habit tracking) remain unbuilt, consistent with this document.

## What We Will Not Do

- Build a payroll engine — we pipe data into existing tools, we never touch money
- Require hardware of any kind — no biometrics, no BLE beacons, no access cards
- Block any user from using the platform regardless of their employer's plan
- Target enterprises with 500+ employees before reaching 500 paying customers
- Launch outside India before 500 domestic paying organisations

## Success Definition

### 12 months
- 500 daily active users marking presence (across all org types)
- 50 paying organisations — mix of hybrid-work companies and field-force companies
- Zero payroll disputes caused by Venzio data errors
- NPS > 50 from paying org admins

### 3 years
- Recognised as the default presence layer for Indian hybrid and field-force workforces
- 5,000 paying organisations
- Series A raised on ARR and retention
- Payroll integration live with at least one major Indian payroll provider

---

*Document owner: Founding Team | Final version | March 2026*
