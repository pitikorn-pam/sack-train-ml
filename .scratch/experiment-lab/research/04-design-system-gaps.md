# 04 — What the design system does not yet cover

Research note for issue [04-design-system](../issues/04-design-system.md).
Read-only pass over `DESIGN.md` (957 lines), `apps/web/src/styles/tokens.css`, `apps/web/src/styles.css` (1400 lines), and every `.tsx` under `apps/web/src/`.
Every claim below cites `path:line`.
Claims I could not evidence are collected under "Suspected, unverified" at the end.

---

## 0. Correction to the brief, up front

The brief is right that `DESIGN.md` contains zero occurrences of "provenance" and zero of "refuse"/"refused" — I re-ran the scan and confirm it, and also confirm zero occurrences of "baseline", "compare", "video", "overlay", "clip", "partial", and "job".

But the brief's framing — that a refusal component, an inline-provenance rule, a video surface with overlays, a diff view and a job/progress state are *missing* — is only true of **the document**.
Four of the five are **already built and shipping in `Lab.tsx`**, in a private visual vocabulary that `DESIGN.md` has never seen:

| "Missing" thing | Already built at | Status |
|---|---|---|
| Refuse-with-a-reason | `NewRunV3.tsx:502-507`, `NewRunV3.tsx:522-524`; `Lab.tsx:205`, `Lab.tsx:557-561`, `Lab.tsx:577-579` | built twice, in two different visual languages |
| Inline provenance | `Lab.tsx:590` (PATH PROVENANCE), `Lab.tsx:592` (DECISION PROVENANCE), `NewRunV3.tsx:496-500` (source legend) | built for *events* and for *config values*, never for a headline number |
| Video surface with drawable overlays | `Lab.tsx:322-338` (canvas draw), `Lab.tsx:349-382` (click→line/zone), `Lab.tsx:582` (viewer markup) | fully built |
| Job / progress state | `Lab.tsx:416-474` (poll loop), `Lab.tsx:582` (progress block), `styles.css:1270-1278` | fully built, including an honest "estimate only, capped at 95%" label |
| Diff / baseline-vs-candidate | `Lab.tsx:587`, `labApi.ts:276` (`compareRunManifests`) | built for *two lab manifests*, not for baseline-vs-candidate over a clip library |
| PARTIAL state ("12 of 14 clips finished") | — | **genuinely absent from both document and app** |

**Consequence for the plan:** this is mostly a *naming and re-skin* job, not a greenfield component job.
The one real net-new component is PARTIAL.

> **Note added during writing.** A parallel agent committed `10dfe59 spec: resolve the evaluations record and the scenario clip` and `000f216 spec: resolve what a suite run is` while this pass was running, plus `supabase/migrations/20260907100010_evaluations_and_clips.sql`.
> Issue 06 flipped from `Status: open` to `Status: resolved` mid-read.
> I re-read it and folded the answer in — it **confirms** §5.6 rather than changing it, and dissolves what would have been the largest blocker.
> Every `issues/06` citation below is to the resolved file.

---

## 1. What `DESIGN.md` already covers well

Specific and fair — none of this should be replaced.

**The token vocabulary is complete and it is actually implemented.**
44 colour tokens (`DESIGN.md:6-43`), 20 typography tokens (`DESIGN.md:45-153`), radius / spacing / elevation scales (`DESIGN.md:155-182`).
`styles/tokens.css:8-130` mirrors it one-for-one, with the file header saying "Edit DESIGN.md first, then update tokens here to match" (`tokens.css:4`).
That round-trip is the part most design systems never get; it exists here and works.

**The status-pill system is canonical and unambiguous.**
Five states with fixed colours (`DESIGN.md:587-593`), the rule "one pill per status, same colour across all sections. Don't invent 'pending-azure' or 'running-yellow' variants" (`DESIGN.md:892`), implemented at `styles.css:344-366`.

**Elevation has a stated philosophy, not just a scale.**
"hairlines as elevation, shadows for emergent surfaces" (`DESIGN.md:681`), with a table saying exactly which of the seven levels each surface class gets (`DESIGN.md:671-679`).
This is the rule that makes new components decidable without asking.

**Radius is justified, not asserted.**
`DESIGN.md:703-704` explains *why* 8px panels / 6px buttons rather than 12-16px — "A KPI card at 12–16px radius reads as 'rounded card, kid's app'".
A rule with a reason survives contact with a new screen; a table of numbers does not.

**The chart palette is already assigned per metric.**
`DESIGN.md:815-824` maps each line colour to a named metric (mAP50 → azure, val_loss → red, mAP50-95 → purple, F1 → pink, cls_loss → orange).
Stroke width, point rendering and the hover crosshair are specified at `DESIGN.md:826`, and the metric-pill toolbar with its 8px colour dot at `DESIGN.md:828`.

**Empty states carry a behavioural rule, not just a box.**
Two lines, status statement + action hint, and "Never use generic 'No data.' — always give the operator the next action" (`DESIGN.md:874-878`).
This is exactly the discipline the Lab's locked states need, and it already exists.

**Forms cover the states that normally get skipped.**
`text-input-focused` / `text-input-error` / `field-error-text` (`DESIGN.md:765-767`, `775`), plus the hint-icon + hint-tooltip pair (`DESIGN.md:777-779`) that the app actually uses (`Hint.tsx`, `NewRunV3.tsx:45`).

**Do's and Don'ts is the strongest section in the file.**
`DESIGN.md:886-908` — 18 lines, each one a decidable rule, several of which the Lab violates (see §4).
"Don't render numbers in Inter — always mono" (`DESIGN.md:905`) and "Don't introduce a fourth surface tone" (`DESIGN.md:944`) are the two the extension has to lean on hardest.

**The Iteration Guide already names the extension protocol.**
`DESIGN.md:939-945`: variants live as separate `components:` entries and are never inlined (`:940`), `{token.refs}` everywhere and never inline hex (`:941`), "Never document hover" (`:942`).
The extension in §5 obeys these; it does not need new meta-rules.

---

## 2. What its own "Known Gaps" section admits

Quoted verbatim from `DESIGN.md:947-957`.

> - **Lucide icon mapping is not yet enumerated.** Components currently reference 🔔 emoji for the notification bell. Future iteration: replace with `lucide-react` `Bell` icon at 18px.
> - **Animation / transition timings** (toast slide-in, modal fade-in, metric chart hover, notification popover spring) are not formalized as tokens. Current implementation uses ad-hoc 150–250ms ease-out — fine for now, formalize when adding more motion.
> - **Dark mode** is not in scope. The system runs light-mode only. The dark surfaces (`surface-dark`) are utility surfaces for code/log, not a full dark theme. A real dark mode would need a separate token map.
> - **iPassion wordmark SVG** is referenced as `docs/logo/65c9f68027a94379fb020c18_iPassion-logo.png`. Future iteration: replace with an inline SVG so it can inherit theme color and scale crisply.
> - **Form validation success state** is not enumerated — only `text-input-focused` and `text-input-error`. Inline-success ticks aren't currently used; if added, would need a new component entry.
> - **Charts beyond the metric trend chart** (e.g., a bar chart of class-level mAP, a sparkline inside a KPI card) are not yet drawn. The metric trend chart is the only charting component documented.
> - **The Hailo-8L target dropdown** in the New Run form currently lists hailo8l, hailo8, hailo15 — these are hardware variants. The label copy might benefit from a per-variant `Hint` once Phase 2 supports more than hailo8l.
> - **Pre-built skeleton loaders** are not in the system. Empty states cover "no data ever"; a skeleton loader would cover "data loading right now". Replace ad-hoc "Loading…" text with `{component.skeleton-block}` in a future iteration.
> - **Internationalization** (Thai / English UI copy) is not in scope here. All UI copy is currently English; the brand voice principles apply equally to a Thai translation but the type metrics may need re-tuning (Thai needs slightly larger line-heights than Latin).

### Three of these are already stale

**Gap 1 (bell emoji) is closed.**
`NotificationCenter.tsx:2` imports `{ Bell } from "lucide-react"` and `NotificationCenter.tsx:106` renders `<Bell size={16} />`.
The size is 16, not the 18 the gap predicts; the emoji is gone.

**Gap 4 (wordmark PNG) is closed.**
`Logo.tsx:8-31` is an inline SVG that fills from `var(--color-primary)` (`Logo.tsx:16`) and `var(--color-on-primary)` (`Logo.tsx:26`) — exactly what the gap asked for.
No PNG is referenced anywhere in `apps/web/src/`.

**Gap 2 (motion) is half-closed.**
Duration tokens exist: `--t-fast: 120ms ease-out`, `--t-base: 180ms`, `--t-slow: 260ms` (`tokens.css:122-125`), used at e.g. `styles.css:428` and `styles.css:932`.
What is still missing is the *document* side — `DESIGN.md` has no `motion:` block, so the tokens have no owner and the Lab ignores them (`styles.css:1082` hard-codes `.16s ease`, `styles.css:1268` hard-codes `.12s ease`, `styles.css:1274` hard-codes `.25s ease`).

**Gap 8 (skeleton loaders) is still fully open** and the Lab makes it worse: `App.tsx:46` renders `<p>Loading…</p>`, `Storage.tsx:89` renders `Loading…`, `Lab.tsx:572` renders "Loading model registry…", `Lab.tsx:586` renders "Checking the backend run store…", and `Lab.tsx:568` renders "Loading tasks…" — five ad-hoc loading strings, no shared component.

**Gaps 3, 5, 6, 7, 9 I found no evidence against.**
Gap 3 (dark mode out of scope) is directly contradicted *in practice* by the Lab — see §4.1 — but the document's position is unchanged.

---

## 3. What is missing for the Lab, specifically

The Lab is *(model artifact) × (clip) → (numbers, verdict)* (`issues/02-what-is-one-evaluation.md:51-52`).
Nothing in `DESIGN.md` knows that sentence exists.

### 3a. Refuse with a reason, never warn and proceed — no component

**How `NewRunV3.tsx` does it today (this is the accepted pattern, read in full):**

1. Refusal is **data, not markup.** `schema.ts:12` types the category `"field" | "advanced" | "derived" | "refused"`, and the refused entries live in `contracts/param-schema.json`. There is exactly one today:
   `single_cls` — *"Collapses every class into one. The whole downstream contract is two classes — the labelmap, the on-chip NMS config and the edge runtime — so a run with this set would train, export, compile, deploy, and be wrong."*
   The help text **names the mechanism**, which is the whole point.
2. A refused key is **erased from the resolved config**, not merely flagged: `schema.ts:99` filters `p.category !== "refused"` inside `resolveEffective`.
3. The escape hatch is policed. `NewRunV3.tsx:163-172` parses the Advanced JSON textarea, finds any refused key, and returns `` `${hit} is refused: ${...help}` `` — the reason is the schema's own sentence, never re-authored per screen.
4. Refusals and warnings are **different severities with different consequences**: `NewRunV3.tsx:175-178` splits `blocking` from `warning`; `NewRunV3.tsx:502-507` renders `⛔ {message}` vs `⚠ {message}`.
5. **The submit button becomes the error message.** `NewRunV3.tsx:522-524`: `disabled={!!blocking.length || busy}` with the label `Fix ${n} blocking issue${s}`. There is no "proceed anyway".
6. Cross-field refusals exist and read like prose, not like validation: `schema.ts:148-152` — *"Optimization level 2 fine-tunes over 1024 images — raise the calibration count or drop to level 0."*

**What `DESIGN.md` has instead:** `field-error-text` (`DESIGN.md:775`) — "Appears on submit-time validation failure; clears when the user starts editing the field."
That is per-field syntax validation. It cannot express "this path is known-broken and here is the mechanism", it has no blocking/warning severity split, and it says nothing about the submit button.

**The Lab has already re-invented the same pattern in a third dialect,** because the document gave it nothing:
- `Lab.tsx:205` — `runDisabledReason` is a single string that names the blocker ("Add a source video to begin." / "Lab backend unavailable." / "Select or upload a .pt model first." / "Waiting for video metadata."), surfaced next to a disabled run button at `Lab.tsx:582`.
- `Lab.tsx:557-561` — `scorerLockedReason` distinguishes *"Locked: the backend health contract reports scorer capability=false"* from *"Locked: this run returned no event score_breakdown or verdict fields"*. Two different mechanisms, two different sentences.
- `Lab.tsx:526-533` — `capabilityReason()` falls back through result → health → unsupported-list → a generated sentence, so a locked control can always say *why*.
- Rendered as `.lab-locked-output` (`styles.css:1094-1097`) and `.lab-capability-notice` (`styles.css:1334`), with the strings `SCORER CONTROLS LOCKED` (`Lab.tsx:578`), `EVENT DIFF LOCKED` (`Lab.tsx:587`), `DETECTOR DIAGNOSTICS LOCKED` (`Lab.tsx:589`).

So: **two shipped implementations of one idea, zero documentation, three visual dialects.**
The extension has to name one component and delete two dialects.

### 3b. Every number shows its provenance inline — no rule, no component

The app has three separate provenance mechanisms and none of them attaches to a headline number.

- **Config-value provenance exists and is good.** `schema.ts:15` types `Source = "set" | "default" | "derived"`; `NewRunV3.tsx:33-37` labels them *"you set it"* / *"default — nobody typed this"* / *"derived"*; `NewRunV3.tsx:496-500` renders a three-dot legend; `NewRunV3.tsx:513` puts a dot on every row; `NewRunV3.tsx:191` writes the source as a trailing comment on every YAML line.
  The component's own docstring says this is "the thing that would have shown `optimizer: AdamW` before the Muon crash cost a Colab session" (`NewRunV3.tsx:11-12`).
- **Event provenance exists and is thorough.** `labApi.ts:65` types `EventProvenance`; `Lab.tsx:592` renders decision provenance (raw conf / dedup hit / cooldown hit / exclusion hit / recovered / reason), geometry provenance (centroid, line, zone) and path provenance (predictor, points, corridor distance, displacement); 28 columns of it export to CSV at `Lab.tsx:499-512`.
- **But the numbers themselves are naked.** `Lab.tsx:518` builds `stats` as `frames / max sacks per frame / avg sacks per frame` with no clip name and no artifact identity. `Lab.tsx:588` renders the count summary — confirmed / flagged / recovered / excluded / total / GT / error-vs-GT — with no artifact, no clip, no config hash.
  The model that produced them is chosen at `Lab.tsx:572` across three modes (registry / local / legacy) and the only place its identity appears afterwards is a note reading `Artifact: ${selectedRegistry.artifacts?.pytorch?.key}` **inside the picker**, not beside the result.

That is precisely the failure `issues/02` legislates against: `artifact_sha256` mandatory because "a pointer can be repointed and this project's recurring bug is measuring a different artifact than the one deployed" (`issues/02-what-is-one-evaluation.md:111-113`), and `artifact_kind` from day one because "it is the label that stops a `.pt` number and a `.hef` number from ever being compared unlabelled" (`:118-120`).

`DESIGN.md` has no counterpart.
`kpi-card` (`DESIGN.md:741-745`) is a numeral plus a caption — there is no slot for a source, and nothing in the Do's and Don'ts requires one.

### 3c. A metric readout — three exist, none documented as one

- `.kpi` — Overview (`Overview.tsx:150-157`, `styles.css:440-462`), 28px mono numeral, tonal variants.
- `.metric-grid-item` — Models version detail (`Models.tsx:322-330`, `styles.css:951-958`), 16px mono numeral on `surface-soft`.
- `.lab-stat-grid` and `.lab-summary-value` — Lab (`Lab.tsx:584`, `Lab.tsx:588`, `styles.css:1078`, `styles.css:1082`), 17px and 18px mono numerals on the Lab's own dark panel.

`DESIGN.md:741` documents only the first.
Three readouts, three sizes (28 / 16 / 17-18), two of them off the `metric-numeral` scale entirely.

### 3d. A diff / comparison view — built for the wrong pair

`labApi.ts:276` `compareRunManifests(baseline, current)` and `Lab.tsx:587` render an event-level diff: added IDs, removed IDs, changed records with per-field before→after, aggregate metric deltas marked SECONDARY, changed config keys.
The primary/secondary hierarchy is deliberate and correct — event identity first, aggregates second, both refusing to infer (`Lab.tsx:587`: *"No event identity is inferred from aggregate counts or event_ids"*).

But it compares **two lab manifests of the same clip**.
The Lab's actual verb is baseline-vs-candidate **over a clip library** (`issues/06-what-is-a-suite-run.md:32-36`), which needs a per-clip row shape (clip · GT · baseline counted · candidate counted · Δ · a way to reach the disagreeing frames) that does not exist anywhere.
`DESIGN.md` documents neither shape — the word "compare" does not appear in it.

### 3e. A video surface with drawable overlays — built, undocumented

`Lab.tsx:322-338` paints the canvas: zones as closed polygons (`#ff4d5f` enabled / `#64748b` disabled), the draft polyline (`#4de1ff` for a line, `#ffc44d` for a zone), and the committed count line.
`Lab.tsx:349-374` maps a click through letterboxing into video pixel space and refuses clicks in the bars — *"Click inside the rendered video area, not the letterbox bars."*
`Lab.tsx:375-379` commits a zone, refusing under 3 points.

Three problems, all documentation-shaped:
1. The five overlay colours are raw hex in a `.tsx` file (`Lab.tsx:335-337`), the only hex left in the codebase outside `MetricChart` and `RunsList`.
2. `DESIGN.md` has no `video-surface`, no `overlay-*` colour role, and no aspect/letterbox rule.
3. Zone red `#ff4d5f` and line cyan `#4de1ff` are not `{colors.danger}` / `{colors.primary}` — they are the Lab's private palette (§4.1).

### 3f. A job / progress state for long runs — built, undocumented, and more honest than the document

`Lab.tsx:416-447` runs a real polling loop with exponential backoff (500ms → ×1.5 → cap 4000ms, 240 polls), reading `processed_frames` / `total_frames` / `progress` / `elapsed_ms` / `eta_ms` from the server.
`Lab.tsx:448-452` falls back to a synchronous legacy endpoint and **switches progress mode to `"estimate"`**.
`Lab.tsx:582` renders the difference out loud: *"Estimate only — the legacy synchronous fallback does not report server progress and is capped at 95% until the response arrives."*
`Lab.tsx:169-183` implements that cap (`Math.min(95, …)`).

That is a genuinely good pattern — a progress bar that says whether it is measuring or guessing — and it is exactly the "provenance on every number" rule applied to a percentage.
`DESIGN.md:830-834` documents `progress-track` / `progress-fill` as a 6px bar and nothing else: no determinate/indeterminate distinction, no measured/estimated distinction, no elapsed/ETA row, no status line, no cancel.

### 3g. A PARTIAL state — genuinely missing everywhere

Neither `DESIGN.md` nor the app has one.
`issues/02` provisions for it in the record (`status` / `error` columns, *"'12 of 14 clips done, 1 failed' is unrepresentable without them"*, `issues/02-what-is-one-evaluation.md:165-168`).
`issues/06` (now resolved) settles the display rule and hands the design system its exact obligation: `suite_runs.status` separates `complete` / `incomplete` / `failed`, and *"the aggregate number is not rendered at all unless `status = 'complete'`. An incomplete suite renders as `12/14 clips · 2 failed` with the failures reachable in one click. It must be impossible for a partial suite to look like a whole one — the display rule is the enforcement"* (`issues/06-what-is-a-suite-run.md:134-141`).

`DESIGN.md`'s status vocabulary cannot express it: five states, "A run / version / deployment is always exactly one of these five" (`DESIGN.md:588`) — pending, running, succeeded, failed, cancelled.
A suite that is 12/14 done with 1 failed and 1 not started is none of them, and rendering it `succeeded` is the exact failure mode both issues legislate against.

---

## 4. Where the app contradicts `DESIGN.md` today

Ordered by severity. "Which side is right" is my call, stated plainly.

### 4.1 — SEVERE: `Lab.tsx` runs a complete parallel design system

`styles.css:1062` opens the Lab with **thirteen private tokens on one line**:

```
.lab-shell { --lab-bg:#080d16; --lab-panel:#0d1522; --lab-panel-2:#111c2b; --lab-border:#223044;
  --lab-text:#e8eef7; --lab-muted:#8291a6; --lab-cyan:#4de1ff; --lab-green:#49e58b;
  --lab-amber:#ffc44d; --lab-red:#ff4d5f; --lab-magenta:#f06cff; --lab-yellow:#ffd45c; … }
```

It then `margin:-16px`-es out of the app shell and repaints the whole viewport dark (`styles.css:1062`).

This violates, at minimum:
- `DESIGN.md:951` — "**Dark mode** is not in scope. The system runs light-mode only… A real dark mode would need a separate token map." The Lab built exactly that separate token map, undeclared.
- `DESIGN.md:941` — "**Use `{token.refs}` everywhere** — never inline hex. If a new color is needed, add it to `colors:` first." Thirteen new colours, zero added to `colors:`.
- `DESIGN.md:944` — "White + azure + navy is the trinity. Don't introduce a fourth surface tone." The Lab introduces cyan, green, amber, red, magenta and yellow as *primary* roles, not status roles.
- `DESIGN.md:890` — "Reserve `{colors.primary}` (azure) for: primary CTA buttons…". The Lab's primary CTA is green `--lab-green` (`styles.css:1334`, `.lab-run-button`), its accent is cyan.
- `DESIGN.md:889` — "Anchor every section on the **white canvas**."

**Which side is right:** `DESIGN.md`, on the palette.
Two design systems in one binary is the defect; a research surface does not need its own colour language to be dense.
**But the Lab is right about density** — 13px base font (`styles.css:1062`), 30px controls (`styles.css:1075`) — and about every *behaviour* it invented (locked-with-reason, provenance blocks, honest progress).
The extension should keep the behaviours and the density, and take the palette away.

`--lab-magenta` and `--lab-yellow` are declared at `styles.css:1062` and each appears **exactly once in the whole stylesheet** — that declaration — and zero times in any `.tsx`. Dead tokens. (Flagging, not deleting; per repo rule on pre-existing dead code.)

### 4.2 — SEVERE: uppercase slab headers are a whole undocumented type role

`styles.css:1066`:

```
.lab-kicker,.lab-card-title { color:var(--lab-cyan); font-size:10px; letter-spacing:1.4px;
  font-weight:700; text-transform:uppercase; }
```

`DESIGN.md:620` defines `caption-uppercase` as **11px / 600 / +1.2px** and reserves it for "Role badge, 'NEW' badge".
The Lab's version is 10px / 700 / +1.4px, cyan, and carries **every panel title in the section** — `COUNTING CONTRACT` (`Lab.tsx:576`), `RUN HISTORY` (`Lab.tsx:586`), `SCORER CONTROLS LOCKED` (`Lab.tsx:578`), plus `RESEARCH CONTROL ROOM / V1 COUNTING` (`Lab.tsx:566`), `TASK-FIRST WORKSPACE` (`Lab.tsx:568`), `OUTPUT PREVIEW` and `REPRODUCIBILITY` (`Lab.tsx:584-585`), `A/B EVENT + CONFIG COMPARE` (`Lab.tsx:587`), `COUNT SUMMARY` (`Lab.tsx:588`), `DETECTION DIAGNOSTICS` (`Lab.tsx:589`), `PATH PROVENANCE` (`Lab.tsx:590`), `PER-CROSSING DETAILS` (`Lab.tsx:591`), `CROSSING INSPECTOR` (`Lab.tsx:592`), `SCORER BREAKDOWN` (`Lab.tsx:593`).

`DESIGN.md:908` says the opposite: "Don't make a panel header in the same size as a section header. Hierarchy: `display-lg` for sections, `title-lg` for panels."
A panel header in the Lab is 10px uppercase cyan; in Models it is `<h3>` (`Models.tsx:321`, `:352`, `:397`, `:440`); in Overview it is `<h2>` (`Overview.tsx:88`, `:110`, `:130`).

There is a further sub-role the document has no name for: `.lab-output-label` (`styles.css:1095`) at **9px / 700 / +0.8px mono**, used for `MODE` / `CONFIG` / `FEATURES` / `OVERLAY EXPORTS` / `DECISION PROVENANCE` / `GEOMETRY` / `ADDED IDS` / `CHANGED CONFIG KEYS`.
So the Lab has *two* uppercase micro-label tiers where the document has one, and neither of the Lab's matches the document's metrics.

**Which side is right:** `DESIGN.md` on the token values (11px / 600 / +1.2px), the Lab on the *need* — a dense inspector genuinely wants a two-tier micro-label.
Resolution: promote `caption-uppercase` to a documented panel-eyebrow role, add one documented second tier, and delete `.lab-kicker` / `.lab-card-title` / `.lab-output-label` as separate faces.
9px body text also fails the accessibility floor the rest of the system holds at 11px.

### 4.3 — HIGH: three metric line colours disagree with the documented assignment

`MetricChart.tsx:14-30` hard-codes the palette:

| Metric | `MetricChart.tsx` | `DESIGN.md` | Verdict |
|---|---|---|---|
| `map50` | `#3b82f6` (`:15`) | azure `#0080c8` — "used for **mAP50** (the headline metric)" (`DESIGN.md:816`) | **document is right** — mAP50 is the headline metric and it is currently painted `info` blue, so the brand colour never appears on the chart |
| `recall` | `#f59e0b` (`:18`) | green `#10b981` — "used for **precision** or **recall**" (`DESIGN.md:817`) | document is right, or the document should say recall is amber; today they simply disagree |
| `cls_loss` | `#fb923c` (`:21`) | orange `#f97316` (`DESIGN.md:824`) | near-miss, two different oranges |

Six further metrics (`dfl_loss`, `val_box_loss`, `val_cls_loss`, `val_dfl_loss`, `lr_pg0-2`, `progress`) are painted from colours that appear nowhere in `DESIGN.md` (`MetricChart.tsx:22-29`), plus a fallback `#94a3b8` used three times (`MetricChart.tsx:191`, `:212`, `:281`).
All of it is inline hex, against `DESIGN.md:941`.

### 4.4 — HIGH: the "running" status dot is the wrong blue

`RunsList.tsx:5-11` hard-codes `STATUS_COLOR`, and `running: "#3b82f6"` (`RunsList.tsx:7`) is `{colors.info}`, not `{colors.status-running}` `#0080c8` (`DESIGN.md:590`).
The other four match the documented values exactly.

The same app already gets this right two ways: `tokens.css:51` defines `--color-status-running: var(--color-primary)`, and `styles.css:355` paints `.pill-running` from `--color-primary-soft` / `--color-primary-active`.
So on one screen a running run is azure (`Overview.tsx:121` → `.pill-running`) and on the next it is info-blue (`RunsList.tsx:85`).

**Document is right.** `DESIGN.md:787` explains why: "Azure pill is reserved for 'live work' — it's the most visually distinctive status because it's the one operators check most often."

### 4.5 — MEDIUM: two pill variants exist that the status system forbids

`styles.css:362` `.pill-active` and `styles.css:364` `.pill-production` are used at `Models.tsx:361` and `Models.tsx:409`.
Neither is in the canonical five (`DESIGN.md:587-593`) nor in the documented `components:` list (`DESIGN.md:353-394`).
`DESIGN.md:892` — "Don't invent 'pending-azure' or 'running-yellow' variants."

Also present but undocumented: `.pill-waiting`, `.pill-loading`, `.pill-archived`, `.pill-inactive` (`styles.css:359-365`).

**Which side is right:** the app has a real need — deployment state is not run state — so the *document* is incomplete here rather than the code being wrong.
Fix by documenting a second, clearly-separate deployment-state pill family, not by folding them into the run-status five.

### 4.6 — MEDIUM: the `pv3` form leaks off every scale

The New-run form is the *accepted* design and it still drifts:

| What | Where | Documented value |
|---|---|---|
| input radius 8px | `styles.css:1350` | 6px `{rounded.md}` for inputs (`DESIGN.md:697`, `:763`) |
| segmented-control radius 8px | `styles.css:1358` | 6px |
| size-card radius 10px | `styles.css:1363` | **not on the scale at all** (3/4/6/8/12/16, `DESIGN.md:693-701`) |
| compat banner radius 9px | `styles.css:1369` | not on the scale |
| YAML block radius 9px | `styles.css:1393` | not on the scale |
| `font-size:15px` on a panel `h2` | `styles.css:1345` | `title-lg` 18px for panel `<h2>` (`DESIGN.md:613`) |
| `font-size:11.5px` / `12.5px` / `10.5px` | `styles.css:1369`, `:1359`, `:1379` | scale is 11/12/13/14/16/18/22/28/36/48 (`DESIGN.md:607-626`) |
| `font-weight:650` | `styles.css:1379` | 400/500/600/700 (`tokens.css:90-93`) |
| `font-weight:760` | `styles.css:1089` (Lab h2) | same |
| `background:#fff` ×3 | `styles.css:1350`, `:1359`, `:1363` | `{colors.canvas}` |
| `color:#0b6446` / `#8a5b0a` / `#8f3440` / `#855508` / `#cbd5e1` | `styles.css:1371-1373`, `:1380-1381`, `:1391-1393` | inline hex, against `DESIGN.md:941` |

**Document is right on all of these**, and they are cheap to fix — every one is a token substitution.

### 4.7 — MEDIUM: the provenance legend's three colours are undocumented and arbitrary

`styles.css:1389`: `.pv3-dot.set{background:#f59e0b}` (warning amber) `.pv3-dot.default{background:#ec4899}` (the chart's F1 pink) `.pv3-dot.derived{background:#64748b}` (a slate that is in no token file).

This is *the* provenance affordance — the one the brief wants promoted to a first-class component — and its colour language is three borrowed hexes with no semantic story.
Amber says "warning" everywhere else in the system; pink is a chart line; slate is nothing.

**Neither side is right.** The pattern is right and the palette needs re-deriving from tokens as part of the extension (§5.2).

### 4.8 — LOW: the document's nav is stale

`DESIGN.md:715` — "primary horizontal menu (Overview / Train / Models / Storage)".
`DESIGN.md:918` — "Full **4-section** top-nav".
`App.tsx:15-21` has five: Overview, Train, Models, Storage, **Lab**.

**The app is right.** The Lab is a section and the document predates it.
This is also the smallest signal that `DESIGN.md` was written before the Lab existed, which explains most of §4.1-4.2.

### 4.9 — LOW: component names in the document do not match class names in the code

| `DESIGN.md` | code |
|---|---|
| `badge-role-admin` / `badge-role-user` (`:395`, `:401`) | `.role-badge.admin` / `.role-badge.read` (`styles.css:140-141`, `App.tsx:96`) |
| `version-card-selected` (`:274`, `:751`) | `.version-card.active` (`styles.css:934`) |
| `platform-card-ready` / `-missing` (`:280`, `:285`) | `.platform-card.ready` / `.missing` (`styles.css:940-947`) |

The *values* match in each case; only the naming convention differs (the document promotes variants to their own key per `DESIGN.md:940`, the CSS uses modifier classes).
**Low priority, but it undermines `DESIGN.md:939`** — "Focus on ONE component at a time. Reference its YAML key" — because the key you would search for is not in the codebase.

### 4.10 — LOW: KPI row gap

`DESIGN.md:647` — "Gap inside grids: `{spacing.md}` (16px) for KPI rows and version-card grids."
`styles.css:438` — `.kpi-row { … gap: var(--space-sm); }` = 12px.
**Trivial; pick one.**

### 4.11 — LOW: gate verdict has no component

`Models.tsx:344-348` renders `Gate: PASSED/FAILED — {reason}` styled by `.gate-pass` / `.gate-fail` (`styles.css:988-989`) — coloured bold text, no pill, no callout.
`DESIGN.md:582` and `:584` both name "gate passed" / "gate failed" as *uses* of the success and danger colours but never give the verdict a component.
This is the closest thing the current app has to a "verdict" affordance, and the Lab's evaluation verdict (`pass`/`fail`/`inconclusive`, `issues/02:94`) will need one.

---

## 5. The minimal extension

Add **six sections** to `DESIGN.md`, plus entries in the existing `colors:` and `components:` front-matter.
Reuse the existing token vocabulary throughout — no `--lab-*`, no second palette, no new scale.
Nothing below replaces anything in §1.

### 5.0 — Front-matter additions (do these first; everything else references them)

Add to `colors:` — six new tokens, all derived from existing ones rather than invented:

```yaml
  # Provenance sources — the three ways a value can have arrived.
  source-set:        "{colors.primary}"          # a human typed it
  source-default:    "{colors.muted}"            # nobody typed it
  source-derived:    "{colors.accent-cyan}"      # computed from other values
  # Overlay roles on video — deliberately NOT the status colours.
  overlay-line:      "{colors.accent-cyan}"      # the canonical count line
  overlay-zone:      "{colors.danger}"           # an enabled exclusion zone
  overlay-draft:     "{colors.warning}"          # points placed but not committed
```

Rationale for the source triple: it must read as *neutral metadata*, so it cannot borrow amber (which means "warning" everywhere else — the current `#f59e0b` at `styles.css:1389` actively misleads).
Azure / muted / cyan gives one "you did this", one "nobody did this", one "the machine did this", all already in the trinity.

Add to `typography:` — one token only:

```yaml
  micro-uppercase:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.8px
```

This is the documented replacement for `.lab-output-label` (`styles.css:1095`).
It is 11px, not the Lab's 9px, because 9px fails the floor the rest of the system holds.
`caption-uppercase` (`DESIGN.md:106-111`) stays as-is and takes over from `.lab-kicker` / `.lab-card-title`; §4.2 dies with no new token.

Add to `motion:` — a new top-level block that adopts what `tokens.css:122-125` already ships:

```yaml
motion:
  fast: "120ms ease-out"   # hover/press feedback, focus ring
  base: "180ms ease-out"   # panel and popover entry, progress fill
  slow: "260ms ease-out"   # modal, toast, notification popover
  reduced: "respect prefers-reduced-motion; drop to 0.01ms"
```

This closes Known Gap 2 rather than restating it — the tokens exist, they just had no owner.
The reduced-motion line is already honoured at `styles.css:1082`, `:1184`, `:1279`.

### 5.1 — New section: **Refusal & Locked States**

Placed immediately after "Forms", because it is the escalation above `field-error-text`.

The rule, stated as a Do: **a control that cannot be used is disabled and says why, naming the mechanism. There is no "proceed anyway".**

Three components:

**`refusal-banner`** — a blocking issue in a form or panel.
Anatomy: `⛔` glyph (or Lucide `ShieldAlert`, 14px) · one sentence naming the mechanism · optional `chip` carrying the offending key.
Background `{colors.danger-soft}`, text `{colors.danger}`, 3px left border `{colors.danger}`, rounded `{rounded.md}`, padding 8px × 10px, `{typography.body-sm}`.
Same geometry as `callout-info` (`DESIGN.md:882`) so it slots into the existing callout family rather than starting a new one.
Existing implementation to re-skin: `.pv3-issue.blocking` (`styles.css:1391`), rendered at `NewRunV3.tsx:503`.

**`warning-banner`** — the non-blocking sibling. Identical anatomy, `{colors.warning-soft}` / `{colors.warning}`, `⚠` glyph.
The **visual distinction from `refusal-banner` must be legible at a glance** — that is the whole point of the severity split at `NewRunV3.tsx:175-178`.
Existing: `.pv3-issue.warning` (`styles.css:1392`).

**`locked-panel`** — a whole capability that is unavailable, replacing the panel's body.
Anatomy: `micro-uppercase` label in `{colors.muted}` naming what is locked · a one-line reason naming the mechanism · optional second line saying what would unlock it.
Background `{colors.surface-soft}`, 1px dashed `{colors.hairline}`, rounded `{rounded.lg}`, padding `{spacing.md}`.
Deliberately built on `empty-state` (`DESIGN.md:874-878`) and inheriting its "always give the operator the next action" rule — a locked panel is an empty state with a cause.
Existing: `.lab-locked-output` (`styles.css:1094-1097`), `.lab-capability-notice` (`styles.css:1334`), `.lab-research-empty` (`styles.css:1078`) — three classes collapsing into one.

**`button-primary-blocked`** — the submit-button variant that carries the count.
Label becomes `Fix {n} blocking issue{s}`, `disabled`, background `{colors.hairline}`, text `{colors.muted}`.
Existing and already correct in behaviour: `NewRunV3.tsx:522-524`.
Document it so the Lab's run button (`Lab.tsx:582`, currently a green `.lab-run-button` with a separate hint string at `Lab.tsx:205`) converges on it.

Copy rule to write down: **the reason sentence is authored once, next to the mechanism, and rendered verbatim.**
`contracts/param-schema.json` holds the `single_cls` sentence; `NewRunV3.tsx:168` renders it; no screen re-words it.
`Lab.tsx:526-533` `capabilityReason()` is the same discipline for backend capabilities.

### 5.2 — New section: **Provenance**

Placed after "Refusal & Locked States". This is the section the brief is really asking for.

The rule, stated as a Don't, to sit in the Do's and Don'ts list:
**Don't render a measured number without its source in the same visual block. Which clip, which artifact, no click.**

Three components:

**`source-dot`** — 7px square, `{rounded.xs}`, filled from `{colors.source-set}` / `{colors.source-default}` / `{colors.source-derived}`.
Sits before a key in a resolved-config list.
Existing: `.pv3-dot` (`styles.css:1388-1389`), `NewRunV3.tsx:513`. Only the three fills change.

**`source-legend`** — the three dots with their sentences: *you set it* / *default — nobody typed this* / *derived*.
`{typography.caption}` in `{colors.muted}`, 12px gap between entries.
Existing and already well-worded: `NewRunV3.tsx:33-37`, `:496-500`, `styles.css:1387`.

**`provenance-strip`** — **the net-new one, and the piece the whole extension exists for.**
A one-line strip that sits *inside* the card carrying a number, directly under the numeral, never in a tooltip and never behind a disclosure.

Anatomy, left to right:
- artifact `chip` — `{typography.code-inline}` — e.g. `v1.4.2 · pt` or `runA.pt`, with `artifact_kind` always visible because `issues/02:118-120` requires `.pt` and `.hef` numbers to be distinguishable on sight
- `·` separator in `{colors.hairline}`
- clip name — `{typography.caption}` in `{colors.body}` — truncating from the left so the distinguishing tail survives
- `·`
- frame range — `{typography.code-inline}` in `{colors.muted}` — shown **only when `whole_clip` is false**, because `issues/02:135-137` stores that flag precisely so a partial run cannot pass as a whole one
- right-aligned: `pill-success` "reportable" or `pill-warning` "unverified", driven by `evaluations.reportable` (`issues/02:86`, `:150-157`)

Typography `{typography.caption}`, colour `{colors.muted}`, top border 1px `{colors.hairline-soft}`, padding-top `{spacing.xxs}`.
It is deliberately quiet — it must be *present* on every number, which means it cannot be loud on any of them.

**`kpi-card-sourced`** — a documented variant of `kpi-card` (`DESIGN.md:741`) = numeral + label + `provenance-strip`.
State the rule that in the Lab this variant is **mandatory** and bare `kpi-card` is not permitted.
That is what turns "every number shows its provenance" from an intention into a component you can fail a review against.

Also document the two provenance readouts that already exist and are good, so they stop being Lab-private: the decision/geometry/path blocks at `Lab.tsx:592` become a documented `provenance-block` (a `micro-uppercase` label over a 2-column key/value grid in `{typography.code-inline}`), reusing `.lab-detail-block`'s anatomy (`styles.css:1294-1301`) on light surfaces.

### 5.3 — New section: **Comparison & Diff**

Placed after "Tables", because a diff is a table with a stance.

The rule: **a comparison names both sides at the top and never renders a delta without both absolute values.**
Taken directly from what already works at `Lab.tsx:587`, where every metric delta renders as `{delta} · {key} · {baseline} → {current}`.

**`compare-header`** — two `provenance-strip`s stacked, labelled `baseline` and `candidate`, separated by a hairline.
Replaces `.lab-compare-ids` (`styles.css:1165-1167`).

This is where the §5.1 refusal pattern earns its keep, because `issues/06:153-158` makes two refusals **mandatory** on this exact surface:

> - **It refuses to compare across different `config_hash` values without saying so.** The repo's one-lever discipline is only meaningful if the tool can tell you the lever moved.
> - **It refuses to compare across different `artifact_kind` values without saying so.** A `.pt` number next to a `.hef` number, unlabelled, is the bug class this map exists to close.

So `compare-header` has a **refused state**: when either hash or kind differs, it renders a `refusal-banner` naming which one moved, and the diff table below it does not render.
This is the single strongest argument for building §5.1 and §5.2 before anything else — the comparison view is unbuildable without both, and it is "the actual verb" (`issues/06:31`).

**`delta-value`** — a signed number in `{typography.metric-numeral-sm}`.
`{colors.success}` when the delta is an improvement, `{colors.danger}` when a regression, `{colors.muted}` at zero.
**Improvement is direction-dependent and must be declared per metric, not inferred from sign** — more counted is better against GT-under, worse against GT-over.
Existing: `.lab-delta-positive` / `.lab-delta-negative` (`styles.css:1175-1176`), which currently *do* infer from sign (`Lab.tsx:587`: `metric.delta > 0 ? …positive`). Flag that as a bug for the implementation ticket, not for this document.

**`diff-row`** — one clip per row: clip name · GT · baseline counted · candidate counted · `delta-value` · a link to the disagreeing frames.
Built on `data-table-row` (`DESIGN.md:801`) with numeric columns right-aligned in mono, per `DESIGN.md:805`.

**Primary/secondary hierarchy, stated as a rule:** event-level differences are primary and aggregate deltas are secondary.
`Lab.tsx:587` already labels them `EVENT-LEVEL DIFF · PRIMARY` and `AGGREGATE METRIC DELTAS · SECONDARY` and dims the latter (`.lab-aggregate-secondary { opacity:.86 }`, `styles.css:1323`).
Keep the hierarchy; express it with `{typography.title-sm}` vs `{typography.caption}` and panel order rather than opacity, because opacity as hierarchy is not a documented device in this system.

### 5.4 — New section: **Video Surface & Overlays**

Placed after "Charts", as the other data-bearing canvas.

**`video-surface`** — 16:9 container, background `{colors.surface-dark}`, rounded `{rounded.lg}`, `object-fit: contain` with letterbox bars in `{colors.surface-dark}`.
Existing: `.lab-viewer` (`styles.css:1078`) — same shape, but repainted from `{colors.surface-dark}` instead of `#050a11`.
This is the one place `surface-dark` is legitimate under `DESIGN.md:534` ("code blocks, log streams… data-dense panels"), so the Lab's dark video well survives §4.1 intact.

**`overlay-line`** — 2px stroke `{colors.overlay-line}`, endpoint handles as filled circles of the same colour, radius `max(4px, videoWidth/160)`.
The existing scaling maths at `Lab.tsx:331`/`:333` is correct and should be documented as-is — overlay stroke scales with source resolution, not with display size.

**`overlay-zone`** — closed polygon, 2px stroke `{colors.overlay-zone}`, fill at 20% alpha; disabled zones drop to `{colors.muted}` at 12%.
Existing: `Lab.tsx:335`.

**`overlay-draft`** — points placed but not committed. Stroke `{colors.overlay-draft}`, open path, vertex dots.
Existing: `Lab.tsx:336`.

**Rules to write down** (all three already implemented, none documented):
- Overlay colours are a **fourth colour family**, distinct from status pills. A red zone does not mean "failed"; it means "excluded". Say so explicitly, or §4.1's confusion returns.
- Clicks map through the letterbox into source-pixel space, and a click on a bar is **refused with a reason** — *"Click inside the rendered video area, not the letterbox bars."* (`Lab.tsx:363`). This is the refusal pattern applied to a canvas, and it is the example that proves the pattern generalises.
- Geometry is stored in pixel space anchored to a stated frame (`Lab.tsx:377`, `Lab.tsx:575` — "All geometry is pixel-space and anchored to frame 0").

### 5.5 — New section: **Long-Running Jobs**

Extends the existing "Progress" section (`DESIGN.md:830-834`) rather than replacing it — `progress-track` and `progress-fill` stay exactly as documented.

**`job-progress`** — the block that wraps a `progress-track`.
Anatomy: mode label (`{typography.title-sm}`) · percent (`{typography.metric-numeral-sm}`) · the bar · a meta row of `n / N frames` · `elapsed` · `ETA`, all `{typography.code-inline}` in `{colors.muted}` · a one-line status sentence in `{typography.caption}`.
Existing and complete: `Lab.tsx:582`, `styles.css:1270-1278`.

**The rule that makes this worth documenting — `job-progress-measured` vs `job-progress-estimated`.**
A measured bar is filled `{colors.primary}`.
An estimated bar is filled with a 45° repeating stripe of `{colors.primary}` / `{colors.primary-soft}`, **caps at 95%**, and its status line says it is an estimate.
This is the progress-bar case of the §5.2 provenance rule: a percentage is a number, so it shows where it came from.
`Lab.tsx:169-183` and `Lab.tsx:582` already do all of this in behaviour; only the visual distinction is new.

**`job-cancel`** — `button-ghost` beside the bar. Currently the abort machinery exists (`Lab.tsx:406-408`, `AbortController`) with no user-facing control; note that as the gap it is.

**`job-failed`** — `refusal-banner` (§5.1) carrying the server's own message, plus a `button-secondary` "Retry".
Existing: `.lab-error-banner` with retry at `Lab.tsx:582`; the message already prefers `snapshot.message ?? snapshot.error ?? snapshot.detail` over a generic string (`Lab.tsx:442`), which is the right instinct and should be written down.

### 5.6 — New section: **Partial Results**

Placed immediately after "Long-Running Jobs". **This is the only genuinely net-new component in the extension.**

Amend `DESIGN.md:588` first — "A run / version / deployment is always exactly one of these five states" is now false for a suite, whose vocabulary is `complete` / `incomplete` / `failed` (`issues/06:135-137`).
Add a sixth to `colors:`:

```yaml
  status-partial: "{colors.warning}"
```

Amber, not green, because the governing rule is that an incomplete suite **must not be able to look like a clean one** (`issues/06-what-is-a-suite-run.md:139-141`).

**`pill-partial`** — `{colors.warning-soft}` background, `{colors.warning}` text, label `partial`. Same geometry as every other pill.

**`partial-summary`** — the headline block for an incomplete suite.
Anatomy:
- a **completion fraction, not a percentage** — `12/14 clips · 2 failed` in `{typography.metric-numeral}`, the exact string `issues/06:138` specifies. A percentage invites rounding to "86% done ≈ done"; a fraction does not.
- a segmented bar: succeeded `{colors.success}` · failed `{colors.danger}` · pending `{colors.hairline}`, on a `progress-track`
- **the headline number is suppressed unless `status = 'complete'`**, replaced by `micro-uppercase` text reading `INCOMPLETE — 1 clip failed, 1 pending`
- the failed clips reachable **in one click** (`issues/06:139`), each with its `error` string

The suppression is the load-bearing decision, and it is now settled rather than proposed: *"the aggregate number is not rendered at all unless `status = 'complete'`"* (`issues/06:137-138`).
It is the design-system expression of the parent `CLAUDE.md` rule that an unclean finalization state is not a result — and it is the same fail-closed instinct as `reportable default false` (`issues/02:158-160`).

**`suite-headline`** — the *complete* case, for contrast, so the two can never be confused.
Per `issues/06:143-148` the headline is **total counted vs total expected** in `{typography.metric-numeral}`, with the per-clip accuracy distribution beside it, "so a suite that is right on aggregate while being wrong on both tails cannot hide".
When totals and per-clip mean disagree beyond a threshold, the block **says so rather than picking a winner** — which is a `warning-banner` (§5.1), not a footnote.
It carries a `provenance-strip` (§5.2) like every other number.

**`partial-row`** — a `diff-row` (§5.3) whose candidate cell is empty, carrying `pill-partial` or `pill-failed` plus the reason instead of a number.
Never a dash, never a zero — a zero count and a clip that failed to decode must not render the same way.

### 5.7 — Amendments to existing sections (no new components)

- **Do's and Don'ts** (`DESIGN.md:886-908`) — add four lines, phrased in the existing voice:
  - *Do refuse with a reason and name the mechanism. Never warn and proceed.*
  - *Do put a `provenance-strip` under every measured number — which clip, which artifact — visible without a click.*
  - *Don't show an aggregate over an incomplete set. Suppress the headline and show the fraction.*
  - *Don't let a research surface invent its own palette. Density comes from spacing and type, not from a second colour system.*
- **Status colours** (`DESIGN.md:587-593`) — add `partial`; state that deployment state is a **separate** pill family from run state, which retroactively legalises `.pill-active` / `.pill-production` (§4.5).
- **Known Gaps** (`DESIGN.md:947-957`) — strike gaps 1 and 4 (closed, §2), rewrite gap 2 to point at the new `motion:` block, leave gap 8 (skeletons) open and note the five ad-hoc loading strings.
- **Top nav** (`DESIGN.md:715`, `:918`) — five sections, not four (§4.8).

### 5.8 — What I would deliberately NOT add

- **No dark theme.** The Lab's density is achievable on white with tighter spacing and the existing `surface-card` / `surface-card-strong` steps. Adding a documented dark theme legitimises §4.1 and doubles every future component.
- **No new radius or spacing values.** Every measurement in §5.1-5.6 uses the existing scales.
- **No skeleton component in this pass.** It is Known Gap 8, it is real, and it is orthogonal to the Lab — bundling it makes this extension harder to review.
- **No suite *launch* / queue surface.** `issues/06:126-132` settles execution as a claimable queue of `pending` evaluation rows, workable by more than one machine. That surface needs its own design pass and is orthogonal to the six sections above.
- **No automation-B matrix surface.** `issues/06:170-179` explicitly defers B and C; designing screens for them now is designing for something deliberately not built.

---

## 6. What blocks the plan

**Nothing blocks writing the six `DESIGN.md` sections.** Every decision they depend on is now settled. Four things block *implementation*:

1. **`provenance-strip` cannot be populated yet.** Today the Lab knows the artifact only as a registry row id or a browser `File` (`Lab.tsx:203-205`, `Lab.tsx:245`), and attaches the video as a bare `File` with no clip identity (`Lab.tsx:244`). The `evaluations` / `clips` migration landed mid-session (`supabase/migrations/20260907100010_evaluations_and_clips.sql`, untracked at time of writing) but nothing in `apps/web/src/` reads it — I verified no `.tsx` references `evaluations`. The component can be **specified** now; it cannot be **filled** until the Lab writes and reads those rows.
2. **A restyle of `Lab.tsx` is a large mechanical diff.** `styles.css:1059-1335` is ~277 lines of Lab-only CSS, much of it minified onto single 3-8kB lines (`styles.css:1077`, `:1078`, `:1082`). Re-tokenising it is not a surgical edit and should be its own ticket, separate from writing the `DESIGN.md` sections.
3. **`delta-value` currently infers "better" from sign** (`Lab.tsx:587`). §5.3 says direction must be declared per metric. That is a behaviour change in shipped code, not a style change — needs its own decision.
4. **The two mandatory comparison refusals do not exist in code.** `issues/06:153-158` requires the compare view to refuse across differing `config_hash` and `artifact_kind`; `compareRunManifests` (`labApi.ts:276`) as rendered at `Lab.tsx:587` compares whatever two manifests it is handed and reports changed config keys as *information*, not as a refusal. §5.1 + §5.3 must be built before the comparison view can meet its own spec.

---

## Suspected, unverified

- I did **not** open `issues/03-what-is-a-scenario-clip.md`, `issues/01`, `05`, `07`, `08`, `09`, or `map.md`. Statements about clips rest only on the references to clip records inside `issues/02` and `issues/06`.
- I did **not** open `supabase/migrations/20260907100010_evaluations_and_clips.sql` (21.5K, written by a parallel agent mid-session). Column names I quote come from the SQL blocks inside `issues/02` and `issues/06`, which may differ from what actually shipped in the migration. Anyone implementing §5.2 or §5.6 should read the migration, not this note.
- `issues/06` was read **twice** — once at `Status: open` and once after commit `000f216` flipped it to `Status: resolved`. All citations are to the resolved version; the line numbers were re-checked against it.
- I did **not** run the app or take a screenshot. Every visual claim is read from source, not observed. In particular I have not verified how the Lab's `margin:-16px` (`styles.css:1062`) actually meets the white app shell at the seam.
- I read `labApi.ts` only via its export list and the call sites in `Lab.tsx`. The internals of `compareRunManifests` (`labApi.ts:276`) are unread; I describe only what `Lab.tsx:587` renders from its return value.
- `Models.tsx` was read only from line 300 to the end (466). Contradictions in lines 1-299 may exist and are not reported.
- `Storage.tsx` was read only from line 60 to 140. Same caveat.
- `NewRun.tsx` (407 lines, the pre-v3 form), `RunDetail.tsx`, `DatasetUploader.tsx`, `ColabSteps.tsx`, `Auth.tsx`, `Toast.tsx`, `ConfirmModal.tsx` were **not** read. `NewRun.tsx` in particular is still imported nowhere I checked — `Train.tsx:2` imports only `NewRunV3` — so it may be dead code, but I did not verify that and did not touch it.
- `styles.css` lines 1-340 and 464-1058 were read only in the excerpts quoted above. There are almost certainly further token drifts in the unread ranges.
- (Resolved during writing: the `--lab-magenta` / `--lab-yellow` dead-token claim was re-checked against the full stylesheet and all `.tsx` files — one occurrence each, the declaration itself.)
