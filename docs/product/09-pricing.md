# Pricing and Packaging

**Venzio — Presence Intelligence Platform**
*Final B2B pricing — presence intelligence platform*
Source: `09_pricing_final.docx` — v3.0 Final, March 2026

---

## Pricing Philosophy

Users pay nothing, ever. Organisations pay per enrolled user per month to query presence data. The platform is free for the supply side (users) and paid for the demand side (organisations).

## Plan Tiers

| | Free | Starter | Growth |
|---|---|---|---|
| Price | ₹0 forever | ₹49 / enrolled user / month | ₹89 / enrolled user / month |
| Enrolled users | Up to 10 | Unlimited | Unlimited |
| Office / signal locations | 1 | 1 | Up to 5 |
| Presence history | 3 months | 12 months | All time |
| Dashboard — today + monthly | Yes | Yes | Yes |
| User profile — full event history | Yes | Yes | Yes |
| Admin override | No | Yes | Yes |
| CSV export | No | Yes | Yes |
| Signal filtering (WiFi/GPS/IP) | View only | Full | Full |
| Company-wide analytics | No | No | Yes — v2 |
| Allowance config per user | No | No | Yes — v2 |
| Leave management | No | Add-on | Included — v3 |
| Payroll data pipe | No | No | Yes — v3 |
| Support | None | Email 48h SLA | Priority email 12h SLA |
| Billing | Free forever | Monthly, cancel anytime | Monthly or annual (2 months free) |

> ⚠️ **Status check:** The plan *limits* (10 users / 3 months / 1 location on Free; unlimited users / 12 months / 1 location on Starter; unlimited users / 7 years ("all time") / 5 locations on Growth) match `lib/plans.ts` exactly. The *prices* have moved: the live `/pricing` page (`src/app/(public)/pricing/page.tsx`) shows **₹69/user/month for Starter** and **₹99/user/month for Growth**, not ₹49 / ₹89 as specced here. Separately, "Leave management" is listed as Starter add-on / Growth-included — but in the current codebase the leave system (`workspace_leave_types`, `leave_requests`) is not gated by plan at all; it is available to any workspace regardless of tier. The payroll data pipe and per-v2 "Allowance config per user" remain unbuilt on any plan, consistent with this table.

## Upgrade Triggers — How Each Plan Converts

### Free → Starter
- 11th employee from the domain signs up — admin wants full visibility
- Admin needs CSV export at month-end for payroll
- Admin needs admin override capability to correct edge cases

These triggers happen naturally within 30–60 days for any company with 15+ employees.

### Starter → Growth
- Company opens a second coworking space or office — needs second location
- Company has been on Venzio for 12+ months — needs full historical data for HR audit or compliance
- Admin wants allowance auto-calculation (v2 feature)

These triggers happen naturally as a company grows.

## The Double-Billing Model

If Rahul is enrolled in both Acme Corp and ClientCo, both companies pay ₹49 or ₹89 for him independently. This is correct, not a bug.

- Each org pays for independent access to data they independently use
- Rahul generates independent value for each org — his presence at Acme Corp office does not reduce his value to ClientCo
- Both organisations make independent decisions to add him — neither knows about the other
- Freelancers and field agents enrolled in multiple companies become revenue multipliers

> This is a foundational business-model decision (PROJECT_HANDOFF_SUMMARY.md §2), directly enabled by the "no `workspace_id` on `presence_events`" architecture — it is not something billing code enforces today (no Razorpay or billing integration was found in the codebase), but the data-model precondition for it is real and unchanged.

## Field Force Pricing Consideration

Field force organisations (insurance, pharma, banking field teams) have a different usage pattern — their agents check in multiple times per day at different locations. The core per-user pricing model is unchanged. However, config-light orgs see significantly more value from the Growth plan because their dashboard is richer (all events unfiltered) and they need the analytics to manage 30+ agents effectively.

Consider: after first 10 field force organisations are live, evaluate whether a "Field" plan at ₹69/user/month (between Starter and Growth, includes config-light full-event dashboard) makes commercial sense. Do not pre-build this — validate first.

## Unit Economics

| Metric | Month 6 target | Month 12 target |
|---|---|---|
| Paying organisations | 50 | 200 |
| Average enrolled users/org | 40 | 45 |
| Plan mix (Starter/Growth) | 65% / 35% | 55% / 45% |
| Average revenue/org/month | ₹2,580 | ₹2,900 |
| MRR | ₹1,29,000 | ₹5,80,000 |
| ARR | ₹15,48,000 | ₹69,60,000 |
| Monthly churn | < 3% | < 2% |
| Gross margin | > 90% | > 92% |

## Future Revenue Layers

| Layer | When | Model |
|---|---|---|
| Allowance display (Growth) | v2 — included in Growth | Already in Growth pricing — upgrade driver |
| Leave management (add-on) | v3 | ₹20/user/month on Starter, included in Growth |
| Payroll data pipe | v3 | ₹999/month flat per workspace — charged for the pipe, not per user |
| Enterprise plan | When avg deal > ₹20k/month | Custom — SSO, SLA, dedicated support |
| Form 16 / compliance export | Year 3 | Premium add-on, TBD pricing |

## What We Do Not Do on Pricing

- Never charge users — not now, not ever
- Never charge per check-in or per export
- Never delete data on downgrade — gates are query-time filters only
- No price changes in first 12 months of operation
- 60 days minimum notice for any future price change
- Existing customers grandfathered at their price for 12 months from any increase

---

*Document owner: Founding Team | Pricing v3.0 Final | March 2026*
