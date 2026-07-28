# Design Specification

**Venzio — Presence Intelligence Platform**
*UI/UX guidelines for Venzio — both user and org sides*
Source: `10_design_spec.docx` — v1.0 Final, March 2026

---

## Design Philosophy

Venzio must feel like a personal tool, not a corporate surveillance system. The user side should feel like a well-designed productivity app — calm, clean, personal. The org side should feel like a confident analytics dashboard — data-forward, trustworthy, actionable.

The biggest design risk is making Venzio feel like HR software. HR software feels like paperwork. Venzio must feel like something you want to open. The design decisions below are all in service of that goal.

## Brand

| Attribute | Decision | Rationale |
|---|---|---|
| Product name | Venzio | Clean, self-explanatory, works as both noun and verb |
| Tagline | Presence Intelligence Platform | Positions as data/intelligence, not surveillance |
| Logo concept | A clean checkmark that doubles as a location pin | Combines presence (location) with confirmation (checkmark) |
| Voice | Direct, warm, never corporate — first person plural for the company, second person for user-facing copy | Users should feel Venzio is on their side |

> ⚠️ **Status check:** The logo concept described here ("a checkmark that doubles as a location pin") is a holdover from the CheckMark name and was superseded during the rename. The current brand manual (`VENZIO_BRAND_IMPLEMENTATION.md`) specifies a different mark: "a location pin whose circular head contains a bold checkmark (the V-shape)... symbolising 'I was here' and 'verified presence'," with the wordmark set in lowercase Plus Jakarta Sans Bold. The tagline "Presence Intelligence Platform" and the warm, non-corporate voice both still hold.

## Colour System

| Token | Hex | Usage |
|---|---|---|
| --brand-primary | #1B4DFF | Primary actions, CTAs, links — electric blue, confident |
| --brand-secondary | #0D1B2A | Deep navy — primary text, headings, org dashboard chrome |
| --accent-presence | #00D4AA | Teal-green — "present" states, positive indicators, user-side accents |
| --accent-warning | #F59E0B | Amber — pending states, nudges, soft warnings |
| --accent-danger | #EF4444 | Declined, error states — used sparingly |
| --surface-0 | #FFFFFF | Primary surface |
| --surface-1 | #F8FAFC | Secondary surface — cards, panels |
| --surface-2 | #F1F5F9 | Tertiary surface — table rows, backgrounds |
| --text-primary | #0D1B2A | Primary text |
| --text-secondary | #64748B | Secondary text, labels, captions |
| --text-muted | #94A3B8 | Muted text, placeholder, disabled |
| --border | #E2E8F0 | Default border |

No purple gradients. No generic AI-aesthetic color choices. The blue is electric and specific — it is Venzio blue, not a generic primary.

> ⚠️ **Status check:** This blue-and-white palette is what CLAUDE.md still documents today (`--brand: #1B4DFF`, `--navy: #0D1B2A`, `--teal: #00D4AA`, etc.), but it is not what actually ships. `src/app/globals.css` defines a **green** brand palette instead — `--brand: #1d9e75`, `--navy: #0a2318`, a dark theme as default (`--venzio-green` family, near-black surfaces) — matching the later `VENZIO_BRAND_IMPLEMENTATION.md` overhaul (`--venzio-green: #00C27A` on a `#050A07` dark background), not this document or CLAUDE.md's design-system table. In other words: this docx and CLAUDE.md's "Design System" section are both stale relative to the live CSS on brand colour specifically. "No purple gradients, no drop shadows" as house rules are still honoured.

## Typography

| Role | Font | Weight / Size | Usage |
|---|---|---|---|
| Display | Syne | 700, 36–48px | Home screen headline: "I'm here" button label, marketing headings |
| Heading | Syne | 600, 20–28px | Section headings, dashboard titles |
| Body | DM Sans | 400, 14–16px | All body copy, descriptions, dashboard data |
| Data / mono | JetBrains Mono | 400, 13px | Timestamps, GPS coordinates, IP addresses, technical data in user profiles |
| Label | DM Sans | 500, 12px | Table headers, tags, badges, status labels |

Both Syne and DM Sans are available on Google Fonts — no licensing cost. JetBrains Mono is open source.

> ⚠️ **Status check:** Live typography (`src/app/globals.css`) uses **Plus Jakarta Sans** for body/display and **Playfair Display** for serif/display accents, not Syne + DM Sans. JetBrains Mono for timestamps/data is the one typeface choice here that is still accurate.

## User-Side Design

### Home screen — the daily interface

This is the most important screen in the product. It must be instantly usable without reading anything.

| Element | Design decision |
|---|---|
| "I'm here" button | Enormous. Full-width or near-full-width. 64px height minimum on mobile. Brand primary blue. Syne 700 24px. Subtle pulse animation when no check-in today — catches attention without being annoying. |
| "I'm leaving" button | Appears below after active check-in. Smaller than "I'm here" — secondary action. Outline style. Teal accent color. |
| Today's timeline | Below the buttons. Each event is a card: location name (from note or GPS-derived area), time range, duration if checked out. Minimal — time and place, nothing else. |
| Status indicator | Top of screen: a small colored dot + text. Green + "Checked in" or Gray + "Not checked in today". Never more than one line. |
| Month summary strip | Above the timeline. 3 numbers in a row: "12 days" / "47 hours" / "8 locations". Tappable to expand to full monthly view. |
| Org section | Bottom of screen, collapsible. Small section: "Your orgs" showing org name + days counted this month. Not prominent — the personal layer comes first. |

### Personal timeline / history view
- Calendar-style month view — each day is a small tile showing event count
- Tap a day to see all events for that day in detail
- Event detail: checkin_at, checkout_at, duration, GPS coordinates on a small embedded map, WiFi SSID, note
- Color coding: days with events are teal. Days without are gray. Weekends slightly muted.
- Horizontal scroll between months — no tabs, no dropdowns

### Check-in confirmation micro-animation
- On successful check-in: the "I'm here" button momentarily shows a checkmark icon (0.3s), then text changes to "Checked in at [time]" with a brief green flash
- The animation communicates success without being distracting
- No confetti, no full-screen celebration — this is a daily action, not a special event

### Mobile-first layout rules
- Minimum tap target: 44×44px for all interactive elements
- "I'm here" button: 64px height, full width minus 32px padding
- Bottom navigation: Home, Timeline, Orgs — 3 items maximum
- Top bar: Venzio logo left, user avatar right (taps to profile)
- No horizontal scroll on any list — stack everything vertically on mobile

> ⚠️ **Status check:** Bottom navigation is a 4-item bar today — Home, Timeline, Orgs, Settings (`src/components/user/BottomNav.tsx`) — one more than the "3 items maximum" rule stated here. The 44×44px minimum tap target rule is preserved (CLAUDE.md "Design System": "Minimum touch target: 44px height").

## Org-Side Design

### Dashboard — the command centre

| Element | Design decision |
|---|---|
| Layout | Left sidebar for navigation. Main content area. No top navigation bar — sidebar is persistent on desktop, drawer on mobile. |
| Sidebar items | Today, Monthly, Users, Disputes, Settings, Export. Icons + labels. Active state: brand primary fill. |
| Today view | Table: user avatar + name, status badge (Present/Not marked), check-in time, location matched, event count today. Sortable. Filterable. |
| Status badges | Present: teal filled pill. Not marked: gray outline pill. Never red — "not marked" is neutral, not negative. |
| User row click | Slides open a right panel (not a new page) — user profile with full event timeline. Side-panel pattern keeps the list context visible. |
| Monthly grid | Compact calendar grid per user. Each day cell: colored dot if present, empty if not. Hover shows event count. Click opens day detail. |
| Data density | Org dashboard is information-dense by design — admins are power users reviewing many employees. Use compact row heights (40px) and data-forward typography. |
| Empty states | If no employees yet: "Your team will appear here automatically when they sign in with @yourdomain.com." Clean illustration, no sad faces. |

### User profile panel
- Slides in from the right when admin clicks a user in the dashboard
- Header: user avatar, name, email, enrolled orgs, date enrolled
- Event timeline: chronological list of all events within plan history window
- Each event: timestamp, WiFi SSID, GPS pin link (opens OpenStreetMap), duration, note, match status (Counted / Not counted — with reason for not counted)
- Matched events: normal styling. Unmatched events: muted text + small label "Not counted — GPS 420m from nearest location"
- "Count this event" button on unmatched events. Confirmation dialog: "Mark [date/time] as Present for [org]? This creates a manual override."
- Panel closes on click-outside or X button

### Analytics dashboard (Growth — v2)
- 3 metric cards at top: average days present/month, peak in-office day, top employee by presence
- Line chart: company presence rate over last 6 months (% of enrolled employees present each month)
- Bar chart: presence by day of week (shows which days are busiest in-office)
- Employee ranking table: sorted by days present, with trend arrow (up/down vs last month)
- All charts use brand colors — teal for presence data, amber for warning states

> This analytics dashboard remains unbuilt, consistent with its "Growth — v2" label.

### Org setup flow
- Step-by-step wizard: 4 steps maximum. Progress shown as dots at top.
- Step 1: Company name + domain
- Step 2: Domain verification — two options shown side by side: "Email verification" and "DNS record". User picks one. Clear instructions.
- Step 3: Register office (GPS capture). Big map preview. Geofence slider with live circle update.
- Step 4: Register WiFi (auto-read SSID). Single confirmation card: "You are on: [SSID]. Is this your office WiFi?" Yes/No.
- All steps are skippable except Step 1 — org can complete setup later from Settings

## Interaction Patterns

| Pattern | Implementation |
|---|---|
| Loading states | Skeleton screens — not spinners. Data loads feel progressive, not blocked. |
| Empty states | Friendly, specific copy. Never "No data found." Always "Your team will appear here when they check in." |
| Error states | Inline — never full-page. Red border on the specific field. Error copy below the field. |
| Confirmation dialogs | Slide-up sheet on mobile, centered modal on desktop. Two buttons: confirm (filled, brand color) and cancel (text only). |
| Success states | Inline green check with auto-dismiss after 2 seconds. Not a toast — the component itself confirms success. |
| Navigation | Bottom nav on mobile (3 items). Left sidebar on desktop. No top navigation bar on either — creates more vertical space for content. |
| CSV export | Clicking Export immediately downloads — no modal, no confirmation. The file downloads. That's the confirmation. |
| Responsive breakpoints | Mobile: < 768px. Tablet: 768–1024px. Desktop: > 1024px. Org dashboard only fully functional on tablet+. User home screen is mobile-first. |

> Skeleton-loaders-not-spinners is still an explicit, enforced house rule today (CLAUDE.md: "Never use spinners - use skeleton loaders").

## What the Design Must Never Do

- Never make the user feel surveilled — no red alerts, no "you didn't check in today" warnings on the user side
- Never use corporate HR aesthetics — no form-heavy layouts, no bureaucratic color choices
- Never use purple gradients or the standard AI SaaS aesthetic (Inter + purple + white = not Venzio)
- Never show loading spinners — use skeleton screens for all data loading states
- Never use more than 3 levels of navigation depth — if you need 4 clicks to reach something, redesign the information architecture
- Never make the check-in button hard to find — it is always the first thing visible on the user home screen

## Design Tools and Handoff

- Design tool: Figma — component library to be built before frontend development starts
- Icon library: Lucide Icons — open source, consistent stroke weight, React components available
- Illustration style: None in v1 — use typography and color for empty states, not illustrations
- Component approach: Tailwind CSS utility classes — no component library dependency (shadcn/ui acceptable for form elements only)
- Font loading: Google Fonts via Next.js font optimization — self-hosted for performance
- Map component: Leaflet.js with OpenStreetMap tiles — free, open source, React wrapper available
- Charts (v2): Recharts — React-native, responsive, customisable with brand colors

---

*Document owner: Founding Team | Design Spec v1.0 Final | March 2026 | Provide this document alongside PRD and HLD to Claude Code.*
