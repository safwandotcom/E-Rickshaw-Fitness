---
name: E-Rickshaw Fitness
description: Government inspection, payment, and certification platform for e-rickshaw fitness
colors:
  primary: "#006a4e"
  primary-deep: "#00402f"
  primary-tint: "#e3f2e9"
  neutral-ink: "#16261e"
  neutral-bg: "#f5f8f6"
  neutral-surface: "#ffffff"
  neutral-border: "#8ba397"
  neutral-muted: "#4f6058"
  neutral-divider: "#e3ece7"
  warning-ink: "#7a4a00"
  warning-tint: "#fbf1de"
  danger-ink: "#9c2b22"
  danger-tint: "#fbeae8"
typography:
  headline:
    fontFamily: "system-ui, 'Segoe UI', 'Noto Sans Bengali', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "system-ui, 'Segoe UI', 'Noto Sans Bengali', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, 'Segoe UI', 'Noto Sans Bengali', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, 'Segoe UI', 'Noto Sans Bengali', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  xxl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 1rem"
  button-danger:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 1rem"
  status-badge-active:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.sm}"
    padding: "0.2rem 0.6rem"
  status-badge-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.sm}"
    padding: "0.2rem 0.6rem"
  status-badge-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
    padding: "0.2rem 0.6rem"
---

# Design System: E-Rickshaw Fitness

## 1. Overview

**Creative North Star: "The Certificate Office"**

The interface should feel like a well-run government service counter, not a startup dashboard: procedural, plainly labelled, unmistakably legitimate. A form here reads as a step toward an official outcome — a stamped certificate, a recorded inspection, a confirmed payment — not as content to browse. Bangladesh flag green (`#006a4e`) is the single institutional marker; it appears with intent (headers, primary actions, active/valid state) and nowhere else, so its authority doesn't dilute.

This system explicitly rejects the consumer-SaaS vocabulary: no gradient heroes, no glassmorphism, no card-hover lift theatrics, no marketing empty-state illustrations, no playful micro-copy. Status must be legible at a glance and in bright field sunlight — a misread "valid" vs "revoked" here is a real-world compliance outcome, not a UX inconvenience, so color-coded status badges (new in this pass) carry real semantic weight rather than decoration.

Typography is entirely platform-native (`system-ui` stack with an explicit Bengali fallback) — deliberately, not by default. This is an offline-first field tool used in Bangla and English; a webfont dependency risks failing to load exactly when the tool is needed most, on a cached shell with no connectivity. Reliability wins over typographic flourish here.

**Key Characteristics:**
- One institutional accent (flag green), used sparingly and consistently
- Flat, quiet elevation — no card-lift hover effects, no shadow theatrics
- Color-coded status badges carry real meaning: green = valid/active, amber = pending, red = failed/revoked/expired
- Platform-native typography for guaranteed Bangla+Latin rendering offline
- Generous touch targets and high contrast for outdoor, one-handed, field use

## 2. Colors

A single institutional green anchors the system; everything else is quiet neutral or reserved for status meaning.

### Primary
- **Bangladesh Green** (`#006a4e`): the one authority marker. Header rule, primary buttons, links, active nav state, the "valid/active" status badge. Used with intent, not as a general accent.
- **Bangladesh Green, Deep** (`#00402f`): pressed/hover state for primary actions; active-nav-tab background.
- **Bangladesh Green, Tint** (`#e3f2e9`): notice banners, the "valid/active" status badge background — never for large surfaces.

### Neutral
- **Ink** (`#16261e`): primary body text.
- **Page** (`#f5f8f6`): app background, sits behind all panels.
- **Surface** (`#ffffff`): panel/section/card backgrounds.
- **Border** (`#8ba397`): form control borders.
- **Muted** (`#4f6058`): secondary text, captions, helper copy. Deliberately darker than the previous `#5a6b62` default — re-verified at ≥4.5:1 against both `#ffffff` and `#f5f8f6`.
- **Divider** (`#e3ece7`): hairline rules between table rows, checklist fields.

### Status (new — the current build has status classes in markup with no color behind them)
- **Warning ink / tint** (`#7a4a00` / `#fbf1de`): pending, unpaid, awaiting sync.
- **Danger ink / tint** (`#9c2b22` / `#fbeae8`): failed, revoked, expired, invalid signature.
- Active/valid reuses **Bangladesh Green / Tint** rather than a second green — one hue, one meaning.

### Named Rules
**The One Marker Rule.** Flag green is the only branding color in the system. It never appears as decoration — only as an active/primary/valid signal. If a second saturated color is needed, it must carry a distinct status meaning (warning or danger), never a second "brand" role.

## 3. Typography

**Body & UI Font:** `system-ui, "Segoe UI", "Noto Sans Bengali", Roboto, sans-serif` — no custom webfont, anywhere.

**Character:** Plain, legible, unremarkable on purpose. The typeface should never be a topic of conversation; it should render correctly in Bangla and English, on a cheap Android phone, with no network.

### Hierarchy
- **Headline** (700, 1.75rem, 1.2 line-height): the app title only. One per screen.
- **Title** (600, 1.125rem, 1.3 line-height): section headings (`h2`/`h3`) — "Vehicle registry", "Submit fitness inspection", etc.
- **Body** (400, 1rem, 1.5 line-height): form labels, running text, table cells. Cap prose at ~70ch where it appears (help text paragraphs).
- **Label** (600, 0.875rem, 1.4 line-height, sentence case): field captions, status badges, table headers. **Sentence case, not uppercase-tracked** — GOV.UK-style plain language avoids the all-caps "eyebrow" convention; it reads as shouting, not structure.

### Named Rules
**The Native Script Rule.** No `@font-face`, no Google Fonts, no CDN font dependency. The stack must render correctly with zero network access, in both scripts, using whatever the OS ships.

## 4. Elevation

Flat by default. The current build already leans this way (one `box-shadow: 0 1px 4px rgba(0,26,11,0.12)` applied uniformly to every panel) — keep it, but stop using it as the *only* signal that separates a panel from the page. Depth is not a decoration here; it exists once, quietly, to lift a panel off the page background, and never escalates on hover.

### Shadow Vocabulary
- **Resting panel** (`box-shadow: 0 1px 4px rgba(0, 26, 11, 0.12)`): the only shadow in the system. Applied to `section`/panel containers at rest. No hover-elevation change.

### Named Rules
**The Flat Ledger Rule.** No shadow increases on hover or focus. A panel's elevation is constant; interactive state is communicated by color and outline, never by simulated lift.

## 5. Components

### Buttons
- **Shape:** `rounded.sm` (0.3rem) — small, functional, not pill-shaped.
- **Primary** (`ds-btn-primary`): flag green background, white text, `0.6rem 1rem` padding. One primary action per view/form — "Submit inspection", "Sign in", "Renew certificate".
- **Secondary** (`ds-btn-secondary`): white background, flag-green text and border. Non-destructive secondary actions — "Sync saved inspections", "Refresh summary", "Search vehicle".
- **Danger/ghost-danger** (`ds-btn-danger`): white background, danger-red text and border. Session-ending or reversing actions — "Sign out", "Stop camera". **This is new**: today every button (including "Sign out") uses the identical primary-green treatment, which gives no visual warning before an irreversible action.
- **Hover / Focus:** primary darkens to Deep Green on hover; all buttons get the shared `:focus-visible` outline (see Do's and Don'ts). No transform/lift on hover.
- **Disabled:** `opacity: 0.65`, cursor `wait` (existing behavior, keep).

### Status Badge (new signature component)
Small pill, `label` typography, colored per status meaning — not a generic "chip." This is the direct fix for Design Principle 4 ("one truth per screen"): certificate/bill/inspection status must never rely on text alone.
- **Active/valid** (`ds-badge-active`): green tint background, deep-green text.
- **Warning/pending** (`ds-badge-warning`): amber tint background, amber-ink text.
- **Danger/revoked/expired/failed** (`ds-badge-danger`): red tint background, danger-ink text.

### Cards / Panels
- **Corner Style:** `rounded.lg` (0.5rem).
- **Background:** Surface white on Page background.
- **Shadow Strategy:** the single Resting Panel shadow (§4); no border in addition to the shadow — pick one separator, not both, to avoid a double-outlined look.
- **Internal Padding:** `spacing.lg` (1rem), consistent — the current build mixes `.7rem`/`.8rem`/`1rem`/`1.25rem` ad hoc.

### Inputs / Fields
- **Style:** `neutral-border` stroke, white background, `rounded.sm`.
- **Focus:** the shared `:focus-visible` outline — no separate glow/shadow treatment, one focus language for the whole app.
- **Error:** border switches to `danger-ink`; an inline message in `danger-ink` appears below the field (used today for the "reason required if failed" checklist validation — currently a generic `setMessage` banner; should move to inline field-level error per §6).

### Navigation
- Flat green background... no — **current build is correct here**: white/transparent nav buttons, active tab gets Deep Green background + inset white ring (`aria-current="page"`, added in the accessibility pass). Keep as-is; it already matches this system.

### Table (Reconciliation)
- Hairline row dividers (`neutral-divider`), no zebra striping, no cell borders beyond the bottom rule. Header row in `label` typography, `neutral-muted` color — already correct in the current build.

## 6. Do's and Don'ts

### Do:
- **Do** keep flag green (`#006a4e`) as the only branding color; every other saturated color must carry a status meaning (warning/danger).
- **Do** use the status badge component for every valid/pending/revoked/expired/failed state instead of plain colored text.
- **Do** keep typography on the platform-native stack — no web fonts, ever, in this project.
- **Do** give destructive/session-ending actions (sign out, stop camera, revoke, void) a visually distinct treatment from primary actions.
- **Do** keep elevation flat and constant; the single resting-panel shadow is the whole vocabulary.
- **Do** use sentence case for labels and headings — never uppercase-tracked "eyebrow" text.

### Don't:
- **Don't** add a gradient hero, marketing illustration, or empty-state graphic anywhere in this product.
- **Don't** use glassmorphism, backdrop blur, or translucent panels — this is a plain, opaque, official interface.
- **Don't** add hover-lift/scale transforms to cards or buttons; elevation and scale are constant.
- **Don't** introduce a second "brand" accent color alongside flag green — additional saturated color must map to warning or danger, not decoration.
- **Don't** load a custom webfont or Google Fonts stylesheet; it breaks the offline guarantee this tool depends on.
- **Don't** use `border-left`/`border-right` colored stripes as a callout pattern (the current `.notice` class does this — replace per the audit).
