# 07 — The portable `.hef` runner: what is its contract?

Type: grilling
Status: open
Blocked by: 02, 05

## Question

The owner's instruction: write the `.hef` evaluation as code that runs on **any** RPi +
Hailo-8L and can be cloned onto whichever box is free — not wired to one device.

The capability already exists and is proven. `cv-replay` runs the real `HailoBackend` over a
video file inside the sack-detector container, and was validated 2026-07-16 against five
onsite sessions, matching the business DB `countIn` within −1..−8. `edge003`
(Tailscale `100.122.220.50`) is the fleet's DEV device with `/dev/hailo0` present and six
containers healthy. So this is not a capability problem — it is a **plumbing** problem: that
run is tied to no `run_id` and its result is stored nowhere.

Settle the runner's contract:

- **Inputs.** How does a box that is handed nothing learn what to run — a job it pulls, or a
  command it is given? It needs a `.hef`, a clip, a counting config, and the identifiers that
  let its result become an `evaluations` row.
- **Outputs, and who writes them.** Does the runner write the evaluation directly (needs
  credentials on every box), or emit a signed result that the server records (needs a
  verification step)? Weigh against the fact that these boxes are DEV hardware handled by
  whoever is free.
- **Where the model comes from.** A `.hef` in R2 fetched by presigned URL, or an artifact
  already on the device? The device's own `/app/models/yolov11s.hef` is whatever was
  deployed, which is *not* necessarily the artifact under evaluation — and measuring the
  wrong artifact is this project's recurring bug.
- **Provisioning.** What must be true of a box before it can run one: docker, the container
  image, `/dev/hailo0`, HailoRT version. `edge004` has none of it — write the checklist that
  turns a bare Pi into an eval box, and decide whether that is a script or a document.
- **Isolation.** These are real devices on Tailscale; `edge003` is wlan0-only, so a test
  that touches networking severs its own SSH. Decide what an eval run is forbidden to touch,
  and whether a production device may ever be borrowed (default: no).
- **Determinism.** `cv-replay` reads every frame deterministically with no drop, which is
  what makes a replay count comparable. Whatever the runner does must keep that property and
  say so in the record.
