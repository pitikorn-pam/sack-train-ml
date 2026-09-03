# 12 — Do the undeployable options come out of the dropdown now, or wait for the spec?

Type: grilling
Status: open
Blocked by: —

## Question

[03](./03-model-catalogue.md) found that the form currently offers checkpoints that cannot produce a working artifact, and fail *silently*: `yolo26n/s/m` and `yolo26s-seg` train, export and compile with every step reporting success, then count zero on the device, because YOLO26's 4-channel box conv cannot be read by an edge decoder that requires a 64-channel DFL head. Pose and OBB, were they selected, would compile with the keypoint branch quietly amputated.

This map ends at a spec, and implementing the spec is a separate effort — but this particular hazard is live in the running form today, and the cost of leaving it there is a wasted training run plus a deployment that looks fine and counts nothing.

Decide: does the dropdown get an interim change now — removing or disabling the options known to be undeployable, with the reason shown — or does it wait and land as part of the contract?

Weigh: this is a three-line change to `apps/web/src/components/NewRun.tsx:18-29` against the risk of touching a surface the spec is about to redesign; and against the fact that the same knowledge, written only into a spec, protects nobody until the spec is implemented.

If the answer is "now", the change is deliberately minimal — no new mechanism, just fewer wrong choices — and [06](./06-fields-vs-escape-hatch.md) still owns the real design of how capability is expressed.

## Direction from the owner (2026-09-03)

**YOLO26 is not to be dropped — it gets its own compile pipeline.** Its 4-channel box head cannot use the on-chip `meta_arch=yolov8` NMS, so it needs the raw path plus a matching host-side decoder, which lives in `sack-detector-edge` and therefore needs a cross-repo contract (this repo explicitly does not own edge runtime decode — see `AGENTS.md`). Building that pipeline is its own effort, recorded under the map's Out of scope; the contract question it raises — that compile-capability is **per path**, not a yes/no — moves into [06](./06-fields-vs-escape-hatch.md).

**Still open, and narrower:** what do the `yolo26*` options do *until* that pipeline exists? Today they train, compile, report success, and count zero on the device. Options: leave them and accept the trap; disable them with "needs the YOLO26 pipeline" shown; or keep them selectable for training while the compile step refuses. Pose and OBB are a separate case — nothing has been decided for them, and they silently lose their keypoint branch.
