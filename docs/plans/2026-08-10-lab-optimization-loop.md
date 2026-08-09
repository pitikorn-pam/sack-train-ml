# Lab Optimization Loop

Goal: make the Lab the most useful object-detection learning and counting workbench without fabricating metrics or hiding unsupported behavior.

## Operating loop

For every wave:

1. Inspect current contract and real output.
2. Write a focused failing test or reproduce the UI failure.
3. Implement the smallest vertical slice.
4. Verify backend JSON, frontend rendering, and real fixture behavior.
5. Review failure modes and update this plan.
6. Commit one coherent wave.

## Priority order

### P0 — Traceable event learning surface

Add an event inspector driven only by `result.events[]`:

- select a crossing row;
- show frame/time/track/direction/status/confidence;
- show decision provenance, geometry, path points/predictor metadata, and scorer breakdown when present;
- no selected event means an explicit empty state;
- never reconstruct a path or score in the browser.

Acceptance: selecting an actual event exposes its complete backend provenance without React object-child crashes; detection-only runs remain empty/locked.

### P1 — API and QA contract matrix

Add direct contract checks for:

- health/capabilities and model list;
- malformed line/polygon/config;
- model/video upload limits and extension rejection;
- detection-only vs counting response invariants;
- manifest redaction and process-local history;
- output video/event CSV/config/manifest identity.

Acceptance: every failure path has an explicit status/detail and no secret/path leakage.

### P2 — Real replay progress

Keep the existing estimated progress for the synchronous endpoint. Add an opt-in backend job contract only if it can provide:

- job ID and status;
- processed/total frames;
- cancellation and timeout behavior;
- final result identity;
- no duplicate inference on polling retries.

Acceptance: UI distinguishes server progress from estimate; no fake percentage.

### P3 — Detection learning diagnostics

Expose only backend-produced diagnostics:

- per-class detection totals;
- confidence distribution/histogram;
- sampled frame detection density;
- tracker retention and crossing funnel when available;
- explicit missing-data states.

Acceptance: diagnostics are tied to run ID/config/model/video hashes and never presented as accuracy without labels.

### P4 — Event-level A/B and calibration

Compare selected runs by event identity/frame and provenance, not aggregate numbers alone. Add scorer calibration workflow only after labeled crossing data exists; GT 380 is evaluation truth, not training labels.

### P5 — Recovery

Implement healer/identity firewall only with real path/person evidence, recovery provenance, TTL/duplicate safeguards, and synthetic adversarial tests. Keep capability locked until the full path is wired.

## Current constraints

- Lab scope only: `apps/web`, `apps/api/lab_server.py`, `webui/lab_core.py`, focused tests/docs.
- No sibling repo or training pipeline changes.
- No fake controls, metrics, scores, paths, or progress.
- No credentials, cookies, tokens, or secrets.
- `persistent=false` run history remains visible until durable storage exists.
- Commit each coherent wave after gates pass.
