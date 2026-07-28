# Go-to-Market Document

**Venzio — Presence Intelligence Platform**
*How Venzio acquires its first 100 paying organisations*
Source: `08_gtm_final.docx` — Final, March 2026

---

## GTM Philosophy

Two markets. Same product. Different sales motion. Hybrid-work companies are reached through founder networks and Slack communities. Field force companies are reached through branch managers and trade associations. Both convert through a 14-day free trial with a founder-run demo.

## Phase 1: Internal Validation (Weeks 1–6)

Goal: Deploy to our own company. Generate real data. Document time saved.

- Deploy on week 5 of build
- Run for 30 days: track false-negative rate, admin month-end time, employee adoption rate
- Document the before/after: "Month-end took 4 hours. After Venzio: 8 minutes."
- Interview every internal user at 2-week mark
- This becomes the first case study — our company, real numbers

## Phase 2: First 10 Organisations (Weeks 7–14)

### Channel 1: Warm network (Hybrid-work segment)
- List every founder and ops lead in personal network who might have hybrid + allowance pain
- Personal message, not cold email: "We built this for ourselves. Try it free for 30 days."
- Offer a 15-minute setup call — register their workspace together over screen share
- Ask for weekly feedback. Every piece of feedback becomes a product improvement.

Target: 5 companies. Expected conversion: 50%+ at this stage.

### Channel 2: Coworking space community
- Ask the WeWork/Awfis community manager to share at their monthly founder meetup
- Message in the coworking WhatsApp/Slack group: "Built an attendance tool for hybrid companies. Works in coworking spaces. Free for 60 days. DM me."
- Physical flyer at the coworking reception — QR code to venzio.ai

Target: 3 companies.

### Channel 3: Field force segment — direct outreach
- Identify 10 insurance distributors and pharma field force managers in Delhi NCR (LinkedIn search: "Branch Manager" + "LIC" or "HDFC Life" or "Bajaj Allianz")
- Message: "Your field agents are WhatsApp-ing photos to prove client visits. We built something that replaces that. Free for 60 days. Takes 5 minutes to set up."
- Ask: "How do you currently verify your agents visited their clients?" — this is the conversation opener

Target: 2 field force organisations in first phase.

## Phase 3: First 50 Paying Organisations (Months 3–6)

### Channel 4: LinkedIn content (organic)
- Post twice a week: tactical posts ("How to set up a hybrid work allowance policy") and story posts ("We lost ₹80,000 to unverified attendance claims before building Venzio")
- Engage in comments on hybrid work, field force, India startup posts
- Share the month-end case study as a long-form article — targets ops leads and founders

### Channel 5: Insurance industry communities
- IRDA-recognised agent forums and WhatsApp groups (large informal communities)
- Post: "If your manager makes you WhatsApp photos to prove client visits, there is a better way."
- Insurance agents are the users — they will pull their managers towards Venzio

### Channel 6: Product Hunt launch
- "Venzio — Presence Intelligence Platform. Users tap once. Companies see where their teams are."
- Prep: 30+ upvoters from network before launch day
- Launch Tuesday or Wednesday

Target: top 5 product of the day, 500+ sign-ups, 30+ org trials.

## The Two Sales Pitches

### Pitch for hybrid-work companies
"You pay your team ₹500 per office day but you're trusting them to self-report on Zoho. Venzio verifies presence using WiFi, GPS, and IP — no hardware, no app install, works in any coworking space. Your ops lead gets their month-end back."

> ⚠️ **Status check:** This pitch leans on WiFi as one of three equally-weighted verification signals. Today, only GPS and IP are evaluated in the AND-matching engine — WiFi capture exists but is dormant in matching (see `04-prd.md` and `docs/architecture/signal-matching.md`). The pitch's underlying claim (verification without hardware or app install) remains true regardless.

### Pitch for field force companies
"Your agents send selfies to a WhatsApp group to prove they visited clients. That's not a system. Venzio gives every agent a tap-once check-in that records their GPS location and time. You see their full day in a clean dashboard. No WhatsApp groups."

## First 90 Days OKRs

| Objective | Key result | Target |
|---|---|---|
| Product works | False-negative rate (present, not counted) | < 5% |
| Product works | Admin month-end time | < 10 minutes |
| Market fits | External organisations onboarded | 10 |
| Willingness to pay | Paying organisations | 5 |
| Retention | Orgs still active after 30 days | > 80% |
| User engagement | Daily active users | > 90% of enrolled employees |
| Field force proof | Field force orgs onboarded | 2 |

## What We Will Not Spend On (Before ₹5L MRR)

- Paid advertising — too expensive for early-stage CAC
- PR agencies
- Sales team hires — founder-led until product-market fit confirmed
- Brand design agencies — ship with clean, functional design
- Conferences or trade shows

---

*Document owner: Founding Team | GTM Final | March 2026*
