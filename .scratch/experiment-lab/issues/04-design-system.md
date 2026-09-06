# 04 — The design system

Type: prototype
Status: open
Blocked by: —

## Question

The owner asked for a `DESIGN.md` — explicitly a **design system**, not an architecture
document: what theme the web app uses, which fonts, which colours, what sizes, corner radii,
animation, and the patterns for error, modal, popup and alert — plus how components and
modules are built and integrated, so the system pulls in one direction.

Today the app has five sections (`Overview`, `Train`, `Models`, `Storage`, `Lab`) whose
visual conventions grew separately: `Lab.tsx` uses upper-case slab headers
(`COUNTING CONTRACT`, `RUN HISTORY`, `SCORER CONTROLS LOCKED`) while the accepted v3 New-run
form uses a different, softer register. A redesign that unifies them needs the rules written
down before the screens are drawn.

This is a prototype ticket: produce something to react to, not a document to approve in the
abstract. Build **one page showing the system applied** — tokens (colour, type scale,
spacing, radius, motion), the component inventory the Lab actually needs (form controls with
help affordances, a data table, a metric readout, a diff view, a video surface with
overlays, a job/progress state, an empty state), and every interaction state including the
ones that get skipped: loading, empty, partial, refused, and error.

Two constraints inherited from decisions already taken:

- **Refuse with a reason, never warn and proceed.** The v3 New-run form blocks known-broken
  paths and names the mechanism; the design system has to give that pattern a component,
  not leave it to each screen.
- **Every number shows its provenance inline** — which clip, which artifact — without a
  click. This project has lost hours to a number whose source nobody could name, so it is a
  design-system obligation, not a per-screen decision.

Deliverable: the prototype page, linked from this ticket, plus `DESIGN.md` recording the
rules it demonstrates. Independent of every other ticket — it can be worked in parallel.
