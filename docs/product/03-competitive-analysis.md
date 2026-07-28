# Competitive Analysis

**Venzio — Presence Intelligence Platform**
*Market map, competitors, and Venzio's differentiated position*
Source: `03_competitive_analysis_final.docx` — Final, March 2026

---

## Two Markets, One Platform

Venzio competes in two distinct markets simultaneously. In the hybrid-work attendance market, it competes with HRMS platforms like Keka and Zoho. In the field force tracking market, it competes with enterprise tools like Leadsquared Field Force and informal WhatsApp-based workflows. Understanding both landscapes separately is critical.

## Market 1: Hybrid-Work Attendance

### Tier 1: Full HRMS (indirect)

| Company | Strength | Gap vs Venzio | Pricing |
|---|---|---|---|
| Keka | Complete HR suite. Strong brand in Indian startups. | Requires IT setup. App install. No coworking-aware check-in. Overkill for 20–100 person teams. | ~₹6,000–9,000/emp/year |
| Darwinbox | Enterprise grade. Strong 200–2,000 employee segment. | Not self-serve. Long implementation. Wrong segment entirely. | Custom enterprise |
| greytHR | Indian payroll + compliance focus. | Biometric hardware. Not built for hybrid/coworking context. | ~₹3,000–5,000/emp/year |
| Zoho People | Part of Zoho suite. Many companies already use Zoho. | Attendance is a weak feature. No GPS/WiFi verification. Self-declaration only. | ~₹1,200–2,400/emp/year |

### Tier 2: Lightweight attendance (direct)

| Company | Strength | Gap vs Venzio | Pricing |
|---|---|---|---|
| TimeTec | Mobile attendance with GPS. SEA brand. | Requires app install. Not India-focused. | ~₹1,500/emp/year |
| Attendance Bot (Slack) | Slack-native. Zero friction. | No location verification at all. Pure honour system. | ~₹250/user/month |
| Spine HR | Indian SMB focus. | Biometric-first. UI dated. No coworking use case. | ~₹2,000–4,000/emp/year |

### Tier 3: Status quo (what people actually use)

| Method | Why used | Pain it causes |
|---|---|---|
| Zoho Leave with WFH type | Already paying for Zoho | Pure self-reporting. No verification. Month-end chaos. |
| Google Form + Sheet | Free | 100% manual reconciliation. No audit trail. |
| WhatsApp message | Zero setup | No record. High abuse. Manager overhead enormous. |

## Market 2: Field Force Tracking

### Enterprise players (indirect — wrong segment for them)

| Company | Strength | Gap vs Venzio |
|---|---|---|
| Leadsquared Field Force | GPS tracking + CRM integration. Enterprise grade. | ₹2,000+/user/month. Requires IT setup. CRM-first, not presence-first. Overkill for 20–100 agent teams. |
| Salesforce Maps | Deep CRM integration. Global brand. | Not Indian market-focused. Expensive. Requires Salesforce CRM. |
| BeatRoute | Indian field sales tool. Good for FMCG. | Requires native app. Complex setup. Expensive for small distributors. |
| Unolo | Indian GPS tracking for field teams. | App install required. Location tracking feels like surveillance — no user benefit. |

### The real competition: WhatsApp

The dominant field force "tool" in India is a WhatsApp group where agents send selfies with GPS screenshots. This is zero cost, zero setup, and zero structure. Venzio must be dramatically better UX while being nearly as simple to start.

## Venzio's Differentiation Matrix

| Capability | Venzio | Keka | Zoho People | Leadsquared | WhatsApp |
|---|---|---|---|---|---|
| Works in coworking spaces | Yes | Partial | No | Yes | Yes |
| No app install required | Yes (PWA) | No | No | No | Yes |
| Works for field agents | Yes | No | No | Yes | Yes |
| Config-light mode (no signal setup) | Yes | No | No | No | Yes |
| User-owned history | Yes | No | No | No | Partial |
| Multi-org per user | Yes | No | No | No | No |
| GPS + WiFi + IP triple signal | Yes | GPS only | No | GPS only | Screenshot |
| Zero IT setup | Yes | No | No | No | Yes |
| Self-serve under 10 min | Yes | No | No | No | Yes |
| Structured queryable data | Yes | Yes | Partial | Yes | No |
| Under ₹100/user/month | Yes | No | Partial | No | Free |

> ⚠️ **Status check:** "GPS + WiFi + IP triple signal" overstates what is live today. The current AND-matching engine (`src/lib/signals.ts` → `queryWorkspaceEvents()`) only evaluates **GPS** and **IP** as configured signal types — WiFi SSID is captured and hashed but is not part of the matching logic at all right now (`configuredTypes` is built from `gps`/`ip` signals only). This matches the documented gap in `Instruction-Native-App.md`: "WiFi — Dormant — DB columns and admin API stubs exist; live matching code does not use WiFi." IP itself is also flagged there as a candidate for demotion from a hard AND-gate to a contextual trust signal, which has not happened yet either.

## Positioning Statement

For Indian companies with hybrid or field-force workforces, Venzio is the only presence intelligence platform that works without hardware, app installs, or IT setup — and gives users a tool they actually want to use independently of any employer.

## Competitive Risks

### Risk 1: Zoho ships GPS-verified attendance
Probability: Medium. Timeline: 6–18 months. Mitigation: Move fast. Get to 200 paying organisations before it ships. Data lock-in — companies with 12 months of verified history are hard to migrate. The config-light field-force model is outside Zoho's roadmap entirely.

### Risk 2: Unolo or similar pivots to the Venzio model
Probability: Low short-term. Unolo is surveillance-first — their model is company-owns-data. Rebuilding around user-owns-data is a fundamental architecture change, not a feature.

### Risk 3: WhatsApp adds structured location logging
Probability: Very low. Meta has no incentive to build enterprise presence tooling. And even if they did, the data would be WhatsApp-owned, not user-owned.

---

*Document owner: Founding Team | Final version | March 2026*
