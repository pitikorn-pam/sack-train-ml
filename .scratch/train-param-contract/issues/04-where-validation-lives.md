# 04 — Which layer refuses a bad config?

Type: grilling
Status: open
Blocked by: 01

## Question

Today nothing rejects a bad config. Verified at all three layers: the form checks four fields for presence only (`apps/web/src/components/NewRun.tsx:151-159`), the edge function checks only that `config` is an object (`supabase/functions/start-training/index.ts:47`), and Python casts with `.get(key, default)` and splats `hyperparameters` into `model.train(**kwargs)`. A typo'd key or an out-of-range value surfaces 20+ minutes later, inside a Colab session, as an ultralytics stack trace.

Where does validation live, and what exactly does each layer owe?

- **Browser only** — instant feedback, but bypassable and duplicated if anything else ever creates a run.
- **Edge function `start-training`** — the single choke point every run passes through; nothing reaches the database unvalidated. But feedback arrives only on submit, and the schema has to exist in Deno.
- **Python at run start** — closest to the truth (it can check against the *installed* ultralytics), but only after Colab has booted, which is exactly the cost we are trying to avoid.
- **Layered** — one shared schema enforced at more than one point, each layer catching what it is best placed to catch.

Settle also: is a run allowed to exist in the database in an invalid state at all? And which failures are *rejections* versus *warnings* (a valid-but-unwise config, e.g. `opt_level: 2` against a training-split calibration set)?

Depends on [01](./01-ultralytics-train-args.md): if ultralytics exposes its valid argument names programmatically, the Python layer can validate a free-form escape hatch honestly, and the browser can only approximate it.
