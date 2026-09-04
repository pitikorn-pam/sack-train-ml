# 04 — Which layer refuses a bad config?

Type: grilling
Status: resolved
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

## Answer

### Two kinds of validation, two homes

The question dissolves once the two are separated:

- **Static validation** — does this key exist, is the value in range, do the cross-field rules hold. Needs no ultralytics and no GPU, so it can run anywhere.
- **Environment validation** — does the *installed* ultralytics accept this, does the checkpoint download, does the dataset resolve, is there a GPU for `optimization_level=2`. Can only run where the environment is, which is Python at run start.

They are not competing answers. They check different things and both are required.

### The edge function is the authority for static validation

`start-training` is the choke point every run passes through, so it is the only place that can guarantee **nothing invalid ever reaches the database**. The browser mirrors the same checks for instant feedback, but it is a convenience, not the gate — a stale tab or any other client that creates a run must not be able to slip past.

### The edge function also resolves the effective config

More consequential than where checking happens, because **the resolved values are what gets stored and recorded**. If the browser resolved them, two clients on different versions would produce different effective configs from identical input.

An honesty constraint comes with it: **defaults exist in two layers.** Ours — `epochs 100`, `optimizer AdamW` — resolve server-side and can be shown truthfully in the pre-launch preview. Ultralytics' own defaults for the remaining ~100 keys are knowable only where ultralytics is installed, so the preview cannot claim them; the run records them afterwards. The stored record therefore carries **both** the requested config and the effective one, and the run adds the final layer (see [07](./07-provenance-effective-config.md)).

### An environment failure feeds the next run's preflight

Environment checks can only fail after Colab has booted — that cost is unavoidable. What is avoidable is paying it twice. So a failure records the environment facts it discovered (the ultralytics version actually installed, whether a GPU was present) back into the registry, and the next run's preflight warns *before* launch. That is the same mechanism that turns "`opt_level: 2` with no GPU" from a wasted session into a warning on the form.

### A run is valid from birth; drafts hold everything else

No invalid run may exist. The `draft` state — already present in the accepted design as "Save draft" — holds anything, complete or not. The line is clean: **a draft can be anything, a run is valid by construction**, so "was this run ever invalid?" needs no special state to answer.
