# Sack-Detector-Edge Lab UI + Backend Next Steps Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Keep frontend and backend file ownership separate, then run a Nine integration gate.

**Goal:** Move the Lab from the committed replay/counting baseline to a trustworthy operator-facing counting research tool, following `webui/BUILD_PLAN.md`, `webui/MASTER_PROMPT.md`, and `webui/PATH_SPEC.md`.

**Architecture:** React/Vite Lab UI owns experiment state, drawing, controls, result presentation, and exports. FastAPI owns upload validation, request/response contracts, inference execution, artifact serving, and run metadata. `webui/lab_core.py` remains web-free and owns detector execution, tracking, geometry, events, and summaries. The path model will be a shared backend subsystem consumed by trails, recovery, scoring, and trace output.

**Tech Stack:** React 19 + TypeScript + Vite, CSS namespaced under `.lab-*`, FastAPI, Python dataclasses, OpenCV, Ultralytics `.pt` inference, pytest when available, synthetic pure-Python tests.

---

## Current baseline and non-goals

Committed baseline: `d1b4205 feat(lab): add replay control room and v1 counting`.

Already present:
- Lab route, dark three-column control-room UI, local/R2 model-to-multipart flow.
- Video preview and letterbox-aware pixel geometry editor.
- Exclusion polygon validation and overlay.
- Deterministic centroid tracker, line crossing, confidence split, exclusion status, cooldown/dedup.
- `events[]`, `summary`, per-crossing table, CSV/config/overlay actions.
- Backend health/model/infer/video endpoints on port 8077.

Non-goals for this wave:
- Training pipeline, Hailo/release pipeline, sibling repositories, Supabase schema changes.
- Healer/scorer implementation before the shared path subsystem exists.
- Fake metrics, estimated counts, or UI controls without backend ownership.
- A/B compare and persistent run history before F3/F4 output contracts are stable.

Important contract correction:
- The BUILD_PLAN deploy defaults say `count_cooldown_frames=40`; current code must be checked and corrected from 120 before declaring deploy-truth defaults.
- Ground truth target is 380. Device baseline 358 is context, not the target.

---

## Wave 1 — F3/F4 contract and truthful count UX

Only one frontend writer and one backend writer may work in parallel. Do not edit the same file from both lanes.

### Task 1: Lock the count-summary schema with a failing contract test

**Files:**
- Modify: `tests/test_lab_counting_v1.py`
- Modify: `apps/web/src/lib/labApi.ts`

**Steps:**
1. Add tests for `summary.total_crossings`, `confirmed`, `flagged`, `excluded`, `recovered`, optional `ground_truth`, `error_vs_ground_truth`, and `tolerance_state`.
2. Add a test that no configured line returns `summary={}` and null count fields.
3. Run the focused test and confirm the new assertions fail against missing fields.
4. Add the smallest additive TypeScript/Python contract fields.
5. Run the focused test and TypeScript build.

**Acceptance:** The contract distinguishes detection-only runs from counting runs and every aggregate is derivable from `events[]`.

### Task 2: Add ground-truth input and tolerance config

**Files:**
- Modify: `webui/lab_core.py`
- Modify: `apps/api/lab_server.py`
- Modify: `apps/web/src/lib/labApi.ts`
- Modify: `apps/web/src/sections/Lab.tsx`

**Steps:**
1. Add a failing pure test for GT=380 with confirmed count below, equal to, and above GT.
2. Add optional `ground_truth` and `tolerance_pct` to `LabConfig`.
3. Derive `error_vs_ground_truth` and `tolerance_state` only when GT is supplied.
4. Add a compact Input/Session UI field with explicit `GT target`, not `device baseline`.
5. Render Confirmed / GT / error / within-over-under in Count Summary.
6. Keep the panel locked when no GT is provided; never default GT to 380 silently.
7. Run focused tests and build.

**Acceptance:** With GT=380, the UI shows a truthful comparison. Without GT, no error or tolerance label is invented.

### Task 3: Align deployed defaults and document editable-vs-baked knobs

**Files:**
- Modify: `webui/lab_core.py`
- Modify: `apps/web/src/sections/Lab.tsx`
- Modify: `apps/web/src/styles.css`

**Steps:**
1. Add a test asserting fresh `LabConfig` values: conf 0.25, conf_split 0.60, dedup 25/120, cooldown 40, buffer 30, match 0.70.
2. Change only the incorrect defaults.
3. Label NMS-IoU as `.pt/.onnx only; baked on HEF`.
4. Label the Lab as `.pt MPS/CPU research`, not bit-exact Hailo output.
5. Run focused tests and frontend build.

**Acceptance:** Fresh run defaults match the BUILD_PLAN and the UI does not imply HEF equivalence.

---

## Wave 2 — Frontend control-room quality and real interaction

### Task 4: Make the Lab UI follow the MASTER_PROMPT information architecture

**Files:**
- Modify: `apps/web/src/sections/Lab.tsx`
- Modify: `apps/web/src/styles.css`

**Steps:**
1. Keep accordion groups A–H explicit: Input/Session, Detection, Tracker, Line/Geometry, Counting/Dedup, Occlusion-Recovery, Scorer, Output/Export.
2. Keep primary action hierarchy: `Run Replay` > drawing actions > utility exports.
3. Add visible deployed-default indicators and reset-to-default behavior.
4. Add session metadata fields only if they are carried into `RunManifest`; otherwise keep them out of the UI.
5. Add actionable empty/loading/error states for video, model, backend, inference, and output.
6. Add focus-visible and reduced-motion behavior for every interactive Lab control.
7. Run build and inspect the rendered page at desktop/tablet/mobile widths.

**Acceptance:** Every visible control has real state ownership or a disabled explanation. No decorative metrics/cards without source data.

### Task 5: Harden drawing UX for real operator use

**Files:**
- Modify: `apps/web/src/sections/Lab.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `tests/test_lab_geometry_contract.py` (create if needed)

**Steps:**
1. Add a pure geometry test matrix for 16:9, 4:3, portrait, and clicks in letterbox bars.
2. Keep all stored points in source pixel coordinates with `frame_ref`.
3. Add clear draw-mode state, point count, cancel/reset, commit validation, and selected-zone state.
4. Add keyboard-accessible alternatives for clear/delete/commit.
5. Render line direction and exclusion status in the viewer and config panel.
6. Run geometry checks, build, and browser smoke.

**Acceptance:** A drawn line/zone round-trips exactly through config and does not shift on non-16:9 video.

### Task 6: Make result presentation event-first

**Files:**
- Modify: `apps/web/src/sections/Lab.tsx`
- Modify: `apps/web/src/lib/labApi.ts`
- Modify: `apps/web/src/styles.css`

**Steps:**
1. Render count cards only from `result.summary`.
2. Render event table only from `result.events`.
3. Add direction/status/recovery/provenance visibility without showing unsupported scorer fields.
4. Keep CSV disabled when no events exist.
5. Add event selection state only when a trace payload exists; do not render a fake breakdown.
6. Run build and browser smoke using a real backend response.

**Acceptance:** UI never estimates crossings from detection-frame counts and always explains empty event states.

---

## Wave 3 — Shared path subsystem before recovery/scoring

### Task 7: Add `TrackPath` and a single predictor module

**Files:**
- Create: `webui/lab_path.py`
- Modify: `webui/lab_core.py`
- Create/modify: `tests/test_lab_path.py`

**Steps:**
1. Add failing synthetic tests for ring-buffer points, velocity, total displacement, and track expiration.
2. Implement `PathPoint` and `TrackPath` with `hist_len=8` and optional full trace.
3. Implement linear and quadratic prediction; leave optical-flow as an explicit unsupported capability.
4. Attach one path per active track inside the tracker update step.
5. Add path slice metadata to crossing provenance.
6. Run pure path tests and py_compile.

**Acceptance:** One path source feeds future trail, healer, scorer, and Trace features. No duplicated predictor math.

### Task 8: Add trail overlay without enabling healer/scorer

**Files:**
- Modify: `webui/lab_core.py`
- Modify: `apps/web/src/lib/labApi.ts`
- Modify: `apps/web/src/sections/Lab.tsx`
- Modify: `apps/web/src/styles.css`

**Steps:**
1. Add a failing test for actual-vs-predicted path points.
2. Draw actual centroid trails when the output toggle is enabled.
3. Return trail metadata only for real tracks/events.
4. Expose trail length and `trace_full` only if the backend supports them.
5. Keep healer/scorer disabled with capability metadata.
6. Run synthetic tests, build, and inference smoke.

**Acceptance:** Trail overlay is real and auditable; no UI claim that recovery/scoring is active.

---

## Wave 4 — Verification and only then P2/P3

### Task 9: Build a real Lab QA matrix

**Files:**
- Create: `tests/test_lab_api_contract.py`
- Create/modify: browser smoke harness if the repo has one
- Modify: docs only if behavior is verified

**Checks:**
- Health/model list on port 8077.
- Missing backend and recovery after restart.
- Invalid extension, oversized upload, malformed config, outside line, degenerate polygon.
- Detection-only run with no line.
- Counting run with a real line and real video.
- Event/summary invariants.
- CSV/config/overlay downloads.
- Keyboard focus, empty/error/loading states, responsive layout, console errors.

**Acceptance:** Report evidence for every path. Do not call the Lab production-ready if real video inference or browser smoke is unavailable.

### Task 10: Implement F6/F7 only after F5 acceptance

**Files:**
- Modify: `webui/lab_core.py`
- Modify: `webui/lab_path.py`
- Modify: `apps/web/src/sections/Lab.tsx`
- Create focused synthetic tests

**Order:** TrackHealer → IdentityFirewall/MotionBridge → scorer veto layer → weighted score breakdown.

**Acceptance:** Each toggle changes a real backend decision, each recovered event contains recovery provenance, and each score contributor is test-covered.

### Task 11: Implement F10 before A/B and Trace

**Files:**
- Modify: `apps/api/lab_server.py`
- Modify: `apps/web/src/lib/labApi.ts`
- Modify: `apps/web/src/sections/Lab.tsx`
- Create: focused run-store tests

**Acceptance:** A saved run reloads exact config/numbers and exports overlay MP4 + events CSV + config JSON + provenance manifest. Storage must be explicit (local JSON/store first; Supabase only after contract approval).

### Task 12: Implement F8/F9 after reproducible runs exist

**Acceptance:** A/B diff is based on event identity/frame, not aggregate-only numbers. Trace highlights real path/trail/re-link data and does not show empty fake score panels.

---

## Execution protocol

- One writer per file set: frontend and backend may run in parallel only when they do not touch the same files.
- Use RED → GREEN → REFACTOR for pure helpers and contracts.
- Run a focused test after every behavior task.
- Run `npm run build` from `apps/web` after frontend tasks.
- Run `.venv/bin/python -m py_compile ...` after backend tasks.
- Run `git diff --check` before every commit.
- Commit each coherent wave; do not mix unrelated repo files.
- Nine performs final integration review before push.

## Immediate next step

Start with Tasks 1–3 in dependency order:
1. lock F3/F4 schema;
2. add explicit GT/tolerance behavior;
3. align deployed defaults, especially cooldown 40.

Only after those pass should the next frontend/backend wave polish the full UI and begin `lab_path.py`.
