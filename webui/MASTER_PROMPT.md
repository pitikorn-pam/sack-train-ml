# MASTER PROMPT — Sack-Detector-Edge Lab WebUI (Gradio)

Paste everything below into ChatGPT (or any image/UI generator).
Ask it to (a) refine the design and (b) generate 2–3 mockup images of the UI.

---

## INSTRUCTION TO THE MODEL

Design a **Gradio web UI** that is a **manual experimentation lab for the "sack-detector-edge" counting pipeline**, shipped as a module inside the `sack-train-ml` repo.
The user uploads a recorded video, replays it through the pipeline, tunes EVERY config knob by hand with sliders/inputs, watches the annotated overlay, reads the count breakdown, and exports the result.
It is an offline research/tuning tool on the trained `.pt` model (Mac, MPS/CPU) — a config-exploration playground, NOT the live Hailo edge device.

Then generate **2–3 mockup images** of this UI: a light and a dark variant, Gradio-style (left config panel, right video + results), showing realistic sack-loading CCTV frames with yellow sack boxes, magenta person boxes, a green counting line, and a count-breakdown panel.

---

## 1. WHAT THIS TOOL IS

A weaver's bench for the counting pipeline: threads in (video + config), pattern out (overlay + counted numbers).
The whole point is to let a human A/B a config change against a baseline on the SAME footage and SEE the effect, without touching the edge device.

Core loop the UI supports:
1. Load a recorded video (+ optional ground-truth count for scoring).
2. Set the counting line (draw it on a frame) and every pipeline knob.
3. Run the replay → get an annotated mp4 + a count breakdown (confirmed / flagged / recovered).
4. Compare against a saved baseline run (Δ confirmed, Δ flagged, per-event diff).
5. Export the overlay mp4 + the config + the numbers as one bundle.

## 2. THE PIPELINE BEING MIRRORED (so the knobs map to something real)

`video → detector (YOLOv11s person+sack) → NMS → tracker → line-crossing → confirmed/flagged split → count`
Plus optional occlusion-recovery layers the lab must toggle:
- **TrackHealer** — re-links a sack track that broke under occlusion (path + person-as-occluder gate).
- **IdentityFirewall** — freezes static tracks to stop id-theft double-counts.
- **MotionBridge** — predicts position across short detection gaps.
- **Crossing Confidence Scorer** — fuses many signals into one score → confirmed / flagged / rejected (veto layer + weighted soft-score).

## 3. THE FULL CONFIG TAXONOMY (real knobs, real defaults — the heart of the UI)

Group these into collapsible accordion panels. Each knob = a labelled slider/number/toggle with its default and range. Values below are the deployed edge defaults.

### A. Input / Session
- video upload; ground-truth count (int, for scoring); frame range (start / end); frame-stride (1–10, speed vs completeness)
- session metadata: container_id, company_code, yard_location (free text, for the provenance stamp)
- camera transforms: h-flip, v-flip, full-FOV (toggles)

### B. Detection
- model (.pt / .onnx / .hef dropdown)
- **prefilter conf** (HAILO_PREFILTER_CONF, 0.05–0.95, default 0.25) — detection floor
- **NMS-IoU** (0.1–0.95, default 0.70) — high = keep overlapping/stacked boxes. NOTE: on the real .hef this is baked on-chip (per-class); tunable only on the .pt/onnx path or via recompile — the UI must label it "editable on .pt only".
- classes: person (0) / sack (1) checkboxes

### C. Tracker
- **tracker type** (botsort | bytetrack, default botsort)
- **track_thresh** (0–1, default 0.30)
- **track_buffer** (frames a lost track survives, default 30)
- **match_thresh** (IoU association, 0–1, default 0.70)

### D. Line & Geometry (draw on a frame, not type numbers)
- **counting line**: click two points on a paused frame → (x1,y1)-(x2,y2); "inFlipped" toggle (which side is IN vs OUT)
- **mid-clip line switch**: switch-frame + second line (operator re-drew the line partway) — for real onsite line moves
- **exclusion zones**: draw polygon(s) over the static pile so it isn't counted (see Scorer note — may be soft, not hard)

### E. Counting & Dedup
- **conf-split / CONF_THRESHOLD** (0–1, default 0.60) — below this a crossing is FLAGGED (needs human review), not confirmed
- **roi_dedup distance** (px, default 25) + **roi_dedup frames** (default 120) — suppress a re-count within this space+time window
- **count cooldown** (COUNT_COOLDOWN_FRAMES, default 40) — block a reverse re-count of the same id within N frames
- **hysteresis** (COUNT_HYSTERESIS_CP_MIN, default 2.0)
- **max load** (per-session confirmed cap, 0 = unlimited)

### F. Occlusion-Recovery (POC layers — each a toggle + its knobs)
- **TrackHealer**: on/off; require_person (gate) on/off; max_gap (frames, default 90); corridor_px (default 160); near_px (default 140)
- **IdentityFirewall**: on/off (+ freeze thresholds)
- **MotionBridge**: on/off; predictor = linear | quadratic | optical-flow
- **velocity_gate**: on/off (reject crossings moving the wrong way)
- **centroid_smooth**: on/off (note: tracker already Kalman-smooths → risk of double-smoothing)

### G. Crossing Confidence Scorer (the new decision core)
- **mode**: legacy single-conf gate | fused score
- **veto toggles** (hard reject): not-a-sack (class), out-of-zone, dedup-hit
- **soft contributors** (each a weight slider, 0–2): detection conf, track stability, velocity/direction, healer recovery quality, identity integrity, box-shape sanity
- **decision thresholds**: confirm ≥ / flag-band / reject <
- **fusion**: hand-tuned weights now, "fit weights from ground-truth" button later (logistic regression)
- recovered crossings auto-fall to FLAGGED

### H. Output / Export
- overlay style toggles: boxes, track ids, centroid trail (path), counting line, HEALED markers, per-crossing score breakdown
- export bundle: annotated mp4 + config json + count csv + provenance stamp (source, fps measured?, line source)

## 4. UI LAYOUT & FEATURES

- **Left panel**: the accordion of config groups A–H (collapsed by default, opened as needed). A "load config" / "save config" (json) row on top. A "reset to deployed defaults" button.
- **Center**: a frame viewer where the user scrubs to a frame and **draws the line + exclusion zones by clicking**. A big "Run replay" button.
- **Right panel**: the annotated output video (play + download), and a **count breakdown card**: confirmed / flagged / recovered / (vs ground-truth), plus a per-crossing table (frame, id, direction, tag, score, healed?).
- **A/B compare tab**: pick a saved baseline run + the current run → show Δ confirmed, Δ flagged, and a diff of which crossings appeared/disappeared, side-by-side overlay clips at each changed crossing.
- **Trace/Debug tab**: draw centroid trails + re-link arrows + score-breakdown-per-count (the visible face of the Scorer).
- **Runs history**: every run saved with its full config + numbers, so nothing is lost and any run is reproducible.

## 5. KEY INTERACTIONS

- Draw the counting line by clicking two points on a paused frame (not typing x/y).
- Toggle a single knob → re-run → the count card shows the delta vs the previous run (measure-one-lever-at-a-time).
- Per-crossing score breakdown: click a counted event → see each contributor's value and how the fused score landed confirmed/flagged.
- Everything defaults to the real deployed edge config so a fresh run reproduces deploy-truth before the user changes anything.

## 6. CONSTRAINTS

- Gradio (Python). Runs locally in a browser. Inference on the trained `.pt` (MPS/CPU), so it is a config-exploration/ceiling tool, not bit-exact to the quantized Hailo `.hef`.
- Long videos are slow on CPU → frame-stride + a progress bar are required.
- Keep the deployed defaults front-and-centre; label any knob that behaves differently on the real .hef (e.g. NMS-IoU is baked on-chip).

## 7. WHAT I WANT BACK FROM YOU

1. A refined feature list / IA (information architecture) for the panels.
2. **2–3 mockup images** of the full screen (light + dark), Gradio-style, with a realistic sack-loading CCTV frame, yellow/magenta boxes, green line, and the count-breakdown card visible.
3. A short note on which features are v1 (ship first) vs v2.

---

*Context for whoever builds this: a v0 rough prototype already exists at `sack-train-ml/webui/infer_ui.py` (video → conf/iou/class sliders → annotated mp4). This master prompt expands it into the full lab. Config defaults above were read from the deployed `sack-detector-edge/src/config/settings.py` + `.env` on 2026-08-09. — Loom Oracle (AI)*
