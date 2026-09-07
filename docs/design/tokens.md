# Tokens

Every custom property in `src/app/globals.css`, its value, and when to use it.

All tokens are declared on `:root`. There is **no dark mode** — no `prefers-color-scheme` block, no `[data-theme]` attribute. The palette below is the only palette.

A second block, `@theme inline`, re-exports most of these to Tailwind so `bg-brand`, `text-text-muted`, `border-border`, `rounded-lg` and friends resolve to the same values. That is a mapping, not a second source of truth: change the `:root` value and the utility follows.

---

## Brand and semantic colour

| Token | Value | Use |
|---|---|---|
| `--brand` | `#1d9e75` | Primary buttons, links, active nav, the verified state, chart fills, focus borders |
| `--brand-hover` | `#157a56` | Hover fill on `.btn-primary`. Nothing else — hover elsewhere is a `--surface-2` wash |
| `--navy` | `#0a2318` | Headings and `.stat-num`. A very dark green, not a blue |
| `--teal` | `#00D4AA` | Success accent. Currently only the toast's success dot |
| `--amber` | `#F59E0B` | Warnings, the `partial` status, the IP signal |
| `--danger` | `#EF4444` | Errors, destructive actions, the `none` status, `.navbadge` |
| `--info` | `#2563EB` | The `override` status — the one deliberately non-green semantic in the app |

> The palette is **green**. Any doc, mock or component still citing `#1B4DFF` is stale.

`--info` exists so an admin override does not read as either "verified" (green) or "failed" (red). An override is neither: it is a human decision that bypassed signal matching entirely, and it should look like a different *kind* of thing, not a different grade of the same thing. See [status.md](./status.md).

## Surfaces and text

| Token | Value | Use |
|---|---|---|
| `--surface-0` | `#FFFFFF` | Card backgrounds, overlay panels, the sidebar, the active tab pill |
| `--surface-1` | `#f0faf5` | Page background (`.shell-me` sets it explicitly) |
| `--surface-2` | `#e4f5ec` | Inputs, progress/split-bar tracks, `.tabbar` track, chip fills, `.navitem` hover, `.dash-ic` badges |
| `--text-primary` | `#0a2318` | Body text |
| `--text-secondary` | `#3d6b52` | Field labels, `.t-secondary`, inactive nav, `.btn-ghost` |
| `--text-muted` | `#7aab92` | `.t-eyebrow`, `.t-muted`, hints, empty states, table headers, inactive `.me-navitem` |
| `--border` | `rgba(29,158,117,0.18)` | Every border in the app |
| `--header-bg` | `#0d2118` | Dark chrome. The `/ws` PWA `theme-color`, and the live toast background |

`--border` being a translucent green rather than a grey is deliberate: it tints toward whatever it sits on, so a border reads correctly against `--surface-0`, `--surface-1` and `--surface-2` without needing three border tokens.

## Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | `.icon-btn`, `.skeleton` |
| `--radius-md` | `10px` | Controls: `.btn`, `.input`, `.navitem`, `.rowlink`, `.dropzone`, `.dropdown-menu`, `.toast` |
| `--radius-lg` | `16px` | `.card` |
| `--radius-xl` | `22px` | Overlay panels: `.modal .panel`, `.me-sheet .panel` (top corners only) |

The ladder encodes hierarchy: the bigger the surface, the rounder it is, so a modal reads as a larger object than the card behind it even before you notice the shadow.

## Elevation

| Token | Value | Where it is allowed |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(10,35,24,0.06)` | `.tabbar button.active` only |
| `--shadow-md` | `0 4px 16px rgba(10,35,24,0.08)` | `.modal .panel`, `.dropdown-menu`, `.toast` |

Two overlays use a hand-written directional shadow instead of a token, because they enter from an edge and the shadow has to point away from it: `.slideover .panel` uses `-8px 0 32px rgba(0,0,0,0.18)` and `.me-sheet .panel` uses `0 -8px 32px rgba(0,0,0,0.18)`.

Both shadow tokens are tinted with the navy `rgba(10,35,24,…)` rather than pure black, so elevation stays in the same colour family as everything else.

Two more `box-shadow` declarations exist but are **not elevation**, and neither uses a shadow token:

- `.hoverlift:hover { box-shadow: 0 2px 14px var(--ring) }` — a green *glow*, not a drop shadow, on hover only, and only inside `@media (hover: hover) and (pointer: fine)`. It signals "this card is a link", which is why it appears on the workspace picker cards, the `/me/orgs` cards and the `/ws` dashboard tiles. The card at rest still has no shadow.
- `.checkin-btn { box-shadow: 0 0 0 8px color-mix(in srgb, var(--brand) 14%, transparent) }` — a spread-only ring with no blur and no offset, i.e. a halo, the same idea as `--ring` at a larger radius.
- `.toggle .knob` carries a tiny `0 1px 3px rgba(0,0,0,0.22)` so the knob reads as sitting *on* the track. It is a 19px object; this is the physical affordance of a switch, not page elevation.

Apart from those, **nothing in the app gets a shadow.** See the elevation rule in [README.md](./README.md).

## Glow: `--ring` vs `--green-glow`

These are the same hue at two different alphas, and mixing them up is the most likely token mistake in this codebase.

| Token | Value | Purpose |
|---|---|---|
| `--ring` | `rgba(29,158,117,0.28)` | Focus rings, signal-dot halos, stepper glow, hover lift |
| `--green-glow` | `rgba(29,158,117,0.18)` | Marketing ambient blobs |

**`--ring` is functional.** It is the app's focus indicator (`.input:focus { box-shadow: 0 0 0 3px var(--ring) }`), the halo on a matched signal dot (`.signal-row.ok .dot`), the glow on the current wizard/stage step, and the hover lift on `.hoverlift`. Every one of those has to be *noticed*: a focus ring nobody sees is not an accessibility feature. So it is the stronger of the two, at 0.28.

**`--green-glow` is atmospheric.** It fills the three large `animate-float` blobs behind the marketing Hero, the radial wash on the login page, and similar decorative gradients. Those are 200–500px objects. At 0.28 they would compete with the headline sitting on top of them and the page would look foggy; at 0.18 they read as ambient light.

The rule: **if a user needs to see it to operate the control, use `--ring`. If it is scenery, use `--green-glow`.** Do not "unify" them — they diverge on purpose, and the comment above `--ring` in `globals.css` says so.

## Easing

| Token | Curve | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | The default. Fast start, long settle. Presses, hovers, scrims, `.fx-snap`, `.progress` bar growth |
| `--ease-inout` | `cubic-bezier(0.77,0,0.175,1)` | Slow-in slow-out, for long symmetric moves. Only the check-in celebration rings |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Overshoots past 1. The toggle knob, the modal, the slide-over, the toast, `.fx-spring` |
| `--ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | Very fast start, very long tail. The bottom sheet only |

Full explanation of when each is appropriate: [motion.md](./motion.md).

## The marketing palette

These tokens back `src/components/Hero.tsx` and the other landing components, which render dark. They are exported to Tailwind under `venzio-*` names (`bg-venzio-bg-card`, `text-venzio-text-muted`, …). **App surfaces do not use them.**

| Token | Value |
|---|---|
| `--green` | `#1d9e75` (same as `--brand`) |
| `--green-dim` | `#157a56` |
| `--green-glow` | `rgba(29,158,117,0.18)` |
| `--bg-dark` | `#06100d` |
| `--bg-card` | `#0c1e17` |
| `--bg-card2` | `#0f2419` |
| `--venzio-text` | `#e8f5ef` |
| `--venzio-muted` | `#7aab92` (same as `--text-muted`) |
| `--venzio-border` | `rgba(29,158,117,0.15)` |

## Workspace swatch colours — the badge contract

Not tokens: a JS palette, because the colour is *derived from data*, not chosen by a designer at the call site.

`SWATCH_COLORS` + `swatchColor(seed)` in **`src/lib/workspace-color.ts`** is the **single implementation**. It hashes the seed and indexes an 8-colour palette, so the same workspace gets the same colour on every device with nothing stored.

**Always seed on the workspace `id`, never the `slug`.** A workspace can be renamed and re-slugged; its id is stable, so its colour is too. Recolouring a workspace out from under someone destroys the recognition the swatch exists to create.

Two call sites, and the reason the helper was extracted:

| Surface | Uses it for |
|---|---|
| `MeTopbar` | The `.ws-pill .swatch` and each row of the switcher sheet |
| `NotificationRow` | The per-workspace badge in the unified `/me/notifications` view |

They must agree. A badge whose colour disagrees with the pill is worse than no badge at all — it teaches the wrong association — and two copies of the function would drift the moment either palette is touched. If a third surface needs a workspace tint, import this; do not re-derive one.

**Do not cross it with the people palette.** `AVATAR_COLORS` in `src/app/ws/[slug]/people/PeopleClient.tsx` and `EmployeesClient.tsx` is a separate 8-colour list seeded on a *person*. Different subject, different palette; sharing them would make a workspace and a colleague read as related.

A notification with no workspace (account-level) gets `var(--text-muted)` and a neutral "Personal" badge rather than a tint — inventing a colour would invent a workspace.

## Scoped variables

Three tokens are not global — they are set on an element to parameterise a shared class, so callers do not need an inline style:

| Variable | Set by | Default |
|---|---|---|
| `--progress-fill` | Caller of `Progress`, to recolour the bar | `var(--brand)` |
| `--table-min` | `DataTable`'s `minWidth` prop, on `.dash-table-scroll` | `640px` |
| `--dx` / `--dy` | `CheckinButtons`, per particle, for the `ciDot` scatter | none |

This is the sanctioned way to vary one value on a shared class. Reach for it before reaching for an inline style block.

## Fonts

Loaded from Google Fonts by the `@import` on line 1 of `globals.css`, and exposed as `--font-heading`, `--font-body`, `--font-mono` (plus `--font-playfair` / `--font-jakarta` aliases). See [typography.md](./typography.md).

## Adding a token

1. Add it to `:root` in `globals.css`, with a comment saying **when** to use it — a value without a rule gets misused.
2. If a Tailwind utility should exist for it, add the mapping in `@theme inline`.
3. Add a row to the right table above.

Do not introduce a token that is a near-duplicate of an existing one. If you need a weaker `--ring`, you probably need `--green-glow`; if you need a fourth grey, you probably need one of the three that exist.
