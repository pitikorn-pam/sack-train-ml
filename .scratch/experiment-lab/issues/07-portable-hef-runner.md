# 07 — The portable `.hef` runner: what is its contract?

Type: grilling
Status: resolved
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

## Answer

*(Taken on the recommendations, under the owner's directive to keep moving. The owner's own
framing settled the shape: "ทำเป็นโค้ดเผื่อไว้รันบน hardware rpi+hailo เลย เราอาจจะมีตัวทดลองอื่นที่ไม่ใช่
edge003 จะได้ clone ไปรันไว้ได้" — write it for any RPi + Hailo box, not for `edge003`.)*

**The runner is a worker that claims jobs from the queue [06](./06-what-is-a-suite-run.md)
already created. It is handed nothing and hardcodes no device.**

Launching a suite writes N `evaluations` rows at `status = 'pending'`. A box with
`/dev/hailo0` claims the ones where `artifact_kind = 'hef'`; the Mac claims the `'pt'` ones.
Multi-machine execution, resumability after a sleeping laptop, and "clone it onto whichever
box is free" are then the same mechanism, not three features.

### Inputs: pulled, never pushed

```
eval-runner --poll                 # claim the next pending hef evaluation
eval-runner --evaluation <id>      # or work one specific row
```

Everything else comes from the row: the artifact reference, the clip, the resolved counting
config, the engine version to run. The box needs no argument that encodes which box it is —
`runner_host` is filled from `hostname` at claim time.

### Outputs: the runner never holds an admin credential

The tension is real — these are DEV boxes handled by whoever is free, and `evaluations` is
admin-write under RLS with `service_role` bypassing it entirely. Putting a `service_role`
key on a shared Pi would hand every borrower the whole registry.

So neither option in the ticket, but the third one they imply: **two narrow edge functions
hold the key server-side, and the runner carries only a scoped runner token.**

- `claim-evaluation` — atomically moves one `pending` row to `running`, stamps `runner_host`
  and `started_at`, and returns the row plus short-lived presigned URLs for the artifact and
  the clip. Atomic so two boxes cannot claim the same row.
- `submit-evaluation` — accepts the result for a row **that this runner claimed**, writes the
  numbers, and is the single place `reportable` is ever set. The provenance CHECK constraint
  from [02](./02-what-is-one-evaluation.md) is the floor; this function is where the
  provenance block is assembled from facts the runner reported rather than from its say-so.

A borrowed box that is later returned or lost holds a token that can only finish work it
already claimed. That is the property worth paying an edge function for.

### The model comes from R2 and its bytes are checked before it runs

**Never the device's own `/app/models/*.hef`.** That file is whatever was last deployed,
which is precisely *not* the artifact under evaluation, and measuring a different artifact
than the one named is this project's recurring bug — the same bug the `artifact_sha256`
column exists to close.

So: download by presigned URL, hash it, and **refuse to run if the digest does not match
`artifact_sha256`**. Not a warning. The clip arrives the same way and is cached
content-addressed by its own sha256 ([03](./03-what-is-a-scenario-clip.md)), so a suite of
fourteen clips downloads each once and re-runs cost nothing.

### It runs the shared engine, not a re-implementation

The runner calls the lifted package from [05](./05-where-the-shared-engine-lives.md) with
`HailoBackend`; the Mac calls the same package with `UltralyticsBackend`. This is the whole
point, and it is what stops the runner from repeating cv-replay's mistake — cv-replay
hand-rolls passthrough at `cv_replay.py:199` while the fleet gates through `CrossingScorer`
with vetoes, so its confirmed count is not the device's. A runner built on that would
inherit the discrepancy and give it a database table to live in.

`engine_version` is recorded from the installed package, not from a constant in the runner.

### Provisioning: a script and a checklist, because a bare Pi is not an eval box

`edge004` is the proof that this needs writing down — it is a Raspberry Pi 5 in the fleet
with no `/dev/hailo*`, no docker, and no repo clone. The checklist:

| Requirement | Check |
|---|---|
| `/dev/hailo0` present | the runner refuses to start without it |
| HailoRT version | recorded into `metrics.runtime`, so a number can be traced to the runtime that produced it |
| docker + the detector image | the runner executes inside it, as `cv-replay` already does |
| the shared counting package, at the pinned ref | version reported at claim time |
| network reachability to the registry and R2 | checked once at startup, not per frame |

`scripts/provision_eval_box.sh` automates what can be automated and prints the rest.
The runner reports its whole environment into `metrics.runtime` rather than assuming
homogeneity — two Pis with different HailoRT builds are two different measurements, and the
row should say so instead of hiding it.

### What an eval run is forbidden to touch

These are real devices on a live tailnet. `edge003` in particular is **wlan0-only**, so a
test that touches networking severs its own SSH — the fleet registry says so explicitly.

- **Never** the camera, MQTT publishing, the device's `app.db`, the network configuration,
  or the deployed `docker-compose` stack.
- **Production devices are never borrowed.** `edge001` and `edge002` are production;
  `edge003` is the DEV box. Rather than encode that list — which would recreate exactly the
  device-specific hardcoding the owner asked to avoid — the runner **refuses to start if a
  detector container is already running on the box**. That is mechanical, it travels to any
  new device automatically, and it fails in the safe direction.

### Determinism, and how the row proves it

`cv-replay` reads every frame deterministically with no drop, which is what makes a replay
count comparable at all. The runner keeps that property and makes it checkable rather than
promised: it records `frames_read`, and for a whole-clip evaluation asserts
`frames_read == clips.frame_count`. A short read sets `status = 'failed'`, never a number.

That is the same rule as everywhere else on this map — an unclean finalization state is not
a result — expressed at the one place it can actually be enforced.
