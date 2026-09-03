# 07 — What records the effective config, and where?

Type: grilling
Status: open
Blocked by: 05

## Question

Third leg of the bar: the values a finished run actually used must be readable afterwards.

The distinction that matters is **requested config** (what the person filled in) versus **effective config** (what `model.train()` and the compile were finally called with, after defaults were merged). Recording only the requested config would not have caught the Muon incident at all — `optimizer` was never requested by anyone; it arrived from ultralytics' own `"auto"` behaviour. So provenance has to be captured at the point of the call, not at the point of submission.

Decide:

1. **What is captured** — merged kwargs as passed, plus the environment that resolved them (ultralytics version, DFC version, git sha, dataset identity, seed). The parent `CLAUDE.md` already requires logging dataset version, training config, seed, eval split and metrics; this ticket makes that mechanical rather than aspirational.
2. **Where it is stored** — the Supabase run row, the run's artifacts, `*.hef.meta.yaml` (which today records only compile-side facts: `hailo_pipeline.py:273-292`), or more than one of these.

   *Simplified by [08](./08-compile-notebook-and-recompile-flow.md):* now that a compile is its own run, a HEF's provenance is simply **its own run's record**, joined back to training through `source_run_id` — instead of one run row trying to describe two different executions. The drift worry disappears; what replaces it is deciding how much of the training run's context a compile run should copy versus link to.
3. **Whether it is surfaced in the UI**, and where — the run detail page is the obvious home, and the same record is what a preview step would show *before* launching.
4. **Whether an INT8-vs-FP32 measurement travels with a published HEF.** In scope only as a requirement that the record exists; designing the gate itself is explicitly out of scope for this map.
