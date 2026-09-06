# 02 — What is one `evaluations` row?

Type: grilling
Status: open
Blocked by: —

## Question

The registry records how training *went*, never how the model *performed*. `run_metrics` is
`(run_id, step, name, value)` with that as its primary key
(`20260526100002_runs_and_metrics.sql`) — training curves only. It has no notion of footage,
no artifact link, and structurally **cannot hold a second measurement** of the same model,
because one value per name per step is all the key allows.

The number this team steers by — counted versus ground truth on real footage — has nowhere
to live. Decide the record that gives it one.

An evaluation is *(model artifact) × (clip) → (numbers, verdict)*. Settle:

- **Identity.** What makes two evaluations the same measurement versus two measurements?
  Re-running an identical config over an identical clip: new row, or replace?
- **What names the model.** `run_id`, `version_id`, `artifact_kind` (`pt` / `hef`) — and
  what happens for a model that was uploaded rather than trained here, which the Lab
  already supports (`Lab.tsx:572` offers registry / legacy / local model modes).
- **What names the footage.** A reference to the clip record from
  [03](./03-what-is-a-scenario-clip.md), plus the frame range actually processed — the Lab
  already has frame start / end / stride controls, so a partial run must not masquerade as
  a whole-clip result.
- **What numbers.** Counted, expected, missed, false, and the derived accuracy — flat
  columns, or `metrics jsonb`? Weigh: jsonb survives new metrics without a migration; flat
  columns can be queried and compared without agreeing on key names first.
- **The config that produced it.** The whole resolved counting config, or a hash plus a
  pointer? Two evaluations are only comparable if their configs can be shown to differ in
  exactly one place — the repo's "one changed lever per run" rule needs this to be
  mechanical, not remembered.
- **The verdict.** Free text, an enum, or absent — and who or what writes it.
- **Provenance, mandatory.** The parent `CLAUDE.md` provenance gate refuses to report a
  count whose source is assembled or whose fps was assumed. An `evaluations` row is exactly
  a reported count, so the gate has to be expressible in the record itself, not applied by
  convention afterwards.

The test this decision must pass: *"is this model better than the one deployed, on the
footage we care about"* should be one query, and the answer should carry the label saying
which artifact each side of the comparison was.
