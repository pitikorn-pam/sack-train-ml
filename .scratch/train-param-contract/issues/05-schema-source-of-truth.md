# 05 — Where does the parameter schema live, and how does it reach both TypeScript and Python?

Type: grilling
Status: open
Blocked by: 04

## Question

The defaults exist twice and nothing links them: `DEFAULT_HP` in `apps/web/src/components/NewRun.tsx:45-51` and `DEFAULT_TRAIN_KWARGS` in `src/sack_train_ml/training.py:22-33` currently agree on epochs/imgsz/batch/patience/lr0 by coincidence, not by construction. The `optimizer: "AdamW"` added in `367fe15` exists only on the Python side — the form cannot show a value it does not know about, which is precisely the *silent default* this effort exists to kill.

Where does one authoritative description of the parameter surface live, and how does it reach a React form, a Deno edge function, and a Python pipeline without hand-syncing?

Options to weigh: a JSON Schema file in the repo consumed by all three; generating TS types from a Python definition (or the reverse); a schema module published to both runtimes; or a database-held schema. Consider also *what* the schema must carry beyond names and types — defaults, ranges, units, help text (the form already hand-writes hints, e.g. `NewRun.tsx:338`), which parameters are compile-relevant versus train-relevant, and which model families each applies to (see [03](./03-model-catalogue.md)).

The test this decision must pass: adding one new tunable parameter should be a single edit, and it should be impossible for the form to disagree with what the pipeline runs.

**Sharpened by [06](./06-fields-vs-escape-hatch.md).** Every field must carry a **default** and **help text saying what it does and what it affects** — the owner asked for this explicitly, as the "i" tooltip beside each control. That makes help text part of the schema rather than of the markup, because the same explanation has to be true in the form, in the effective-config preview, and in whatever records the run. The schema must also carry each parameter's **category** (field / advanced / derived / refused), since "derived" and "refused" are behaviours the form has to render, not conventions a developer remembers.

Depends on [04](./04-where-validation-lives.md) — where validation is enforced determines which runtimes need the schema.
