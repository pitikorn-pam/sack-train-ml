---
version: alpha
name: iPassion-sack-train-ml-design
description: A crisp, operator-grade dashboard interface for the iPassion sack-train-ml training pipeline. The system anchors on a clean white canvas with a vivid iPassion azure primary, surfaces data through dense cards and live metric charts, and uses a precision dark navy for code blocks, log streams, and selected emphasis surfaces. The brand voltage is the white + azure pairing — deliberately clear and operational where most consumer AI brands lean warm-and-editorial. Type voice runs a single humanist sans ("Inter") across display, body, and UI — the same screen-optimized face top to bottom — paired with JetBrains Mono for code and metric numerals. There is no decorative serif; this is a tool, not a magazine.

colors:
  primary: "#0080c8"
  primary-active: "#0066a2"
  primary-hover: "#1e8fd1"
  primary-soft: "#e5f2fa"
  primary-ring: "#0080c833"
  ink: "#0b1220"
  body-strong: "#1f2937"
  body: "#374151"
  muted: "#6b7280"
  muted-soft: "#9ca3af"
  hairline: "#e5e7eb"
  hairline-soft: "#f1f3f5"
  canvas: "#ffffff"
  surface-soft: "#fafbfc"
  surface-card: "#f5f7fa"
  surface-card-strong: "#eef2f6"
  surface-dark: "#0b1a2c"
  surface-dark-elevated: "#13243a"
  surface-dark-soft: "#0f1f33"
  on-primary: "#ffffff"
  on-dark: "#f8fafc"
  on-dark-soft: "#a3b1c2"
  accent-sky: "#38bdf8"
  accent-cyan: "#06b6d4"
  success: "#10b981"
  success-soft: "#d1fae5"
  warning: "#f59e0b"
  warning-soft: "#fef3c7"
  danger: "#ef4444"
  danger-soft: "#fee2e2"
  info: "#3b82f6"
  info-soft: "#dbeafe"
  status-pending: "#9ca3af"
  status-running: "#0080c8"
  status-succeeded: "#10b981"
  status-failed: "#ef4444"
  status-cancelled: "#6b7280"

typography:
  display-xl:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1.2px
  display-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.8px
  display-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  display-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.2px
  title-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  title-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption-uppercase:
    fontFamily: "Inter, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 1.2px
  metric-numeral:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.3px
  metric-numeral-sm:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.2px
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  code-inline:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  nav-link:
    fontFamily: "Inter, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  xs: 3px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  xxl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 28px
  xxl: 40px
  section: 56px

elevation:
  flat: "none"
  hairline: "0 0 0 1px {colors.hairline}"
  raise-sm: "0 1px 2px rgba(11,18,32,0.04), 0 1px 3px rgba(11,18,32,0.06)"
  raise-md: "0 4px 6px -1px rgba(11,18,32,0.06), 0 2px 4px -2px rgba(11,18,32,0.04)"
  raise-lg: "0 10px 15px -3px rgba(11,18,32,0.08), 0 4px 6px -4px rgba(11,18,32,0.06)"
  raise-xl: "0 20px 25px -5px rgba(11,18,32,0.1), 0 8px 10px -6px rgba(11,18,32,0.08)"
  focus-ring: "0 0 0 3px {colors.primary-ring}"

components:
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 56px
    elevation: "{elevation.hairline}"
  top-nav-link:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    typography: "{typography.nav-link}"
    padding: 8px 14px
    rounded: "{rounded.md}"
  top-nav-link-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-active}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    height: 36px
    elevation: "{elevation.raise-sm}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    height: 36px
    elevation: "{elevation.hairline}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-icon:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    rounded: "{rounded.md}"
    size: 32px
  text-link:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 20px
    elevation: "{elevation.hairline}"
  panel-raised:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 20px
    elevation: "{elevation.raise-md}"
  kpi-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.metric-numeral}"
    rounded: "{rounded.lg}"
    padding: 16px
    elevation: "{elevation.hairline}"
  run-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
    elevation: "{elevation.hairline}"
  version-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 14px
    elevation: "{elevation.hairline}"
  version-card-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 14px
    elevation: "{elevation.raise-sm}"
  platform-card-ready:
    backgroundColor: linear-gradient-success
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 12px
  platform-card-missing:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: 12px
  code-window-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: 16px
  log-stream-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark-soft}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: 12px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 36px
    elevation: "{elevation.hairline}"
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    elevation: "{elevation.focus-ring}"
  text-input-error:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    borderColor: "{colors.danger}"
  select:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 36px
    elevation: "{elevation.hairline}"
  textarea:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    elevation: "{elevation.hairline}"
  label:
    typography: "{typography.label}"
    textColor: "{colors.body-strong}"
  field-error-text:
    typography: "{typography.caption}"
    textColor: "{colors.danger}"
  hint-icon:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    size: 14px
  hint-tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 10px
    elevation: "{elevation.raise-lg}"
  pill-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body-strong}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-running:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-active}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  pill-muted:
    backgroundColor: "{colors.hairline-soft}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-role-admin:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-role-user:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-active}"
    typography: "{typography.code-inline}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  data-table-header:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    typography: "{typography.caption-uppercase}"
    padding: 10px 12px
  data-table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body-strong}"
    typography: "{typography.body-sm}"
    padding: 10px 12px
  data-table-row-hover:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
  metric-chart-svg:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  metric-chart-axis:
    textColor: "{colors.muted-soft}"
    typography: "{typography.caption}"
  metric-chart-grid:
    strokeColor: "{colors.hairline-soft}"
  metric-chart-line-primary:
    strokeColor: "{colors.primary}"
  metric-chart-line-success:
    strokeColor: "{colors.success}"
  metric-chart-line-warning:
    strokeColor: "{colors.warning}"
  metric-chart-line-danger:
    strokeColor: "{colors.danger}"
  metric-chart-line-accent-sky:
    strokeColor: "{colors.accent-sky}"
  metric-chart-line-accent-cyan:
    strokeColor: "{colors.accent-cyan}"
  metric-chart-line-purple:
    strokeColor: "#8b5cf6"
  metric-chart-line-pink:
    strokeColor: "#ec4899"
  metric-chart-line-orange:
    strokeColor: "#f97316"
  progress-track:
    backgroundColor: "{colors.hairline-soft}"
    rounded: "{rounded.pill}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: 6px
  modal-backdrop:
    backgroundColor: "rgba(11,18,32,0.55)"
  modal:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
    elevation: "{elevation.raise-xl}"
    maxWidth: 440px
  toast:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    elevation: "{elevation.raise-lg}"
  toast-success:
    backgroundColor: "{colors.canvas}"
    leftBorder: "3px solid {colors.success}"
  toast-danger:
    backgroundColor: "{colors.canvas}"
    leftBorder: "3px solid {colors.danger}"
  toast-info:
    backgroundColor: "{colors.canvas}"
    leftBorder: "3px solid {colors.info}"
  notification-bell:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.body}"
    rounded: "{rounded.pill}"
    size: 32px
  notification-badge:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    minSize: 16px
  notification-popover:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    elevation: "{elevation.raise-xl}"
    width: 360px
    maxHeight: 480px
  empty-state:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: 32px
  callout-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    leftBorder: "3px solid {colors.info}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  callout-coral-equivalent-removed: "this template does not use coral — coral is reserved for the Anthropic brand"
---

## Overview

The iPassion sack-train-ml dashboard is the **operator-grade control surface** for the BSCP model training pipeline. Where Anthropic Claude's marketing site is warm-editorial (cream + coral, slab-serif display, magazine pacing), sack-train-ml is **clear-operational** (white + iPassion azure, humanist sans throughout, dashboard-density layouts). Both share the discipline of a single unbreakable type pairing and a small palette — but the discipline points in different directions.

The base atmosphere is **pure white canvas** (`{colors.canvas}` — #ffffff) with **iPassion azure** (`{colors.primary}` — #0080c8) as the single brand voltage. The white is deliberate; this is a tool used 8 hours a day, the kind of surface that disappears so the data can speak. The azure is taken directly from the iPassion brand mark — saturated, confident, never washed out into pastel.

Brand voltage comes from the **white + azure pairing**. Azure appears on:
- The primary CTA button (`{component.button-primary}`)
- The active top-nav link background tint (`{component.top-nav-link-active}`)
- The selected version-card border (`{component.version-card-selected}`)
- The "running" status pill (`{component.pill-running}`)
- The primary metric chart line (`{component.metric-chart-line-primary}`)
- The progress-bar fill (`{component.progress-fill}`)
- Inline `text-link` accents

The system has three surface modes:
1. **Canvas** (`{colors.canvas}` — pure white) — default body floor, panel backgrounds, button-primary contrast
2. **Surface-soft / surface-card** (`{colors.surface-soft}` — #fafbfc, `{colors.surface-card}` — #f5f7fa) — table headers, empty states, page background tint when stacked
3. **Surface-dark** (`{colors.surface-dark}` — #0b1a2c) — code blocks, log streams, terminal output, and (rarely) one full-section dark band per page for visual rhythm

The cream-to-dark pacing of Anthropic's marketing site does NOT apply here — this is a tool, not a brochure. Dark surfaces are reserved for code/log/data-dense panels where monospace text needs contrast. Most of the dashboard stays on white.

**Key characteristics:**
- Pure white canvas (`{colors.canvas}` — #ffffff) with deep-navy ink (`{colors.ink}` — #0b1220). High contrast for sustained-attention work.
- iPassion azure primary CTA (`{colors.primary}` — #0080c8). Used on every primary action; never on decorative surfaces.
- Single humanist sans (`Inter`) for display, body, and UI labels. No serif anywhere — the editorial voice is wrong for a dashboard.
- JetBrains Mono for code, run IDs, metric numerals, log lines. Monospace IS the data voice — readable, columnar, copyable.
- Border radius is hierarchical and small: `{rounded.md}` (6px) for buttons + inputs + pills, `{rounded.lg}` (8px) for cards + panels + modals, `{rounded.xl}` (12px) reserved for the modal frame. Tight radii signal "tool" — large radii signal "consumer app".
- Elevation comes mostly from `{elevation.hairline}` 1px borders. Drop shadows appear only on truly elevated surfaces (modal, toast, notification popover). Cards use hairlines, not shadows.
- Section padding `{spacing.section}` (56px max) — far tighter than the 96px of marketing surfaces. Dashboard density wins over editorial breathing room.
- Internal panel padding `{spacing.lg}` (20px) — enough breathing room without wasting vertical real estate.
- Status-pill system: `{component.pill-running}` (azure), `{component.pill-success}` (green), `{component.pill-warning}` (amber), `{component.pill-danger}` (red), `{component.pill-muted}` (gray). One pill per status, consistent across all sections.

## Colors

### Brand & Accent
- **Primary / iPassion Azure** (`{colors.primary}` — #0080c8): The defining brand color. Taken directly from the iPassion logo blue. Used on the primary CTA, active nav state, primary chart line, progress fill, "running" status pill. Confident and saturated — never dilute it into a pastel.
- **Primary Active** (`{colors.primary-active}` — #0066a2): Press / focused state — darker, more authoritative.
- **Primary Hover** (`{colors.primary-hover}` — #1e8fd1): Slight lighten on hover; subtle.
- **Primary Soft** (`{colors.primary-soft}` — #e5f2fa): A washed tint used for selected-row backgrounds, active nav pill, "running" pill background. The azure as backdrop.
- **Primary Ring** (`{colors.primary-ring}` — #0080c833): The focus ring color (azure at ~20% alpha). Used for keyboard-focused inputs and selected version cards.
- **Accent Sky** (`{colors.accent-sky}` — #38bdf8): Secondary chart line; lighter cyan-leaning blue.
- **Accent Cyan** (`{colors.accent-cyan}` — #06b6d4): Tertiary chart line; cooler.

### Surface
- **Canvas** (`{colors.canvas}` — #ffffff): Pure white. The default surface for every panel, card, button-primary contrast, and table body.
- **Surface Soft** (`{colors.surface-soft}` — #fafbfc): A near-imperceptible off-white. Used for table header rows, empty states, secondary section background.
- **Surface Card** (`{colors.surface-card}` — #f5f7fa): One step darker — the page-background tint when panels stack on top, the bell icon background, the inactive pill background.
- **Surface Card Strong** (`{colors.surface-card-strong}` — #eef2f6): Reserved for sub-nav active states, selected-but-not-primary items.
- **Surface Dark** (`{colors.surface-dark}` — #0b1a2c): The deep navy used for code blocks, log streams, and the (rare) full-section dark band. The pre-loaded "data surface".
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #13243a): Slightly lifted dark — used for elevated card chrome inside a dark band.
- **Surface Dark Soft** (`{colors.surface-dark-soft}` — #0f1f33): Inner code-block background nested inside a dark card.
- **Hairline** (`{colors.hairline}` — #e5e7eb): The 1px border color on white surfaces. The system's elevation workhorse.
- **Hairline Soft** (`{colors.hairline-soft}` — #f1f3f5): Barely-visible dividers between rows / between sub-sections inside the same panel.

### Text
- **Ink** (`{colors.ink}` — #0b1220): All titles and primary text. Deep navy, slightly cool — pairs with the azure primary cleanly.
- **Body Strong** (`{colors.body-strong}` — #1f2937): Emphasized paragraphs, table cell content.
- **Body** (`{colors.body}` — #374151): Default running text.
- **Muted** (`{colors.muted}` — #6b7280): Captions, table headers, hint helper text.
- **Muted Soft** (`{colors.muted-soft}` — #9ca3af): Placeholders, disabled labels, chart axis labels.
- **On Primary** (`{colors.on-primary}` — #ffffff): Pure white text on azure buttons. No tint.
- **On Dark** (`{colors.on-dark}` — #f8fafc): Cool-tinted white used on dark surfaces. Echoes a fresh-off-press feel.
- **On Dark Soft** (`{colors.on-dark-soft}` — #a3b1c2): Secondary labels in code blocks and log streams.

### Semantic
- **Success** (`{colors.success}` — #10b981) / **Success Soft** (`{colors.success-soft}` — #d1fae5): "succeeded" runs, gate passed, artifact ready, deployment active. Green.
- **Warning** (`{colors.warning}` — #f59e0b) / **Warning Soft** (`{colors.warning-soft}` — #fef3c7): Storage near quota, admin role badge, near-cap progress.
- **Danger** (`{colors.danger}` — #ef4444) / **Danger Soft** (`{colors.danger-soft}` — #fee2e2): "failed" runs, gate failed, destructive action buttons, field validation errors.
- **Info** (`{colors.info}` — #3b82f6) / **Info Soft** (`{colors.info-soft}` — #dbeafe): Informational callouts, "info" notification tone, non-destructive deployment pills.

### Status (canonical pill colors)
A run / version / deployment is always exactly one of these five states; the pill color is unambiguous.
- **Pending** (`{colors.status-pending}` — #9ca3af, gray): Created but no work started.
- **Running** (`{colors.status-running}` — #0080c8, **azure**): Live work in flight.
- **Succeeded** (`{colors.status-succeeded}` — #10b981, green).
- **Failed** (`{colors.status-failed}` — #ef4444, red).
- **Cancelled** (`{colors.status-cancelled}` — #6b7280, slate-gray).

## Typography

### Font Family
The system uses **Inter** as the single sans face across display, title, body, and UI. **JetBrains Mono** handles code blocks, run IDs, metric numerals, and log lines. There is **no serif** in this system — adding one would push the dashboard toward editorial, which is the wrong voice.

- Inter (weight 400 → 700) → all display, title, body, button, label, nav-link, caption
- JetBrains Mono → all code, metric numerals, run IDs, log streams, artifact keys

Fallback stack walks `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` for Inter and `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for JetBrains Mono.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 700 | 1.1 | -1.2px | Page title in section hero (rare) |
| `{typography.display-lg}` | 36px | 700 | 1.15 | -0.8px | Section page titles ("Overview", "Train") |
| `{typography.display-md}` | 28px | 600 | 1.2 | -0.5px | Major panel headlines, modal titles |
| `{typography.display-sm}` | 22px | 600 | 1.25 | -0.2px | Sub-section headers, run detail title |
| `{typography.title-lg}` | 18px | 600 | 1.35 | 0 | Panel `<h2>`, primary card title |
| `{typography.title-md}` | 16px | 600 | 1.4 | 0 | Card title, table caption |
| `{typography.title-sm}` | 14px | 600 | 1.4 | 0 | Sub-card title, sidebar group label |
| `{typography.body-md}` | 14px | 400 | 1.55 | 0 | Default body running text, form input value |
| `{typography.body-sm}` | 13px | 400 | 1.5 | 0 | Table cell text, modal description |
| `{typography.label}` | 13px | 500 | 1.4 | 0 | Form field labels |
| `{typography.caption}` | 12px | 500 | 1.4 | 0 | Pill text, table header text, KPI label |
| `{typography.caption-uppercase}` | 11px | 600 | 1.4 | 1.2px | Role badge, "NEW" badge |
| `{typography.metric-numeral}` | 28px | 600 | 1.0 | -0.3px | KPI value, primary metric display (JetBrains Mono) |
| `{typography.metric-numeral-sm}` | 16px | 600 | 1.0 | -0.2px | Inline metric values inside cards (JetBrains Mono) |
| `{typography.code}` | 13px | 400 | 1.55 | 0 | Code blocks, log lines (JetBrains Mono) |
| `{typography.code-inline}` | 12px | 500 | 1.4 | 0 | Inline `<code>` (run ID, R2 key, env var name) |
| `{typography.button}` | 14px | 500 | 1.0 | 0 | Button label |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | Top-nav, sub-nav |

### Principles
- **Display sizes use weight 700**, not the 400 of Anthropic. Bold is acceptable here because there's no decorative serif giving voice — weight provides the hierarchy. Bold + tight tracking = "this is the title".
- **Body type stays at weight 400** for paragraphs and inputs, weight **500 for labels** and emphasized phrases.
- **Numerals always use monospace**. Every KPI value, every metric value in a chart pill, every progress percentage, every run ID, every R2 key. Monospace numerals are aligned, scan-friendly, and signal "data, not prose".
- **Letter spacing is negative for display sizes** (-0.2px → -1.2px) and **zero for body and UI**. Don't use positive tracking except for `caption-uppercase`.
- **Line height is tight for display** (1.1 → 1.25) and **comfortable for body** (1.5 → 1.55). Code blocks at 1.55.

### Note on Font Substitutes
Inter is open-source via Google Fonts; deploy it as the sole web font. JetBrains Mono is also Google-fonts-hosted. No proprietary licenses required.

If both fonts fail to load, fallback to system stack (`-apple-system` for sans, `ui-monospace` for mono). Don't bring in another web font as a "nicer" fallback — system stack is fast and acceptable.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 28px · `{spacing.xxl}` 40px · `{spacing.section}` 56px.
- **Section gap:** `{spacing.section}` (56px) between top-level dashboard sections — far tighter than marketing's 96px.
- **Panel internal padding:** `{spacing.lg}` (20px) standard, `{spacing.xl}` (28px) for hero-tier panels (modal, run-detail header).
- **Gap inside grids:** `{spacing.md}` (16px) for KPI rows and version-card grids. `{spacing.sm}` (12px) for tighter chip / pill rows.

### Grid & Container
- **Max content width:** ~1280px centered. Wider than marketing because dashboards live on operator monitors (1920+) and want the horizontal real estate.
- **Top nav:** 56px tall, fluid 0-padding edge-to-edge with internal content at max-width.
- **Section main:** 24px outer padding, flex column with 16px gap between panels.
- **Overview KPI row:** `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))` — KPIs flow.
- **Overview body:** 2-column grid (2fr 1fr) with the Operator Journey panel on the left and Live Runs on the right; collapses to 1-column under 900px.
- **Models layout:** 2-column grid (1fr 1.5fr) — version-card list left, version detail panel right; collapses to 1-column under 900px.
- **Table layout:** full-width inside its panel, `border-collapse: collapse`, hairline row separators.

### Whitespace Philosophy
Dashboards live or die by **scannable density**. Marketing pages can afford 96px section padding because they're read linearly; dashboards are scanned — eye flicks across 12 KPIs in a glance. Keep section padding tight, internal padding generous-but-not-bloated, line-heights crisp.

Specifically:
- Section vertical gap: **56px max** (vs marketing's 96px)
- Panel internal padding: **20px** (vs marketing's 32px)
- Table row padding: **10–12px vertical, 12px horizontal** (tight scan)
- Card-to-card gap: **16px** (vs marketing's 24px)

The cream-canvas literary pacing of the Anthropic site reads as "premium". The white-canvas dashboard pacing of this system reads as "professional tool". Both are valid; they aren't interchangeable.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No border, no shadow | Top-nav background; in-page section backgrounds |
| Hairline | 1px `{colors.hairline}` border | Panels, cards, inputs, buttons-secondary — the default elevation |
| Raise-sm | `{elevation.raise-sm}` faint shadow | Primary buttons (resting state), KPI cards on hover |
| Raise-md | `{elevation.raise-md}` soft shadow | Sticky elements, dropdown popovers |
| Raise-lg | `{elevation.raise-lg}` mid shadow | Toasts, hint tooltips |
| Raise-xl | `{elevation.raise-xl}` strong shadow | Modal, notification popover |
| Focus-ring | `{elevation.focus-ring}` 3px azure-alpha ring | Keyboard-focused inputs, selected cards |

The philosophy: **hairlines as elevation, shadows for emergent surfaces**. A panel doesn't need a shadow; it has a 1px border. A modal absolutely needs a shadow; it's lifted off the page. The same logic applies to toasts and tooltips — they're momentary, so they shadow.

### Decorative Depth
- The **selected version-card** uses azure border + faint azure-tinted background (`{component.version-card-selected}`) — the selection is the depth, no shadow needed.
- **Status pills** are flat color blocks; no border, no shadow. Color IS the elevation.
- **Charts** sit on a tinted-white background (`{colors.surface-soft}`) inside a panel — a sub-elevation hint.
- **Code blocks and log streams** sit on `{colors.surface-dark}` — the navy IS the depth marker (much like Anthropic's dark mockup cards, but here the dark is utilitarian, not editorial).

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 3px | Reserved for very small inline decorations |
| `{rounded.sm}` | 4px | Chips, role badges, kind-pills (artifact format tags) |
| `{rounded.md}` | 6px | Buttons, inputs, select, top-nav-link, callouts, status pills' outer wrapper |
| `{rounded.lg}` | 8px | Panels, cards, version-cards, code-window-card, log-stream-card |
| `{rounded.xl}` | 12px | Modal, notification popover, KPI hero containers |
| `{rounded.pill}` | 9999px | Status pills, role badges, bell icon, progress track/fill |
| `{rounded.full}` | 9999px | Avatar circles (if used) |

### Why tighter radii than marketing
A pricing card at 12–16px radius reads as "rounded card, friendly product". A KPI card at 12–16px radius reads as "rounded card, kid's app". The dashboard wants **8px panels and 6px buttons** — small enough to feel surgical, large enough to feel modern. The 12px is reserved for the modal because the modal IS a momentary statement.

### Iconography
- Use Lucide icons (or react-feather as fallback). 16–20px stroke icons inline with text, 14px icons inside dense pills.
- Icons inherit `currentColor` — never hard-code icon color.
- Use 🔔 emoji fallback for notification bell ONLY if a real Lucide `Bell` is not yet integrated. Plan to swap to Lucide.

## Components

### Top Navigation

**`top-nav`** — White nav bar pinned to the top. 56px tall, `{colors.canvas}` background, `{elevation.hairline}` bottom-only border. Carries the iPassion + sack-train-ml wordmark at left (azure spike-mark + ink text), primary horizontal menu (Overview / Train / Models / Storage) center, right-side cluster with notification bell + account card + sign-out.

**`top-nav-link`** — Inactive: transparent, `{colors.muted}` text, `{typography.nav-link}`. Hover: `{colors.surface-soft}` background.

**`top-nav-link-active`** — Background `{colors.primary-soft}` (#e5f2fa), text `{colors.primary-active}`. Rounded `{rounded.md}`. The active section is azure-tinted — clear, never ambiguous.

### Buttons

**`button-primary`** — The iPassion azure CTA. Background `{colors.primary}` (#0080c8), text `{colors.on-primary}` (white), type `{typography.button}` (Inter 14px / 500), padding 8px × 16px, height 36px, rounded `{rounded.md}` (6px). Default carries `{elevation.raise-sm}`. Active: `{colors.primary-active}`. Hover: `{colors.primary-hover}`.

**`button-secondary`** — Outline button. Background `{colors.canvas}` (white), text `{colors.ink}`, 1px hairline border, same padding + height + radius as primary. No shadow on rest.

**`button-ghost`** — Transparent, text-only. Used for tertiary actions and "← Back" links. Hover: `{colors.surface-soft}` background.

**`button-danger`** — Soft-red button for destructive actions. Background `{colors.danger-soft}` (light pink), text `{colors.danger}` (red). Used in destructive confirms (Delete version, Undeploy).

**`button-icon`** — 32×32px square icon button. Background `{colors.surface-card}`, text `{colors.body}`, rounded `{rounded.md}`. Hover lifts to `{colors.surface-card-strong}`.

**`text-link`** — Inline body links in `{colors.primary}` azure. Hover underline. The azure inline link reads as a clear affordance against ink-color body text.

### Panels & Cards

**`panel`** — The default content container. Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.lg}` (20px), `{elevation.hairline}` border. Carries an optional `<h2>` in `{typography.title-lg}` followed by content.

**`panel-raised`** — A panel that should feel slightly lifted (run-detail hero, signed-in welcome). Same as panel but with `{elevation.raise-md}` shadow instead of hairline.

**`kpi-card`** — Compact card with a large metric numeral on top and a caption below. Background `{colors.canvas}`, rounded `{rounded.lg}`, padding 16px. The numeral uses `{typography.metric-numeral}` (28px JetBrains Mono); the label uses `{typography.caption}` (12px Inter 500). Tonal variants tint the numeral color:
- `kpi-card-info` → numeral `{colors.info}`
- `kpi-card-success` → numeral `{colors.success}`
- `kpi-card-danger` → numeral `{colors.danger}`
- Default → numeral `{colors.ink}`

**`run-card`** — A mini-card in run lists. Background `{colors.canvas}`, hairline border, rounded `{rounded.lg}`, padding 16px. Carries run ID as inline `code`, status pill, created-at timestamp, optional progress bar.

**`version-card`** — Used in the Models grid. Background `{colors.canvas}`, hairline border, rounded `{rounded.lg}`, padding 14px. Carries the semver as the headline (Inter 600 14px), deployment tags (pill row), key metric (mAP50 in mono-numeral), artifact count, created-at. Click to select.

**`version-card-selected`** — Selected state. Background `{colors.primary-soft}` (washed azure), border becomes 1px `{colors.primary}` (full azure), with `{elevation.raise-sm}` lift. Selection is unambiguous because the background tint reads instantly.

**`platform-card-ready`** — Artifact-format card in the version detail panel. Used to show each artifact kind (pytorch / onnx / hef / hef_meta). Ready state uses a subtle green-tinted linear gradient background, hairline border in `{colors.success}` at 30% alpha, rounded `{rounded.lg}`. Carries the kind name in `{typography.code-inline}`, a "ready" pill, the R2 key in code, file size in mono.

**`platform-card-missing`** — The missing state for an artifact slot. Background `{colors.surface-soft}`, faded text `{colors.muted}`, hairline border, slightly translucent (opacity 0.6). Visually de-emphasized but still present so the operator knows the slot exists.

**`code-window-card`** — Dark navy card showing code or terminal output. Background `{colors.surface-dark}` (#0b1a2c), text `{colors.on-dark}`, type `{typography.code}` (JetBrains Mono 13px), rounded `{rounded.lg}`, padding 16px. Used for "Run config JSON" recap, sample API requests, ENV documentation.

**`log-stream-card`** — Like code-window-card but specifically for streaming log output. Same dark navy background but with `{typography.code}` at slightly muted color (`{colors.on-dark-soft}`) and a max-height with overflow-y scroll. Each line in monospace with timestamp prefix.

### Forms

**`text-input`** — Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-md}` (Inter 14px), rounded `{rounded.md}` (6px), padding 8px × 12px, height 36px, hairline border in `{colors.hairline}`.

**`text-input-focused`** — Keyboard focus state. Border becomes 1px `{colors.primary}`, plus a `{elevation.focus-ring}` 3px azure-alpha ring outside the border.

**`text-input-error`** — Error state. Border becomes 1px `{colors.danger}`. The error message renders below the input as `{component.field-error-text}` — `{typography.caption}` (12px / 500) in `{colors.danger}`.

**`select`** — Native `<select>` styled identically to `text-input`. The browser dropdown chevron is left alone — don't fake it; rely on platform appearance.

**`textarea`** — Multi-line input. Same colors and border as `text-input` but padding 10px × 12px and no fixed height.

**`label`** — Form field label. `{typography.label}` (Inter 13px / 500) in `{colors.body-strong}`. Always sits above the input with a 4px gap.

**`field-error-text`** — Inline error message under a field. `{typography.caption}` (12px / 500) in `{colors.danger}`. Appears on submit-time validation failure; clears when the user starts editing the field.

**`hint-icon`** — The small "i" icon next to a form label that reveals an explanation on hover or focus. 14×14px circle, `{colors.hairline}` background, `{colors.muted}` text. Hover/focus shifts background to `{colors.primary}`, text to white.

**`hint-tooltip`** — The popover content of a hint. Background `{colors.ink}` (deep navy — inverted from the surrounding canvas), text `{colors.on-dark}`, `{typography.body-sm}`, rounded `{rounded.md}`, padding 8px × 10px, `{elevation.raise-lg}` shadow. Width caps at 260px. Appears above the label with an 8px gap; positions auto-flip if near the viewport edge.

### Tags / Badges / Pills

**`pill-default`** — Generic neutral pill. Background `{colors.surface-card}`, text `{colors.body-strong}`, `{typography.caption}`, rounded `{rounded.pill}`, padding 2px × 10px.

**`pill-info`** / **`pill-success`** / **`pill-warning`** / **`pill-danger`** — Semantic pills. Each uses its `*-soft` background + its full color for text. Used for status, gate verdicts, deployment status.

**`pill-running`** — The "running" run status. Background `{colors.primary-soft}`, text `{colors.primary-active}`. Azure pill is reserved for "live work" — it's the most visually distinctive status because it's the one operators check most often.

**`pill-muted`** — "Pending" or "cancelled" status. Background `{colors.hairline-soft}`, text `{colors.muted}`. Faded by design.

**`badge-role-admin`** — Topbar role badge for admin users. Background `{colors.warning-soft}`, text `{colors.warning}`, `{typography.caption-uppercase}` (11px / 600 / +1.2px tracking), rounded `{rounded.sm}` (sharper than pills, emphasizing official-status). Padding 2px × 8px.

**`badge-role-user`** — Topbar role badge for non-admin authenticated users. Background `{colors.info-soft}`, text `{colors.info}`. Same shape as admin badge.

**`chip`** — Small inline chip used to display individual class names, env var names, or R2 key fragments. Background `{colors.primary-soft}`, text `{colors.primary-active}`, `{typography.code-inline}` (JetBrains Mono 12px / 500), rounded `{rounded.sm}`, padding 2px × 8px. Chips appear in rows separated by 4px gaps.

### Tables

**`data-table-header`** — Table header row. Background `{colors.surface-soft}`, text `{colors.muted}`, `{typography.caption-uppercase}` (11px / 600 / +1.2px tracking). Padding 10px × 12px. Top + bottom hairline.

**`data-table-row`** — Body row. Background `{colors.canvas}`, text `{colors.body-strong}`, `{typography.body-sm}`. Padding 10px × 12px. Bottom hairline (last row no border).

**`data-table-row-hover`** — On hover, background shifts to `{colors.surface-soft}`. Cursor becomes `pointer` only if the row is clickable.

Tables NEVER use vertical separators between columns. Horizontal hairlines only. Column alignment is text-left by default; numeric columns text-right with monospace.

### Charts

**`metric-chart-svg`** — The SVG canvas for the metric trend chart. Background `{colors.surface-soft}` (slight tint to differentiate from white panel), rounded `{rounded.lg}`. The SVG covers the full panel width with a fixed viewBox; the parent panel handles padding.

**`metric-chart-axis`** — Tick labels and axis ticks. Text color `{colors.muted-soft}`, `{typography.caption}` size at 10px (smaller than the body caption since this is chart chrome). Tick lines in `{colors.hairline}`.

**`metric-chart-grid`** — Background grid lines. Stroke `{colors.hairline-soft}` (barely-visible). 5 horizontal lines at 0/0.25/0.5/0.75/1 of the y-range; 3 vertical lines at 0/0.5/1 of the x-range.

**`metric-chart-line-*`** — Color palette for individual metric lines:
- `metric-chart-line-primary` → `{colors.primary}` (azure) — used for **mAP50** (the headline metric)
- `metric-chart-line-success` → `{colors.success}` (green) — used for **precision** or **recall** (the "do we know what we're looking at" metrics)
- `metric-chart-line-warning` → `{colors.warning}` (amber) — used for warning-tone metrics (loss spikes)
- `metric-chart-line-danger` → `{colors.danger}` (red) — used for **train_loss** / **val_loss**
- `metric-chart-line-accent-sky` → `{colors.accent-sky}` — secondary positive
- `metric-chart-line-accent-cyan` → `{colors.accent-cyan}` — tertiary
- `metric-chart-line-purple` → #8b5cf6 — mAP50-95
- `metric-chart-line-pink` → #ec4899 — F1
- `metric-chart-line-orange` → #f97316 — cls_loss

Stroke width is **1.6px**; show points (toggle) renders 2px filled circles in the same color. The hover crosshair is a dashed line in `{colors.muted-soft}`.

The metric-pill toolbar above the chart uses the same color tokens: each pill displays a small color dot (8px circle) matching its line color, the metric name, and the latest value in monospace.

### Progress

**`progress-track`** — Background container. `{colors.hairline-soft}`, height 6px, rounded `{rounded.pill}`.

**`progress-fill`** — The filled bar. Background a linear-gradient from `{colors.primary}` to `{colors.primary-hover}` for a slight depth feel, height 6px, rounded `{rounded.pill}`. Width controlled by parent.

### Modals

**`modal-backdrop`** — `rgba(11,18,32,0.55)` (deep-navy at 55% alpha) over the entire viewport. Click backdrop = cancel; Escape key also cancels.

**`modal`** — Centered card. Background `{colors.canvas}`, rounded `{rounded.xl}` (12px — slightly more than panels for emphasis), padding `{spacing.xl}` (28px), `{elevation.raise-xl}` shadow, max-width 440px (mobile-responsive via `min(440px, 90vw)`).

**`modal-title`** — `{typography.display-md}` (28px / 600). 8px gap below to message.

**`modal-message`** — `{typography.body-md}` in `{colors.body-strong}`. Line-height 1.55. 20px gap below to actions.

**`modal-actions`** — Right-aligned row, 8px gap between buttons. Cancel button is `{component.button-secondary}`; confirm is `{component.button-primary}` or `{component.button-danger}` based on action.

### Toast Notifications

**`toast`** — Fixed bottom-right floating card. Background `{colors.canvas}`, rounded `{rounded.lg}`, padding 12px × 16px, `{elevation.raise-lg}` shadow. Max width 380px.

**`toast-success`** / **`toast-danger`** / **`toast-info`** — A 3px left border in the semantic color. Don't tint the background — keep it white so the toast doesn't clash with the dashboard surface.

Title in `{typography.title-sm}` (14px / 600). Detail in `{typography.body-sm}` in `{colors.muted}`. Auto-dismiss at 5.2s. Stack up to 3; older toasts evict.

### Notification Center

**`notification-bell`** — Topbar icon button. 32×32 circle, `{colors.surface-card}` background, `{colors.body}` icon color. Hover lifts to `{colors.surface-card-strong}`.

**`notification-badge`** — Unread counter. `{colors.danger}` background, `{colors.on-primary}` text, `{typography.caption}` (12px / 500). Positioned top-right of bell, min 16×16, rounded `{rounded.pill}`. Shows "99+" if > 99.

**`notification-popover`** — The dropdown on bell click. Background `{colors.canvas}`, rounded `{rounded.xl}`, `{elevation.raise-xl}`, width 360px, max-height 480px, scrollable. Header has "Activity" title + "Mark all read" link. Body is a list of `notification-item` rows.

Notification items use semantic-tone left accents:
- `notif-success` → green dot + title in `{colors.success}`
- `notif-danger` → red dot + title in `{colors.danger}`
- `notif-info` → azure dot + title in `{colors.info}`
- `notif-muted` → gray dot + title in `{colors.muted}`

Unread items have a faint `{colors.primary-soft}` background tint.

### Empty States

**`empty-state`** — Used inside any panel that's empty (no runs, no versions, no metrics yet). Background `{colors.surface-soft}` (light tint), padding 32px, rounded `{rounded.lg}`, text `{colors.muted}` centered. Two short lines:
1. Status statement ("No live runs.") in `{typography.title-md}` `{colors.ink}`
2. Action hint ("Switch to Train → New to create one.") in `{typography.body-sm}` `{colors.muted}`

Never use generic "No data." — always give the operator the next action.

### Callouts

**`callout-info`** — Inline info banner. Background `{colors.info-soft}` (light blue), text `{colors.info}` (saturated blue), 3px left border in `{colors.info}`, rounded `{rounded.md}`, padding 10px × 14px. Used for "Waiting for Colab to start streaming…" messages and similar contextual hints.

Variants exist for warning (`{colors.warning-soft}` background, `{colors.warning}` accent) and danger (`{colors.danger-soft}` background, `{colors.danger}` accent).

## Do's and Don'ts

### Do
- Anchor every section on the **white canvas**. White IS the operator's tool surface. Tinted backgrounds are reserved for table headers, empty states, and chart backgrounds.
- Reserve `{colors.primary}` (azure) for: primary CTA buttons, active nav tabs, "running" pill, primary chart line, progress fill, focus rings, selected version-cards. Don't paint random panels azure.
- Use `{typography.metric-numeral}` (JetBrains Mono) for **every numeric KPI**. Don't render a count like "3 versions" in Inter — render the "3" in mono. Numerals align; prose doesn't.
- Use **status pills** consistently — one pill per status, same color across all sections. Don't invent "pending-azure" or "running-yellow" variants.
- Pair `{component.button-danger}` with a `{component.modal}` confirmation for destructive ops (delete version, undeploy). Never let a destructive button fire one-click.
- Use **hairlines as the default elevation**. Shadows belong on toasts, tooltips, modals, and notification popovers only.
- Apply `{spacing.section}` (56px) MAX between sections. Tighter dashboard density wins.
- Pair `{component.code-window-card}` and `{component.log-stream-card}` with the surrounding white surface — the dark navy IS the contrast.

### Don't
- Don't use cream, beige, or warm-tinted canvas. This system is white-cool, not Anthropic-warm.
- Don't introduce a serif. There's no Copernicus equivalent here — Inter top to bottom.
- Don't use coral. Coral is reserved for the Anthropic brand. Our azure is the brand voltage.
- Don't add background tints to status pills' icons or to chart line colors. The semantic-color system stays canonical.
- Don't use shadows on panels or cards. Use hairlines.
- Don't use radius > 12px on dashboard surfaces (modals exempt at 12px). Big rounded corners read as "consumer", we want "tool".
- Don't render numbers in Inter — always mono.
- Don't put the active nav on top of a saturated azure background; use `{colors.primary-soft}` (washed tint) so the wordmark and section title read first.
- Don't repeat the same surface mode in two adjacent rows when alternation aids scan. Tables with `surface-soft` header → `canvas` body is a single transition, not a rhythm.
- Don't make a panel header in the same size as a section header. Hierarchy: `display-lg` for sections, `title-lg` for panels.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Top-nav collapses to hamburger; KPI row → 2-up grid; sub-tabs scroll horizontally; data tables become single-column card stacks |
| Tablet | 640–900px | Top-nav stays horizontal; KPI row → 3-4-up; Models layout collapses to 1-column (cards above detail); panels span full width |
| Desktop | 900–1280px | Full 4-section top-nav; KPI row 6-7-up; Models layout 1fr / 1.5fr; Overview 2fr / 1fr |
| Wide | > 1280px | Max content width caps at 1280px; outer breathing room expands |

### Touch Targets
- `{component.button-primary}` height 36px; pair with 36px height ensures 36px minimum touch — borderline for WCAG AAA (44px) but acceptable for an operator-grade interface on touch tablets.
- `{component.text-input}` height 36px.
- `{component.notification-bell}` 32×32px — under the WCAG minimum but framed by a 6px padding margin around hot-zone for a effective 44×44px tap.

### Collapsing Strategy
- Top-nav collapses to a hamburger menu at < 640px; the menu opens as a full-width sheet.
- KPI row uses `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))` — flows naturally with no breakpoint logic.
- Models 2-column layout becomes 1-column under 900px; the version detail panel renders BELOW the card list, not as a side panel.
- Data tables: under 640px, swap `<table>` rendering to a list of cards (each row becomes a card with key-value pairs). Use `display: contents` on rows + media queries to flip.
- The metric chart maintains its viewBox; the SVG scales to container width but stays at fixed visual proportions via `preserveAspectRatio`.

### Image / Icon Behavior
- Icons inherit `currentColor`. They scale via font-size, not explicit dimensions where possible.
- The iPassion wordmark in the topbar uses a fixed pixel-size SVG (24px height); doesn't scale below 20px.

## Iteration Guide

1. **Focus on ONE component at a time.** Reference its YAML key (`{component.kpi-card}`, `{component.version-card-selected}`).
2. **Variants of an existing component** (`-active`, `-focused`, `-error`, `-selected`, `-ready`, `-missing`) live as separate entries in `components:`. Never inline a variant; promote it.
3. **Use `{token.refs}` everywhere** — never inline hex. If a new color is needed, add it to `colors:` first.
4. **Never document hover.** Default, Active/Pressed, Focused, and Disabled states only. Hover is implementation noise.
5. **Single sans (Inter) for everything except code.** No mixing Roboto, no Source Sans, no second sans for headlines. The single-family discipline IS the design.
6. **White + azure + navy is the trinity.** Don't introduce a fourth surface tone (no purple panels, no green-tinted sections). Status colors stay status colors, not section themes.
7. **When in doubt about emphasis: tighter spacing before bigger type.** A 16px heading on a tight 8px-gap row reads more "professional" than a 22px heading on a 24px-gap row.

## Known Gaps

- **Lucide icon mapping is not yet enumerated.** Components currently reference 🔔 emoji for the notification bell. Future iteration: replace with `lucide-react` `Bell` icon at 18px.
- **Animation / transition timings** (toast slide-in, modal fade-in, metric chart hover, notification popover spring) are not formalized as tokens. Current implementation uses ad-hoc 150–250ms ease-out — fine for now, formalize when adding more motion.
- **Dark mode** is not in scope. The system runs light-mode only. The dark surfaces (`surface-dark`) are utility surfaces for code/log, not a full dark theme. A real dark mode would need a separate token map.
- **iPassion wordmark SVG** is referenced as `docs/logo/65c9f68027a94379fb020c18_iPassion-logo.png`. Future iteration: replace with an inline SVG so it can inherit theme color and scale crisply.
- **Form validation success state** is not enumerated — only `text-input-focused` and `text-input-error`. Inline-success ticks aren't currently used; if added, would need a new component entry.
- **Charts beyond the metric trend chart** (e.g., a bar chart of class-level mAP, a sparkline inside a KPI card) are not yet drawn. The metric trend chart is the only charting component documented.
- **The Hailo-8L target dropdown** in the New Run form currently lists hailo8l, hailo8, hailo15 — these are hardware variants. The label copy might benefit from a per-variant `Hint` once Phase 2 supports more than hailo8l.
- **Pre-built skeleton loaders** are not in the system. Empty states cover "no data ever"; a skeleton loader would cover "data loading right now". Replace ad-hoc "Loading…" text with `{component.skeleton-block}` in a future iteration.
- **Internationalization** (Thai / English UI copy) is not in scope here. All UI copy is currently English; the brand voice principles apply equally to a Thai translation but the type metrics may need re-tuning (Thai needs slightly larger line-heights than Latin).
