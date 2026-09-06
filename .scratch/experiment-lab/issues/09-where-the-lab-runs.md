# 09 — Where does the Lab run, and what is its relationship to the `cv-*` CLI skills?

Type: grilling
Status: open
Blocked by: 05, 06

## Question

Two questions that turn out to be one, because both are about which machine holds the truth.

**Where it runs.** `apps/api/lab_server.py` serves `/api/lab/*` on `127.0.0.1:8077` with
`device_default: "mps"` — the most valuable analysis surface in the product is available to
one person and disappears when that Mac sleeps. A suite run
([06](./06-what-is-a-suite-run.md)) over a whole clip library makes this sharper: it is long,
it is repeatable, and it should survive a closed laptop. Weigh: stay local (heavy video
processing where the hardware and the files are); move server-side (available to everyone,
but GPU cost and clip upload become real); or hybrid — results, comparison and queue in the
cloud, processing wherever the hardware is, which is already forced by
[07](./07-portable-hef-runner.md), since `.hef` can only run on a Pi.

**The `cv-*` skills.** A complete failure-driven loop already exists in `loom-oracle`:
`cv-track` → `cv-analyze` → `cv-replay` → `cv-review` → `cv-missfind` → `cv-harvest` →
`cv-upload`. It is the loop that actually improves the model, it is where ground truth and
deploy-truth replay already live, and **none of it is connected to a `run_id` or a
`version`** — a harvested frame cannot answer "which model missed this, and did the next one
fix it?"

Decide the relationship: absorb the loop into the Lab; keep the CLI and have both write to
one `evaluations` table; or retire the CLI. Consider that these tools are how the owner and
the sibling Oracles actually work today, that they carry the provenance gate
(`_cv_lib/provenance.py::assert_reportable`) which the Lab does not yet have, and that
`cv-replay` is the proven `.hef` path [07](./07-portable-hef-runner.md) is built on.

Whatever wins must say **which component owns the provenance gate** once counts can be
produced by a web app, a CLI, and a Pi — three producers, one refusal rule.

The last part of this ticket produces the **build order**: with every decision on this map
settled, the sequence in which the pieces get built, so implementation starts without
re-deciding anything. That is where this map ends.
