# 08 — Replay rebuild spec: the instrument on the system's theme

Phase 1 of "ทำ Lab ใหม่ด้วยธีมและ UI style ของเราแต่ล้อ engine มาจากเดิม".
Design only — no code was changed to write this.

**What is being rebuilt:** the visual language of `apps/web/src/sections/Lab.tsx` (649 lines, not the 596 the review counted — it grew), and the ~196 lines of Lab-only CSS in `apps/web/src/styles.css`.
**What is being carried over verbatim:** `apps/web/src/lib/labApi.ts`, `apps/api/lab_server.py`, `webui/lab_core.py`, and every behaviour `Lab.tsx` invented.

**The rule that decides every judgement call**, from `.scratch/experiment-lab/issues/04-design-system.md:56-67`:
`DESIGN.md` wins on palette; the Lab wins on density and on every behaviour it invented.
A research surface earns its density; it does not earn its own colour language.

**Baseline measured before writing this** (`cd apps/web && npm run build && npm test`):
build clean in 848 ms, 1831 modules, `dist/assets/index-Ciyt38V2.css` 71.76 kB; 12 test files, 115 tests passed.
That is the number the rebuild has to still produce.

**Two hard constraints on the rebuild that are easy to miss.**
`apps/web/src/sections/Lab.defaults.test.ts:16` imports `DEFAULT_CFG` **and** `matchDistancePx` from `./Lab`, so both exports must survive at that path even though the Match-threshold *control* is being dropped — the test is the record of why it is being dropped (`Lab.defaults.test.ts:53-57`, inert across 0.5→1.0).
`apps/web/src/App.routing.test.tsx:17` pins the section keys `["lab","models","overview","storage","train"]`, so the route stays `/lab` and the nav label stays `Lab`; the `Replay` / `Suites` split of the IA is a later step, not this one.

---

## 1. The affordance inventory

Every interactive or informational affordance in the current file, with the line it lives on.
Several lines are 2–6 kB each — `Lab.tsx:639` is 5,830 characters, `:644` is 4,176, `:634` is 4,147 — which is finding 6 of `docs/web-review.md` and is why the citations below repeat.
Column 3 is the `DESIGN.md` component it becomes; column 4 is the behaviour that must not change while it is re-skinned.

### 1.1 Shell, header, backend state

| # | Affordance | Where | Becomes | Behaviour to preserve |
|---|---|---|---|---|
| 1 | Section shell (dark repaint of the viewport) | `Lab.tsx:617`, `styles.css:1076` | plain section content inside `.section-main`; **the shell goes away entirely** | none — see §3.1 |
| 2 | Mode kicker `RESEARCH CONTROL ROOM / V1 COUNTING` vs `V0 DETECTION` | `Lab.tsx:618` | `caption-uppercase` eyebrow + `chip` carrying `v1`/`v0` | derived from `hasSummary` (`:591`), not from a flag |
| 3 | Title `Lab Replay` + flask icon | `Lab.tsx:618` | `display-sm` heading (panels are `title-lg`; see DESIGN.md:1060) | — |
| 4 | Backend status dot: up / down / checking | `Lab.tsx:164`, `:618` | `pill-success` / `pill-danger` / `pill-muted` | three states, never two — `null` means "not asked yet" |
| 5 | Event-stream chip `N events` / `no event stream` | `Lab.tsx:618` | `chip` | absent `events` and empty `events` read differently |
| 6 | Backend-unavailable banner naming the command and port | `Lab.tsx:619` | `refusal-banner` (DESIGN.md:816) | the sentence names the mechanism: `python apps/api/lab_server.py` on 8077 |
| 7 | `Retry connection` (full reload) | `Lab.tsx:619` | `button-secondary` inside the banner | — |

### 1.2 Durable tasks

| # | Affordance | Where | Becomes | Behaviour to preserve |
|---|---|---|---|---|
| 8 | Saved-task `<select>` | `Lab.tsx:620`, loader `:261-270` | `select` (dense) | selecting loads config **and** zones **and** refreshes run history |
| 9 | `New Task` toggle | `Lab.tsx:620` | `button-secondary` | — |
| 10 | `Save task` | `Lab.tsx:620`, `:281-293` | `button-primary` | writes `{cfg, exclusion_zones, source{filename,width,height,fps}, model{identifier,filename}}` |
| 11 | Task-active state + reattach warning + `task_id` | `Lab.tsx:620` | `provenance-block` (DESIGN.md:855) | the warning that browser Files are **not** persisted must stay visible |
| 12 | Task error / status messages | `Lab.tsx:620` | `refusal-banner` / `callout-info` with `role="status"` | — |
| 13 | New-task form: name (required, autofocus), description, Create / Cancel | `Lab.tsx:620`, `:271-280` | `label` + `text-input` + `textarea` + `modal-actions`-style row | submit disabled until `taskName.trim()` |

### 1.3 Control rail — 8 collapsible sections

Rail state is `Lab.tsx:190` (sections 1, 2 and 4 open by default), header `:33-38`, toggle `:527`.

**Section 1 · Input/Session — `Lab.tsx:623`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 14 | Video dropzone (`accept="video/*"`) | `text-input`-family file control on `surface-soft`, 1px dashed `hairline` | `selectVideo` (`:386-389`) resets zones, line, result, errors, draw mode |
| 15 | `READY` / `EMPTY` + filename row | `pill-success` / `pill-muted` + `code-inline`, left-truncating | — |
| 16 | Frame start | `text-input` (dense), `type=number` | `?? 0` display, not `0` in the config |
| 17 | Frame end | `text-input` (dense) | empty string → `undefined`, never `0` |
| 18 | Frame stride slider 1–10 + live value + Hint | `label` + range + `metric-numeral-sm` | value readout beside the label |
| 19 | GT target (optional) + Hint | `text-input` (dense) | `""` → `undefined`; floors and clamps ≥ 0 |
| 20 | Tolerance % (optional) + Hint | `text-input` (dense) | stored as a fraction, displayed ×100 |
| 21 | Note: GT is a human count; nothing is assumed when blank | `hint` copy, verbatim | copy rule (DESIGN.md:826) |
| 22 | `Reset deployed defaults` | `button-secondary` | resets to `DEFAULT_CFG` **and** clears GT + tolerance |
| 23 | Note: source state is local-only until Run Replay | `hint` copy, verbatim | — |

**Section 2 · Detection — `Lab.tsx:624`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 24 | Model-mode tabs `registry` / `local` / `legacy` | `sub-tabs` (existing app component, `styles.css:544-568`) | `legacy` appears only when `legacyModels.length`; switching to `registry` clears `localModel` |
| 25 | Registry version `<select>` | `select` (dense) | only versions with `artifacts.pytorch.key` are listed (`:354`) |
| 26 | Artifact-key note / "choose a version" note | `provenance-block` row | shows the R2 key, which is the only artifact identity this surface has |
| 27 | `Fetch model` + streamed `%` | `button-secondary` + `job-progress-measured` | streams via `content-length`, falls back to `size_bytes` (`:437`) |
| 28 | Registry-unavailable message | `warning-banner` | names the fallback: local `.pt` or legacy |
| 29 | Local `.pt` file input + `.pt` validation | file control + `field-error-text` | rejects non-`.pt` with the existing sentence |
| 30 | Legacy model `<select>` | `select` (dense) | shows `basename`, sends the full path |
| 31 | `localModel … ready` row | `pill-success` + `code-inline` | — |
| 32 | Prefilter confidence 0.05–0.95 + Hint | `label` + range + `metric-numeral-sm` | 2-dp readout |
| 33 | NMS-IoU 0.1–0.95 + Hint + "baked on HEF" note | same + `hint` | the HEF caveat is copy that must survive |
| 34 | Class checkboxes `person` / `sack` | `label` + checkbox pair | `toggleClass` (`:526`) preserves order-insensitivity |

**Section 3 · Tracker — `Lab.tsx:626`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 35 | Capability state `TRACKER WIRED` / `TRACKER CAPABILITY REQUIRED` | `pill-success` / `pill-muted` | reads `capability("tracker")` (`:571-577`) |
| 36 | Tracker `<select>` — one option, `centroid` | `select` (dense), `disabled` when capability is false | the Hint explaining it is **not** ByteTrack stays verbatim; `webui/lab_core.py:65` is the source of that claim |
| 37 | Track buffer, clamped 1–300 | `text-input` (dense) | clamping happens on change, not on submit |
| 38 | Match threshold + derived `effective match distance N px` + inert warning | **dropped** — see §3.2 | `matchDistancePx` (`:53-59`) stays exported for the test |
| 39 | `DisabledField` wrapper (opacity 0.45) | native `disabled` + `locked-panel` for the whole section body | opacity stops being the hierarchy device (DESIGN.md:902) |

**Section 4 · Line/Geometry — `Lab.tsx:627`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 40 | Line status `canonical line ready` / `no count line` + `frame_ref 0` | `provenance-block` two-column row | the frame anchor is on screen (DESIGN.md:943) |
| 41 | `Draw canonical count line` | `button-secondary` (was cyan) | sets `drawMode="line"`, clears draft points |
| 42 | `Clear line` | `button-ghost` | `clearLine` (`:426`) clears draft too |
| 43 | In/Out flip checkbox | `label` + checkbox | writes `cfg.inflip` **and** `cfg.line.inflip` — two places, one click |
| 44 | `Add exclusion zone` + Hint | `button-secondary` (was amber) | — |
| 45 | `Commit zone (N pts)` | `button-primary` | refuses under 3 points with the existing sentence (`:422`) |
| 46 | Per-zone enable checkbox | `label` + checkbox | `toggleZone` (`:427`) writes both `zones` and `cfg.exclusion_zones` |
| 47 | Per-zone delete | `button-icon` in `danger` register, `aria-label` intact | `deleteZone` (`:428`) |
| 48 | Note: all geometry is pixel-space anchored to frame 0 | `hint` copy, verbatim | — |

**Section 5 · Counting/Dedup — `Lab.tsx:628`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 49 | `COUNTING CONTRACT` label | `caption-uppercase` (11px/600, not 9px cyan) | — |
| 50 | Conf split, ROI dedup radius, ROI dedup frames, Count cooldown — 4 inputs + 4 Hints | `text-input` (dense) in a 2×2 `field-row` | every clamp range stays exactly as written |
| 51 | Note: counts appear only when the backend returns `result.summary` | `hint` copy, verbatim | — |

**Section 6 · Occlusion-Recovery — `Lab.tsx:629`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 52 | Capability state `HEALER WIRED` / `CAPABILITIES LIMITED` | `pill-success` / `pill-muted` | — |
| 53 | Capability notice naming `healer` **and** `optical_flow` reasons | `locked-panel` (DESIGN.md:820) | both reasons, from `capabilityReason` (`:578-585`); `apps/api/lab_server.py:603,605` returns both as `false` |

**Section 7 · Scorer — `Lab.tsx:630`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 54 | Capability state, 3 variants (`SCORER OUTPUT` / `SCORER CAPABILITY · NO OUTPUT` / `SCORER NOT WIRED`) | `pill-success` / `pill-warning` / `pill-muted` | three states, not two |
| 55 | Scorer mode badge `FUSED` / `PASSTHROUGH` | `chip` (machine value, `code-inline`) | never a status pill — it is not a status |
| 56 | Locked state with its two-sentence reason | `locked-panel` | reason logic at `:609-613` unchanged |
| 57 | `MODE` / `CONFIG` / `FEATURES` read-out | `provenance-block` ×3 | read-only, backend-owned; the note saying so stays |

**Section 8 · Output/Export — `Lab.tsx:631`**

| # | Affordance | Becomes | Preserve |
|---|---|---|---|
| 58 | `Download overlay` (opens `result.video_url`) | `button-secondary` | disabled without a result |
| 59 | `Download config JSON` | `button-secondary` | `downloadConfig` (`:535`) merges trail keys only when supported |
| 60 | `Count CSV (events only)` | `button-secondary` | `downloadEventsCsv` (`:546-569`); the cell-count comment at `:561-563` must stay attached to the row builder |
| 61 | Trail display: checkbox + length slider **or** locked panel | **dropped** — see §3.3 | — |

### 1.4 Centre column — the viewer

| # | Affordance | Where | Becomes | Preserve |
|---|---|---|---|---|
| 62 | Viewer head: `REPLAY VIEWER` eyebrow + source filename | `Lab.tsx:634` | `caption-uppercase` + `title-md`, still truncating | — |
| 63 | HUD: `W × H`, `frame 0`, `N fps` | `Lab.tsx:634` | `video-hud` — **addition A5** | fps comes from the backend result (`:504`), never from `<video>` |
| 64 | 16:9 video well, `object-fit: contain` | `Lab.tsx:634`, `styles.css:1092` | `video-surface` (DESIGN.md:931) — the one legitimate dark surface | letterbox bars stay the same colour as the well |
| 65 | `<video controls>` + `onLoadedMetadata` | `Lab.tsx:634`, `:390-394` | unchanged element inside `video-surface` | sets `videoSize` and `cfg.video_width/height`; error sets `editorError` |
| 66 | Canvas overlay, click → source pixel | `Lab.tsx:634`, `:395-420` | `overlay-line` / `overlay-zone` / `overlay-draft` | the whole letterbox mapping (`:400-415`) is carried unchanged |
| 67 | Letterbox-click refusal sentence | `Lab.tsx:408-411` | `refusal-banner`; DESIGN.md:942 quotes this exact sentence | verbatim |
| 68 | Canvas paint effect: zones, draft, committed line | `Lab.tsx:368-384` | same geometry, token colours read via `getComputedStyle` | stroke width `max(2, W/500)`, handle radius `max(4, W/160)` — resolution-scaled, per DESIGN.md:933 |
| 69 | Zone enabled vs disabled colouring | `Lab.tsx:381` | `overlay-zone` at 20% vs `muted` at 12% (DESIGN.md:935) | — |
| 70 | `drawMode` cursor + pointer-events toggle | `styles.css:1092` (`canvas.drawing`) | unchanged | canvas is click-through unless drawing |
| 71 | Editor-error banner | `Lab.tsx:634` | `refusal-banner` | — |
| 72 | Tool card `Draw Count Line` (`2 points · frame 0`) | `Lab.tsx:634` | `button-secondary` with selected state = `version-card-selected` register | duplicate of #41 by design — both entry points stay |
| 73 | Tool card `Add Exclusion Zone` (`polygon editor`) | `Lab.tsx:634` | same | duplicate of #44 |
| 74 | Tool card `In–Out Flip` (`flipped` / `normal`) | `Lab.tsx:634` | same | writes both places, like #43 |
| 75 | Tool card `Mid-Clip Switch` (permanently disabled) | `Lab.tsx:634` | **dropped** — see §3.4 | — |
| 76 | Timeline strip (`00:00`, a 3% bar, duration) | `Lab.tsx:634` | **dropped except the duration** — see §3.5 | — |
| 77 | `Run Replay` primary action | `Lab.tsx:634` | `button-primary` — **azure, not green** | disabled logic and reason string from `runDisabledReason` (`:248`) |
| 78 | Run hint sentence (4 distinct reasons) | `Lab.tsx:248`, `:634` | `hint`, or `button-primary-blocked` register when blocked | all four reasons, verbatim |
| 79 | Replay progress block: mode label, %, bar, `n / N frames`, elapsed, ETA, status sentence | `Lab.tsx:634`, `:198-226` | `job-progress` + `job-progress-measured` / `job-progress-estimated` (DESIGN.md:955-959) | server mode = solid fill; estimate mode = 45° stripe, capped at 95%, and **says** it is an estimate |
| 80 | `role="status" aria-live="polite"` on the progress block | `Lab.tsx:634` | unchanged | — |
| 81 | Run error banner + `Retry replay` | `Lab.tsx:634` | `job-failed` (DESIGN.md:963) | carries the server's own message, never a generic string |

### 1.5 Right column — the inspector

| # | Affordance | Where | Becomes | Preserve |
|---|---|---|---|---|
| 82 | `OUTPUT PREVIEW` card + `READY` marker | `Lab.tsx:636` | `panel-dense` + `caption-uppercase` + `pill-success` | — |
| 83 | Result video player | `Lab.tsx:636` | `video-surface` (compact) | — |
| 84 | 3 stats: frames, max sacks/frame, avg sacks/frame | `Lab.tsx:570`, `:636` | **`kpi-card-sourced`** ×3 (DESIGN.md:853 — a bare `kpi-card` is not permitted in the Lab) | see §2.2 for what fills the strip |
| 85 | `Download overlay.mp4` link | `Lab.tsx:636` | `text-link` with `Download` icon | — |
| 86 | Empty state for the preview | `Lab.tsx:636` | `empty-state` | gives the next action, per DESIGN.md:1028 |
| 87 | `REPRODUCIBILITY` card + `MANIFEST READY` / `BACKEND FIELD REQUIRED` | `Lab.tsx:637` | `panel-dense` + `pill-success` / `pill-muted` | `manifestReady` needs `run_id` **and** `schema_version` **and** a config snapshot (`:594`) |
| 88 | `run ID` / `schema` / `config snapshot AVAILABLE\|NOT RETURNED` | `Lab.tsx:637` | `provenance-block` | — |
| 89 | `Export reproducible manifest JSON` | `Lab.tsx:637`, `:536-545` | `button-secondary` | filename `lab-run-{run_id}.manifest.json` |
| 90 | Locked text: the browser does not synthesize a manifest | `Lab.tsx:637` | `locked-panel` | verbatim |
| 91 | `RUN HISTORY` card + `LOADING` / `N SAVED` / `N THIS SESSION` / `EMPTY` | `Lab.tsx:638` | `panel-dense` + `pill-*` | `THIS SESSION` when `persistent === false`; `apps/api/lab_server.py:769` is where that comes from |
| 92 | Non-persistent notice | `Lab.tsx:638` | `warning-banner` | the sentence about run ids with nothing behind them stays verbatim |
| 93 | History error state | `Lab.tsx:638` | `locked-panel` | "No local history is shown" — no substitution |
| 94 | Last 5 runs: `run_id`, `schema_version`, `created_at` | `Lab.tsx:638` | `data-table-row-dense` ×N | slice(0,5) stays |
| 95 | `A/B EVENT + CONFIG COMPARE` card + 4-state chip | `Lab.tsx:639` | `panel-dense` + `compare-header` (DESIGN.md:887) | `LOADING` / `LOCKED` / `READY` / `2 RUNS REQUIRED` |
| 96 | Baseline + Current `<select>`s | `Lab.tsx:639`, defaults `:310-318` | `select` (dense) inside `compare-header` | defaults to runs[0] vs runs[1] |
| 97 | Both run ids named at the top | `Lab.tsx:639` | `compare-header`'s two stacked strips | never a delta without both sides named |
| 98 | `EVENT-LEVEL DIFF · PRIMARY` | `Lab.tsx:639` | `title-sm` heading + `diff-row`s | primacy expressed by type + order, not opacity (DESIGN.md:902) |
| 99 | Event-diff locked state (`event_records[]` required) | `Lab.tsx:639` | `locked-panel` | identity is never inferred from aggregates |
| 100 | added / removed / changed counts | `Lab.tsx:639` | `metric-numeral-sm` ×3 | — |
| 101 | `ADDED IDS` / `REMOVED IDS` lists | `Lab.tsx:639` | `chip` rows | removed ids read in `danger`; added in `success` |
| 102 | Changed-event cards: id, changed fields, baseline vs current line, decision provenance | `Lab.tsx:639` | `diff-row` + `provenance-block` | every field name from `compareRunManifests` (`labApi.ts:269-283`) |
| 103 | "No event-level differences" note | `Lab.tsx:639` | `hint` copy | — |
| 104 | `AGGREGATE METRIC DELTAS · SECONDARY` | `Lab.tsx:639` | `delta-value` in a `caption`-tier block | **the sign no longer picks a colour** — see §3.6 |
| 105 | `CHANGED CONFIG KEYS` | `Lab.tsx:639` | `chip` row | — |
| 106 | `REPLAY CONFIG`: `Load baseline config` / `Load current config` + its note | `Lab.tsx:639`, `:528-534` | `button-secondary` ×2 | `replayConfigFromManifest` only; never touches the model, never runs |
| 107 | `COUNT SUMMARY` card + `BACKEND SUMMARY` / `SUMMARY REQUIRED` | `Lab.tsx:640` | `panel-dense` | — |
| 108 | 6 summary values: confirmed, flagged, dropped, recovered, excluded, total | `Lab.tsx:640` | `kpi-card-sourced` grid; `total` is the one `metric-numeral` (28px), the rest `metric-numeral-sm` | `dropped` stays — it is counted into `total` (`labApi.ts:158-160`) |
| 109 | GT target + error-vs-GT values | `Lab.tsx:640` | `kpi-card-sourced` | rendered only when non-null |
| 110 | Tolerance row + `WITHIN` / `OVER` / `UNDER` / unknown | `Lab.tsx:640` | `pill-success` / `pill-warning` / `pill-warning` / `pill-muted` | unknown is muted, never green |
| 111 | Empty/locked summary text (2 variants) | `Lab.tsx:640` | `locked-panel` | "counts are not estimated from detection frames" |
| 112 | `DETECTION DIAGNOSTICS` card + `BACKEND OUTPUT` / `LOCKED` | `Lab.tsx:641` | `panel-dense` | reads `detection_diagnostics`, **not** `diagnostics` (`labApi.ts:393-399`) |
| 113 | Disclaimer: detector diagnostics are not accuracy metrics | `Lab.tsx:641` | `warning-banner` | verbatim |
| 114 | 3 diagnostic metrics | `Lab.tsx:641` | `kpi-card-sourced` ×3 | — |
| 115 | `DETECTIONS BY CLASS` list | `Lab.tsx:641` | `data-table-row-dense` | empty case says the backend returned none |
| 116 | `CONFIDENCE HISTOGRAM` bins | `Lab.tsx:641` | horizontal bar rows on `progress-track` geometry, `chart-primary` fill — **addition A6b** | bin label is `lower–upper` from `confidenceBinLabel` (`:74`) |
| 117 | Diagnostics locked state (2 sentences) | `Lab.tsx:641` | `locked-panel` | — |
| 118 | `PATH PROVENANCE` card | `Lab.tsx:642` | `panel-dense` | — |
| 119 | track-paths count / events-with-slices count | `Lab.tsx:642` | `metric-numeral-sm` ×2 | — |
| 120 | First 3 path events: points, predictor, displacement | `Lab.tsx:642` | `provenance-block` | `predictorLabel` (`:96-104`) formatting unchanged |
| 121 | Empty text: the UI never builds paths from crossing events | `Lab.tsx:642` | `locked-panel` | verbatim |
| 122 | `PER-CROSSING DETAILS` table, 8 columns | `Lab.tsx:643` | `data-table` with `data-table-row-dense` | horizontal scroll stays inside its own container |
| 123 | Row selection by click | `Lab.tsx:643` | `data-table-row` selected = `version-card-selected` register + 3px `primary` inset marker | — |
| 124 | Row selection by keyboard (Enter / Space), `tabIndex`, `aria-selected` | `Lab.tsx:643` | unchanged | this is the accessibility floor, not decoration |
| 125 | Event status badge: confirmed / flagged / excluded | `Lab.tsx:643`, `:614` | `pill-verdict-*` — **addition A7** | — |
| 126 | `RECOVERED` marker | `Lab.tsx:643` | `pill-info` | `—` when not recovered |
| 127 | Two empty states (detection-only run vs no `events[]`) | `Lab.tsx:643` | `locked-panel` ×2 | they are different sentences and must stay different |
| 128 | `CROSSING INSPECTOR` card + `EVENT N` / `SELECT A ROW` | `Lab.tsx:644` | `panel-dense` | auto-selection effect at `:236-243` |
| 129 | 7-field detail grid | `Lab.tsx:644` | `provenance-block` | status colouring per #125 |
| 130 | `DECISION PROVENANCE` + its note about dedup/cooldown | `Lab.tsx:644` | `provenance-block` + `hint` | that note is the best sentence in the file — verbatim |
| 131 | raw conf / exclusion hit / recovered / reason | `Lab.tsx:644` | `provenance-block` | `—` for absent, never `0` |
| 132 | `GEOMETRY`: centroid, line, zone | `Lab.tsx:644` | `provenance-block` | `safePoint` / `safeLine` (`:80-87`) |
| 133 | `PATH PROVENANCE` per-event + per-point list | `Lab.tsx:644` | `provenance-block` + scrollable `code` list | max-height + overflow stays |
| 134 | Per-event `SCORER BREAKDOWN` + verdict | `Lab.tsx:644` | `provenance-block` + `pill-verdict-*` | — |
| 135 | Two per-block locked states inside the inspector | `Lab.tsx:644` | `locked-panel` (compact) | — |
| 136 | `SCORER BREAKDOWN` card, per scored event | `Lab.tsx:645` | `panel-dense` + `diff-row`-style rows | "no score is inferred from confidence, status, or paths" |

### 1.6 Cross-cutting behaviours — not visible as controls, and easiest to lose

| # | Behaviour | Where | Note |
|---|---|---|---|
| 137 | Capability negotiation: health → result → `unsupported_capabilities` → a fallback sentence | `Lab.tsx:571-585` | four-step fallback; the last step still names the capability |
| 138 | Async job loop: start → poll with 500 ms × 1.5 backoff capped at 4 s, 240 polls | `Lab.tsx:464-493` | timeout message tells the operator to retry |
| 139 | Legacy sync fallback on `LabJobEndpointUnavailable` | `Lab.tsx:494-499` | switches the progress bar to estimate mode — the two modes exist because of this branch |
| 140 | `AbortController` per run, aborted on unmount and on re-run | `Lab.tsx:228-234`, `:452-455` | `AbortError` is swallowed, not shown as a failure (`:513`) |
| 141 | Elapsed is always client-measured; ETA extrapolated only once progress > 0 | `Lab.tsx:198-226` | the comment at `:205-209` records the bug this fixed |
| 142 | fps taken from the result, not the element | `Lab.tsx:502-504` | — |
| 143 | Task refresh after a run, failure tolerated | `Lab.tsx:505-510` | "the result remains truthful even if task refresh is unavailable" |
| 144 | 13 `Hint` texts and 21 explanatory notes | `Lab.tsx:623,624,626,627,628,629,630,631,634,639,641,644,645` | copy rule: authored once, rendered verbatim (DESIGN.md:826) |
| 145 | `prefers-reduced-motion` block | `styles.css:1198`, `:1293` | must survive the CSS rewrite |
| 146 | Focus-visible on every control | `styles.css:1196` | 2px cyan outline becomes the system's 3px azure `focus-ring` |

---

## 2. Component and token mapping

### 2.1 The palette swap, token by token

Twelve private tokens on `styles.css:1076`, and what each becomes.
None of the twelve survives.

| Private token | Used for | Becomes |
|---|---|---|
| `--lab-bg` `#080d16` | the whole viewport | nothing — the page is `--color-surface-soft`, already the app shell's floor (`styles.css:37`) |
| `--lab-panel` `#0d1522` | every card | `--color-canvas` + `--elev-hairline` |
| `--lab-panel-2` `#111c2b` | nested value blocks | `--color-surface-card` |
| `--lab-border` `#223044` | every border | `--color-hairline`, `--color-hairline-soft` for row dividers |
| `--lab-text` `#e8eef7` | body text | `--color-ink` (titles), `--color-body-strong` (values) |
| `--lab-muted` `#8291a6` | labels, captions | `--color-muted` |
| `--lab-cyan` `#4de1ff` | eyebrows, labels, active state, links, count line | `--color-primary` / `--color-primary-active` for interactive; `--color-muted` for labels; `--color-overlay-line` on the canvas |
| `--lab-green` `#49e58b` | the primary CTA, `READY`, `confirmed` | CTA → `--color-primary` (azure); the rest → `--color-success` |
| `--lab-amber` `#ffc44d` | capability states, locked labels, flagged, warnings | `--color-warning`; **locked labels go to `--color-muted`, because locked is not a warning** |
| `--lab-red` `#ff4d5f` | errors, zones, excluded | `--color-danger` for refusals and errors; `--color-overlay-zone` on the canvas; `--color-muted` for `excluded` events |
| `--lab-magenta` `#f06cff` | nothing | deleted — one declaration, zero uses |
| `--lab-yellow` `#ffd45c` | nothing | deleted — one declaration, zero uses |

Three token groups are named in `DESIGN.md`'s front matter and **do not exist in code**; the rebuild must add them to `apps/web/src/styles/tokens.css` before it can honour the palette:

- `--color-source-set` / `--color-source-default` / `--color-source-derived` — `DESIGN.md:50-52`, absent from `tokens.css:8-130`.
- `--color-overlay-line` / `--color-overlay-zone` / `--color-overlay-draft` — `DESIGN.md:56-58`, absent.
- `--color-status-partial` — `DESIGN.md:44`, absent; and `styles.css:368-380` has no `.pill-partial` to go with it.

Canvas drawing needs literal colour strings, which is the one place `never inline hex` is awkward.
Resolve it by reading the tokens once per paint with `getComputedStyle(document.documentElement).getPropertyValue("--color-overlay-zone")`, not by hard-coding `#ef4444`.

### 2.2 What fills the `provenance-strip` on this surface

`DESIGN.md:853` makes `kpi-card-sourced` mandatory in the Lab and forbids a bare `kpi-card`.
`research/04-design-system-gaps.md` §6.1 says the strip cannot be populated, because the Lab knows the video only as a browser `File` and the model as a registry row id or a `File`.
Both are true, and the resolution is fail-closed rather than either fabricating or omitting:

| Strip element | Source available today | Rendered as |
|---|---|---|
| artifact chip | `selectedRegistry.semver` (registry) · `localModel.name` (local) · `legacyModel` basename (legacy) — `Lab.tsx:246`, `:288` | `chip`, e.g. `v1.4.2 · pt`; the kind is always `pt`, because `webui/lab_core.py` runs ultralytics |
| clip name | `video.name` (`Lab.tsx:287`) | `caption`, truncating from the left |
| frame range | `cfg.frame_start` / `cfg.frame_end` | `code-inline`, **only when either is set** — so a range on screen always means "not the whole clip" |
| reportable | nothing writes `evaluations`; no `clip_id`; no provenance block on the manifest | `pill-warning` **`unverified`**, with the reason in its `title`: *"no clip identity — the source is a browser file, not a registered clip"* |

This is the project's own rule applied to a UI: a missing provenance block is treated as unverified (`CLAUDE.md`, Experiment Discipline).
The pill turns `reportable` only when the Lab writes evaluation rows, which is build steps 3–6 of the map.

### 2.3 Where `DESIGN.md` has no component — the smallest additions

Named explicitly rather than invented quietly.
All of them reuse existing colour, radius, spacing and type tokens; none adds a value to a scale.

- **A1 · `panel-dense`.** `panel` with padding `{spacing.sm}` (12px) instead of `{spacing.lg}` (20px) and a `caption-uppercase` eyebrow instead of a `title-lg` heading. This is the density the review grants, and it is the only reason a three-column inspector fits.
- **A2 · `control-dense`.** `text-input` / `select` / `button-secondary` at height **32px** with padding `{spacing.xxs} {spacing.xs}` and `{typography.body-sm}` (13px). 32px is not a new value: it is already `{component.button-icon}.size` (`DESIGN.md:265`) and `{component.notification-bell}.size` (`:516`). It replaces the Lab's undocumented 30px (`styles.css:1089`).
- **A3 · `data-table-row-dense`.** `data-table-row` with padding `{spacing.xxs} {spacing.xs}` (4px / 8px) and `{typography.code-inline}` (12px mono) for numeric cells. The documented row is 10×12px (`DESIGN.md:877`), which costs roughly 40% more height on a 30-row crossing table.
- **A4 · `rail-section`.** A numbered disclosure: `panel-dense` + native `<details>`/`<summary>` + a `chip` carrying the section number. `DESIGN.md` documents no accordion at all. Native `<details>` gets keyboard behaviour, `aria-expanded` semantics and the default-open set (`<details open>`) for free, which is why it replaces the `sections` state array (`Lab.tsx:190`) rather than being styled on top of it.
- **A5 · `video-hud`.** One line of `code-inline` in `{colors.muted}` above the well: source dimensions · the frame the geometry is anchored to · the measured fps. `DESIGN.md:943` requires the frame anchor to be on screen but gives it no component.
- **A6 · `overlay-legend`.** Three swatch-and-label entries — count line, exclusion zone, uncommitted draft — in `{typography.caption}` / `{colors.muted}`. The prototype draws one (`prototype/design-system.html:487-491`); the document never names it. Without it, three overlay colours are unlabelled on a dark surface.
- **A6b · `histogram-row`.** The confidence histogram as labelled horizontal bars on `progress-track` geometry with a `chart-primary` fill. `DESIGN.md:1109` lists "charts beyond the metric trend chart" as an open gap; this is the smallest thing that closes it for one panel, and it needs no charting library.
- **A7 · `pill-verdict-*`.** A **fourth** pill family for a per-crossing verdict: `confirmed` → `pill-success`, `flagged` → `pill-warning`, `excluded` → `pill-muted`, `rejected` → `pill-danger`. Declared the way deployment state is declared at `DESIGN.md:624` — a different question deserves a different family. `excluded` moves from red to muted deliberately: an exclusion is a decision the operator asked for, not a failure, which is the same argument `DESIGN.md:941` makes about a red zone on video.
- **A8 · one sentence added to *Provenance*.** When the record carries no reportable flag, the strip renders `pill-warning "unverified"` **with a reason** — it is never hidden and never assumed reportable. See §2.2.

Nothing else needs adding.
Refusal, locked, provenance, comparison, video, jobs and partial all map onto components that already exist in `DESIGN.md:812-985`.

### 2.4 What the private type faces become

| Private face | Metrics | Becomes |
|---|---|---|
| `.lab-kicker` / `.lab-card-title` (`styles.css:1080`) | 10px / 700 / +1.4px / cyan | `{typography.caption-uppercase}` — 11px / 600 / +1.2px / `{colors.muted}` |
| `.lab-output-label` (`styles.css:1109`) | 9px / 700 / +0.8px / mono / cyan | `{typography.micro-uppercase}` — 11px / 600 / +0.8px / mono / `{colors.muted}` |
| `.lab-capability-state` (`styles.css:1096`) | 9px / 700 / mono / amber | a `pill-*`, because it reports a state, not a heading |
| `.lab-note` | 11px / `--lab-muted` | `{typography.caption}` / `{colors.muted}` |
| `.lab-event-table` cells | 10px mono | `{typography.code-inline}` — 12px mono |
| ad-hoc `17px` / `18px` / `16px` mono numerals (`styles.css:1092`, `:1096`, `:1163`, `:1187`) | four different sizes | `{typography.metric-numeral-sm}` (16px) everywhere, `{typography.metric-numeral}` (28px) for the single headline per panel |
| `.lab-hint` / `.lab-hint-tooltip` (`styles.css:1280-1283`) | private tooltip | the app's existing `.hint` / `.hint-icon` / `.hint-tooltip` (`styles.css:319-353`) = `{component.hint-icon}` + `{component.hint-tooltip}` |

Every 9px and 10px face is gone.
`research/04-design-system-gaps.md` §4.2 puts the accessibility floor at 11px and this spec holds it: **no text below 11px, anywhere on the surface.**

---

## 3. Deliberately dropped

Carrying a control across a redesign is an endorsement of it (`issues/08:135`).
Seven things are not carried.

### 3.1 The dark shell

`styles.css:1076` sets `background:var(--lab-bg)`, `min-height:calc(100vh - 80px)` and `margin:-16px` to escape the app shell.
It does not even escape cleanly: `.section-main` pads 20px (`styles.css:161`) and the Lab pulls back 16px, so there is a 4px white frame around the dark surface today.
The section becomes ordinary content inside `.section-main`, on the app's own `--color-surface-soft` floor.
Dark survives in exactly one place, where `DESIGN.md:931` says it belongs: the video well.

### 3.2 The "Match threshold" control — decided before this spec

`webui/lab_core.py:579` computes `max(roi_dedup_px, 50 * (1 - match_thresh))`, so at the shipped 25 px and 0.70 the second term is 15 and is discarded.
`Lab.defaults.test.ts:52-58` proves it is inert across 0.5 → 1.0, i.e. the entire plausible tuning range.
The control goes; `matchDistancePx` (`Lab.tsx:53-59`) **stays exported**, because the test that records the finding imports it, and because the derived value is worth showing as a read-only line inside the tracker section's `provenance-block`.
Its Hint text moves there too — the explanation of what the knob really was is the useful part.

### 3.3 The trail knobs — decided before this spec

`show_trail` and `trail_len` have no consumer.
`apps/api/lab_server.py:601-606` advertises `tracker`, `healer`, `scorer` and `optical_flow` — never `trail`, never `path`.
`labApi.ts:343-346` says the same in a comment, and `labApi.ts:368-381` lists `trails` / `paths` / `trail` among the nine declared-but-never-produced result fields.
So `trailSupported` (`Lab.tsx:600`) is always false, the panel is always LOCKED, and the two knobs never render.
Both controls go, and `trailConfigForRun` (`Lab.tsx:525`) goes with them.
The `PATH PROVENANCE` inspector card (#118-121) is a different thing and stays — it reads per-event `provenance.path`, which the backend does emit.

### 3.4 The `Mid-Clip Switch` tool card

`Lab.tsx:634` renders it permanently `disabled` with the title "Mid-clip switching is not wired in v0".
It is not in the must-not-lose list (`issues/08:124-131`), nothing behind it exists, and a button that can never be pressed is a promise with no owner.
When mid-clip switching is built it gets a real control; until then the surface should not advertise it.

### 3.5 The fake timeline strip

`Lab.tsx:634` renders `<i style={{ width: video ? "3%" : "0%" }} />` — a progress bar that reads 3% for any loaded video, whatever is playing.
By this system's own rule, a percentage is a number and shows where it came from (`DESIGN.md:959`); this one came from nowhere.
The `<video controls>` element already provides a real scrubber, so the strip is also a duplicate.
Dropped; the duration readout it carried moves into `video-hud` (#63), where the other measured facts already live.

### 3.6 Colour on the aggregate deltas

`Lab.tsx:639` colours a delta green when positive and red when negative.
`DESIGN.md:898` forbids exactly this: *"Improvement is direction-dependent and must be declared per metric, never inferred from sign"* — and it is wrong here in practice, since more `flagged` and more `excluded` are not improvements.
Deltas keep their sign, keep both absolute values (`baseline → current`, already rendered), and lose the colour claim.
Declaring direction per metric is a behaviour change and is listed in §6, not done here.

### 3.7 The `Experimental` component

`Lab.tsx:39` defines `function Experimental()` and nothing renders it — one definition, zero call sites.
Its CSS (`styles.css:1091`, `:1112`) is the only other trace.
Dropping a component that renders nothing is not losing an affordance.

Also gone with the Lab-only CSS block, all dead before this work: `--lab-magenta`, `--lab-yellow`, `.lab-empty-mini`, `.lab-capability-reasons`.

---

## 4. The density plan

The claim to defend is that the surface stays as dense as it is today using only the system's own scales.
Here is the arithmetic, token by token.

### 4.1 Type — five sizes, floor 11px

| Role | Today | Token | Value |
|---|---|---|---|
| shell base | 13px (`styles.css:1076`) | `--fs-body-sm` | **13px** — the same number, now a documented one |
| rail labels, notes, captions | 11px | `--fs-caption` | 12px |
| panel eyebrow, micro labels | 9–10px | `--fs-caption-upper` | **11px** — the floor |
| inline values, table cells, run ids | 9–10px mono | `--fs-code-inline` | 12px |
| inspector numerals | 16 / 17 / 18px mono | `--fs-metric-sm` | 16px |
| one headline per panel | 18px mono | `--fs-metric` | 28px |
| section title | 22px | `--fs-display-sm` | 22px |

Net effect: the smallest text on the surface goes **up** from 9px to 11px, and the number of distinct sizes goes down from eleven to seven.
Density is not lost, because the space between things shrinks instead — which is `DESIGN.md:1100`: *"when in doubt about emphasis: tighter spacing before bigger type."*

### 4.2 Spacing — only `xxs`, `xs`, `sm` inside the surface

| Use | Token | Value | Today |
|---|---|---|---|
| grid gap between the three columns | `--space-sm` | 12px | 12px (`styles.css:1085`) |
| panel padding (`panel-dense`) | `--space-sm` | 12px | 13px (`styles.css:1092`) |
| gap between stacked inspector cards | `--space-sm` | 12px | 12px |
| gap between fields inside a rail section | `--space-sm` | 12px | 12px (`styles.css:1104`) |
| gap inside a field (label → control) | `--space-xxs` | 4px | 5px |
| control padding | `--space-xxs` / `--space-xs` | 4px / 8px | 5px / 8px |
| table cell padding | `--space-xxs` / `--space-xs` | 4px / 8px | 6–7px / 6px |
| nested value block padding | `--space-xs` | 8px | 8px |

`--space-md` (16px) and above appear nowhere inside the instrument.
Every value above is already in the scale (`tokens.css:96-103`); nothing is invented, and the largest single change is 13px → 12px panel padding.

### 4.3 Controls — 32px, an existing size

`control-dense` = height 32px, padding 4px 8px, 13px text, `--radius-md` (6px), 1px `--color-hairline`, focus `--elev-focus-ring`.
32px is already the documented size of `button-icon` and `notification-bell`, so this adds a *use* of a value, not a value.
It is 2px taller than today's 30px (`styles.css:1089`); across the tallest rail section that is about 8px of extra height, and it buys a control that matches the rest of the app.

### 4.4 Radius, elevation, motion — unchanged from the system

`--radius-sm` (4px) for chips and inline markers, `--radius-md` (6px) for controls, `--radius-lg` (8px) for panels and the video well.
Elevation is hairlines only; no shadows on any panel in the instrument (`DESIGN.md:1055`).
Motion: `--t-fast` for hover and focus, `--t-base` for the progress fill, and the existing `prefers-reduced-motion` block survives verbatim.

### 4.5 Colour density, stated as a budget

Azure appears in exactly six places on this surface: the `Run Replay` button, the active model-mode tab, the selected crossing row, the measured progress fill, focus rings, and `text-link`s.
Semantic colour appears only on pills, banners and the `overlay-*` family.
Everything else is ink, body-strong, muted and hairline.
If a seventh azure use appears, the rebuild has drifted.

---

## 5. The layout

### 5.1 The three columns keep their proportions

Today: `grid-template-columns: minmax(220px,24fr) minmax(420px,50fr) minmax(240px,26fr)`, gap 12px (`styles.css:1085`).
Rebuilt: `minmax(240px, 22fr) minmax(420px, 52fr) minmax(260px, 26fr)`, gap `--space-sm`, `align-items: start`, `min-width: 0` on all three (kept — it is what stops the tables from blowing the grid out).

The shape is worth keeping because it matches the loop: set a parameter on the left, see the frame in the middle, read the consequence on the right.

**It stays inside `--content-max` (1280px).**
The three columns need 240 + 420 + 260 + 24 = 944px minimum, and `.section-main` gives 1240px at the cap, so the well renders about 645 × 363 px — larger than today's, because today's Lab spends 16px of its escape on nothing.
No new width token, no viewport escape, no `margin:-16px`.

### 5.2 Breakpoints — one, at the documented 900px

The current file has two ad-hoc breakpoints, 1100px and 720px (`styles.css:1093`, `:1094`), neither of which is in `DESIGN.md:1069-1074`.
Replaced by the documented set:

- **≥ 900px** — three columns as above.
- **< 900px** — one column, DOM order preserved: rail, then viewer, then inspector. This matches `DESIGN.md:1084` ("the detail panel renders BELOW the card list"), and preserving DOM order means keyboard and screen-reader order stay correct without `order:` tricks.
- **< 640px** — the tool row goes 4-up → 2-up, the count-summary grid 3-up → 2-up, the crossing-detail grid 4-up → 2-up, and every table keeps scrolling inside its own `overflow-x` container rather than widening the page.

No responsive JavaScript: the rail keeps its default-open sections (1, 2, 4) at every width and the page scrolls.
The `hint-tooltip` keeps its existing < 720px fixed-position fallback (`styles.css:1296`), re-pointed at the app's `.hint-tooltip`.

### 5.3 The one thing the layout adds

The rail is a scroll-independent column today only by accident.
Give the centre column `position: sticky` on its run row so `Run Replay` and the progress block stay reachable while the inspector is scrolled — a 3-line addition, no new tokens, and it is the one ergonomic gap a three-column instrument has.
If it complicates the build, drop it; it is not an affordance.

---

## 6. What this does not attempt

The Suites half — durable results, evaluations, the comparison surface — waits on the evaluations plumbing (map build steps 3–6).
This pass rebuilds the **instrument** only, and the run-history and A/B panels stay functionally as they are, re-skinned.

Specifically **not** in this pass, each with where it belongs:

- **The `Replay` / `Suites` split, and the tab rename.** `issues/08:78` decides it; `App.routing.test.tsx:17` pins the current five sections. The route stays `/lab`, the export stays `Lab` at `sections/Lab.tsx`.
- **Populating provenance for real.** Needs the Lab to write `evaluations` / `clips` rows (`research/04-design-system-gaps.md` §6.1). Until then §2.2's fail-closed `unverified` is the correct rendering, not a placeholder.
- **The two mandatory comparison refusals** (`DESIGN.md:889`). `compareRunManifests` reports changed config keys as information, and no manifest carries an `artifact_kind`. Adding the blocking refusal is a behaviour change (`research/04` §6.4). This pass promotes `CHANGED CONFIG KEYS` into the `compare-header` as a `warning-banner` — same information, system's register, no new logic.
- **Per-metric direction declaration** for `delta-value` (`DESIGN.md:898`, `research/04` §6.3). This pass only removes the false colour claim (§3.6).
- **`job-cancel`** (`DESIGN.md:961`). The `AbortController` already exists (`Lab.tsx:452-455`) and a Cancel button is about three lines, but it is a new affordance and the brief for this pass is the visual language only. First follow-up.
- **Partial Results** (`DESIGN.md:965-985`). A single clip cannot be partial; `partial-summary` and `partial-row` belong to Suites. `pill-partial` and `--color-status-partial` still get added to the token layer, because the tolerance-state row needs the amber-not-green rule today.
- **Skeleton loaders** (`DESIGN.md:1111`). The instrument carries several ad-hoc loading strings — `Loading tasks…`, `Loading model registry…`, `Checking the backend run store…`, `Waiting for backend RunManifest history…`, two `LOADING` chips, `Fetching model N%`, `Saving…` — and they stay as `hint` copy until the system has a component.
- **`react-router` deep links into the Lab** (a run id or an event id in the URL). Worth having, orthogonal to a re-skin.
- **The shared counting engine's knobs** (map build step 2). Sections 3, 5 and 6 of the rail are re-skinned as they stand; they get replaced wholesale when the engine lands, which is another reason not to invent new controls for them now.

---

## 7. Corrections found while reading

Recorded because the rebuild will be checked against these documents.

- **The events CSV has 25 columns, not 28.** `Lab.tsx:548` lists them; `issues/08:130` says "the 28-column events CSV". Count from the source, and keep the `columns.length` comment at `:561-563` — the bbox spread contributes four cells and a mismatch shifts every column after it.
- **`Lab.tsx` is 649 lines, not 596.** `docs/web-review.md:103` and `issues/08:13` both say 596. The file grew after they were written.
- **Line numbers in the older docs have drifted.** The `match_distance` formula is `webui/lab_core.py:579`, not `:518` — both `map.md:20` and the comment at `Lab.tsx:48` cite `:518`, which is now an exclusion-zone validation line. `"persistent": False` is `apps/api/lab_server.py:769`, not `:746` (`docs/web-review.md:27`, `issues/08:86`). The `tracker_type = "centroid"` default is `webui/lab_core.py:65`.
- **The Lab-only CSS is ~196 lines, not 184.** `styles.css:1073-1096`, `:1100-1198`, `:1278-1296`, `:1299-1317`, `:1319-1338`, `:1340-1349`, `:1421-1425` — with three unrelated `.metric-svg` rules interleaved at `:1098` and `:1200-1202`, which is worth noticing before anyone deletes a range by line number.
- **`DESIGN.md`'s front matter is ahead of `tokens.css`** by three token groups (§2.1). The document describes tokens the app cannot reference yet.

---

## 8. How a reviewer checks the build against this spec

1. `grep -c "lab-" apps/web/src/styles.css` → the private block is gone; no `--lab-*` token is declared anywhere.
2. `grep -nE "#[0-9a-fA-F]{3,6}" apps/web/src/styles.css` → no new hex outside `tokens.css`; the pre-existing `#fbcaca` / `#dc2626` / `#dbecf7` at `styles.css:232`, `:734`, `:819` are not this work's to remove.
3. No `font-size` below 11px and no `font:` shorthand below 11px in any rule the Lab uses.
4. Every affordance number 1–146 in §1 either renders on screen or appears in §3 with its reason.
5. All 13 Hint texts and 21 notes match the current strings character for character.
6. `cd apps/web && npm run build && npm test` → build clean, **115 tests passing**, `DEFAULT_CFG` and `matchDistancePx` still exported from `sections/Lab.tsx`.
7. The section renders inside `.section-main` with no negative margin, and the only dark surfaces are the two video wells.
