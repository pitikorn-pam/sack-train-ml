# Sack-Detector-Edge Lab — Feature Spec & Build Plan (AI-agent handoff)

A "Lab" tab inside sack-train-ml (`apps/web`) to replay a recorded video through the
sack-detector-edge counting pipeline, tune every knob, and see overlay + counts + A/B.
**This is the authoritative handoff for the AI agent continuing the build.**

Companion docs (read these too):
- `webui/MASTER_PROMPT.md` — full config taxonomy + UI mockup/IA
- `webui/PATH_SPEC.md` — path/trajectory subsystem (feeds trail, healer, scorer)
- POC source of truth (do NOT reinvent): `loom-oracle/.claude/skills/_cv_lib/{track_healer.py,trails.py}`, `.../cv-replay/cv_replay.py`, `loom-oracle/ψ/lab/2026-08-07_occlusion-count-recovery-poc/{scratch/offline_recount.py,RESULTS.md,CON3_NMS_CHARACTERIZATION.md}`, `loom-oracle/ψ/outbox/to-nexus_2026-08-09_occlusion-scorer-consult-reply.md`

## 0. How to use this doc

Build in the phase order (§4 features are grouped P0→P3). Each feature has **Goal / Direction / Files / Config / Acceptance / Depends-on**. Ship one feature, verify its Acceptance, then the next. Keep §5 conventions in every feature.

## 1. Architecture

```
apps/web (React19+TS+Vite, :5173)  ──fetch /api/lab/*──▶  apps/api/lab_server.py (FastAPI, :8077)
  Lab tab (sections/Lab.tsx)                                 └─ webui/lab_core.py (YOLO .pt + tracker + counter)
  (Vite proxies /api/lab → :8077)                            └─ webui/lab_path.py (path/predictor — to add, see PATH_SPEC)
```
`.pt` on Mac (MPS/CPU) = config-exploration, NOT bit-exact to Hailo `.hef`. Label `.hef`-baked knobs (NMS-IoU).

## 2. Run + file map

```bash
/Users/pitikorn/Work/BSCP/sack-train-ml/.venv/bin/python apps/api/lab_server.py   # backend :8077
cd apps/web && npm run dev                                                          # frontend :5173 → tab "Lab"
```
| File | Role |
|---|---|
| `webui/lab_core.py` | inference + tracker + crossing events (`LabConfig`,`LabResult`,`CentroidTracker`,`derive_crossing_event`) |
| `apps/api/lab_server.py` | FastAPI: `/api/lab/{health,models,infer,video/{id}}` + upload guards + line/model validation |
| `apps/web/src/lib/labApi.ts` | typed client + **v1 wire contract** (`CrossingEvent`,`EventProvenance`,`RunManifest`,`LabSummary`) |
| `apps/web/src/sections/Lab.tsx` | the tab UI |

## 3. Status snapshot

- ✅ v0: detection overlay + config subset + export, end-to-end (tsc + backend infer verified 2026-08-09)
- 🟡 in progress (already landing in code): CentroidTracker, `derive_crossing_event`, line validation, v1 `CrossingEvent`/`RunManifest` contract, upload guards
- ⬜ everything in §4 P1–P3

## 4. Feature specs

### P0 — foundation (mostly done)
**F1 Replay + config panel** · Goal: upload video, set every knob, run → overlay. Direction: `LabConfig` = all knobs (defaults = edge `.env`); left accordion panels per MASTER_PROMPT §3. Files: `Lab.tsx`, `lab_core.run_inference`. Acceptance: change any knob → re-run → overlay reflects it. Depends: —

### P1 — real counting (the core value)
**F2 Draw line + exclusion on frame** · Goal: click two points on a paused frame → counting line; polygon → exclusion zones; mid-clip switch. Direction: canvas overlay on a seeked frame; store as `CountingLine`/`ExclusionZone` (pixel space + `frame_ref`, contract already in labApi.ts). Files: `Lab.tsx` (canvas), `lab_core.validate_line`. Acceptance: drawn line renders on overlay at the same pixels; round-trips through config. Depends: F1.

**F3 Counting + confirmed/flagged** · Goal: tracker → line-crossing → count, split confirmed(≥conf_split)/flagged. Direction: `CentroidTracker` (already) → `derive_crossing_event` → `summarize_events`; return `events[]`+`summary`. Files: `lab_core.py`, `lab_server.infer`, `Lab.tsx` (Count Summary card + per-crossing table + Export CSV). Acceptance: on a clip with a line, confirmed/flagged/per-crossing populate + match a manual eyeball; no line ⇒ counts null. Depends: F2.

**F4 vs Ground-Truth** · Goal: compare count to GT (real target = **GT 380, not device 358**). Direction: `LabConfig.ground_truth` int; `summary.error_vs_ground_truth` + tolerance band. Files: `lab_core.summarize_events`, `Lab.tsx`. Acceptance: card shows confirmed/GT + error% + within/over/under-tolerance. Depends: F3.

### P2 — occlusion recovery + decision
**F5 Path/trajectory subsystem** · Goal: per-track path once, consumed by trail/healer/scorer. Direction: full spec in `PATH_SPEC.md`; build `lab_path.py` (path model + predictor linear|quadratic|optical-flow). Files: `lab_path.py`, wire into `CentroidTracker`. Acceptance: trail overlay renders; predictor unit-tested on a curved synthetic path. Depends: F3.

**F6 Occlusion-recovery toggles** · Goal: TrackHealer / IdentityFirewall / MotionBridge / velocity_gate; recovered→flagged. Direction: port `track_healer.py` (re-link via path corridor + person gate); each a toggle + knobs; recovered events get `recovery:"recovered"` + auto-flagged. Files: `lab_core.py` (integrate healer between tracker + counter), `Lab.tsx` panel. Acceptance: on the KMTU-style occlusion clip, a broken carry re-links → HEALED marker + a recovered event; toggling off removes it (reproduce POC +2). Depends: F5.

**F7 Crossing Confidence Scorer** · Goal: veto + weighted soft-score → confirmed/flagged/reject. Direction: veto(class/zone/dedup) as code; soft contributors (detection-conf, track-stability, direction, healer-quality, identity, box-shape) in **logit space**, hand-tuned weights first, "fit from GT" later (see consult reply). Files: `lab_core.py` (scorer module), `Lab.tsx` (weight sliders + per-crossing score breakdown). Acceptance: per-crossing shows each contributor + fused score + decision; weights change the split predictably. Depends: F3 (F5/F6 feed contributors).

### P3 — lab power
**F8 A/B compare** · Goal: baseline run vs current on same footage → Δ + per-event diff. Direction: persist runs (F10); diff `events[]` by (frame,id); side-by-side overlay clips at changed crossings. Files: new `sections/lab/ABCompare` + backend diff. Acceptance: change one lever → A/B shows Δconfirmed/Δflagged + which crossings appeared/vanished. Depends: F3, F10.

**F9 Trace / Debug tab** · Goal: the visible face of tracking+scorer. Direction: draw trails + predicted (dashed) + re-link arrows; click a crossing → path + score breakdown (per PATH_SPEC §6). Files: `sections/lab/Trace`. Acceptance: trails + re-link arrows render; click → breakdown popup. Depends: F5, F7.

**F10 Runs history + export** · Goal: every run saved (config+numbers) reproducible; export bundle. Direction: `RunManifest` (contract in labApi.ts) persisted (Supabase is already in the app, or local json); export overlay mp4 + events CSV + config json + provenance. Files: `lab_server` (store/list), `Lab.tsx` (history list). Acceptance: a saved run re-loads its exact config + numbers; export bundle downloads. Depends: F3.

**F11 (optional) Model compare** · Goal: swap .pt/.onnx, compare detection to inform retrain. Direction: run same clip through two models → side-by-side. Acceptance: two overlays + detection-count delta. Depends: F1.

## 5. Conventions (apply to every feature)

- Defaults = deployed edge `.env`: conf 0.25, conf_split 0.60, roi_dedup 25/120, cooldown 40, buf 30, match 0.7 → first run = deploy-truth before the user touches anything.
- Every count traces to a per-crossing `CrossingEvent` with `provenance` (audit "why counted"). Never report a bare number.
- Measure **one lever at a time** → A/B. Target = **GT 380**, device counts are baselines to beat.
- Keep path + predictor in ONE module (`lab_path.py`); keep inference core web-free (`lab_core.py`) so it's testable.
- Add a unit test with each pipeline feature (tracker, healer, scorer) on synthetic detections.

## 6. Build order

P0 (F1) ✅ → P1 (F2→F3→F4) = usable counting lab → P2 (F5→F6→F7) = recovery + scorer → P3 (F8/F9/F10, F11 optional).

— Loom Oracle (AI), 2026-08-10
