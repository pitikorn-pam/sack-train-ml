# 05 — Where does the shared counting engine live, and how is it packaged?

Type: grilling
Status: open
Blocked by: 01

## Question

Decided already: the Lab and the device count with **the same engine**, and the Lab's
centroid tracker (`webui/lab_core.py:61`) is retired rather than kept as a second mode.
Undecided: where that engine physically lives, who owns it, and how three consumers get it.

The consumers are the Mac (`.pt` via ultralytics, `device=mps`), a Pi + Hailo-8L (`.hef` via
`HailoBackend`), and the existing `cv-*` CLI skills in `loom-oracle`. The candidates:

- **Stays in `sack-detector-edge`**, imported by the others. Matches `AGENTS.md`, which says
  this repo does not own edge runtime code — but it makes `sack-train-ml` depend on a repo it
  does not control, and the Lab's release cadence is not the device's.
- **Extracted to its own package**, depended on by both. Honest about the shared ownership;
  costs a third repo, a versioning story, and a release step on the critical path of edge
  deploys.
- **Vendored into `sack-train-ml`**, with the device importing it back. Inverts the current
  ownership rule and needs that rule renegotiated.
- **Copied.** Cheapest today, and it recreates exactly the divergence this map exists to fix
  — the current mess is two copies of counting logic that drifted apart.

Whatever wins must answer:

- **The backend interface.** [01](./01-lift-the-edge-counting-stack.md) reports where the
  seam can go. Settle its shape: what a detection backend must provide so `.pt` and `.hef`
  are interchangeable, and what the engine is allowed to assume about the frames it gets.
- **Config, in one vocabulary.** Today the Lab's "Match threshold" means pixels and the
  device's means IoU. One schema, one set of units, one set of defaults — extending the
  `contracts/param-schema.json` pattern (one JSON, three readers) rather than inventing a
  second mechanism.
- **Which defaults are authoritative**, given that POC parameters and deployed runtime
  values are known to differ (conf 0.60 vs 0.70, dedup 120/25 vs 300/50), and that the
  *running container* is the authority on what is deployed.
- **What proves the two paths agree.** A test that runs one clip through the Mac path and
  the device path and asserts the events match — otherwise "one engine" is a claim, and this
  map has already retracted one of those.

Blocks [07](./07-portable-hef-runner.md) and [09](./09-where-the-lab-runs.md).
