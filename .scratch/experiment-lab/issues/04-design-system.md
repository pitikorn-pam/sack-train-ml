# 04 — The design system

Type: prototype
Status: resolved
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

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving. Grounded in
[`research/04-design-system-gaps.md`](../research/04-design-system-gaps.md), a read-only pass
over `DESIGN.md`, `tokens.css`, all 1,400 lines of `styles.css` and every `.tsx`.)*

**The brief was wrong and the research says so up front: `DESIGN.md` already exists and is
good, and four of the five "missing" components are already built and shipping.** They live
in `Lab.tsx` in a private visual vocabulary the document has never seen. Refuse-with-a-reason
(`NewRunV3.tsx:502-507`, `Lab.tsx:557-561`), inline provenance (`Lab.tsx:590`, `:592`), a
video surface with drawable overlays (`Lab.tsx:322-338`, `:349-382`), and an honest
job/progress state (`Lab.tsx:416-474`, capped at 95% and labelled an estimate) are all real.

**Exactly one component is genuinely net-new: PARTIAL** — "12 of 14 clips finished" — absent
from both the document and the app. So this is a naming and re-skin job, not a greenfield
design job, and it is far smaller than the ticket assumed.

### The decision: keep the Lab's density and behaviours, take away its palette

`styles.css:1062` declares **thirteen private tokens on one line** and then `margin:-16px`-es
out of the app shell to repaint the whole viewport dark. That is a complete second design
system inside one binary, and it violates `DESIGN.md:951` ("dark mode is not in scope"),
`:941` ("never inline hex"), `:944` ("don't introduce a fourth surface tone") and `:890`
(azure is the primary CTA — the Lab's is green).

`DESIGN.md` wins on palette. The Lab wins on **density** — 13px base, 30px controls — and on
**every behaviour it invented**. A research surface earns its density; it does not earn its
own colour language. So the extension promotes the density to a documented mode and retires
the parallel palette.

`--lab-magenta` and `--lab-yellow` are declared once and used nowhere. Flagged, not deleted —
pre-existing dead code is not this ticket's to remove.

### Six sections get added to `DESIGN.md`

Per §5 of the research, reusing the existing token vocabulary and never inventing a parallel
one: **Refusal & Locked States · Provenance · Comparison & Diff · Video Surface & Overlays ·
Long-Running Jobs · Partial Results**, preceded by the front-matter token additions everything
else references, plus amendments to existing sections that add no new components.

The two inherited constraints get first-class components rather than per-screen improvisation:
a refusal that names the mechanism, and a provenance strip that puts *which clip, which
artifact* beside every headline number.

### Four things block implementation, and each becomes its own ticket rather than bloating this one

1. **The provenance strip cannot be populated yet.** The Lab knows an artifact only as a
   registry row id or a browser `File` (`Lab.tsx:203-205`, `:245`) and attaches video as a
   bare `File` with no clip identity (`Lab.tsx:244`). No `.tsx` reads `evaluations`. The
   component can be specified now and filled only once the Lab writes those rows.
2. **Re-tokenising `Lab.tsx` is a large mechanical diff** — `styles.css:1059-1335` is ~277
   Lab-only lines, much of it minified onto single 3–8kB lines. Its own ticket.
3. **`delta-value` infers "better" from sign** (`Lab.tsx:587`). Direction must be declared per
   metric — fewer missed is better, more counted is not always. That is a behaviour change in
   shipped code and needs its own decision.
4. **The two mandatory comparison refusals do not exist in code.**
   [06](./06-what-is-a-suite-run.md) requires the compare view to refuse across differing
   `config_hash` and `artifact_kind`; `compareRunManifests` (`labApi.ts:276`) today reports
   changed config keys as *information*, not as a refusal.

Nothing blocks **writing** the six sections. Every decision they depend on is settled.
