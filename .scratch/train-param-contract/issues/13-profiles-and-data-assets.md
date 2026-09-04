# 13 — Saved profiles, and datasets you upload once

Type: grilling
Status: resolved
Blocked by: 06

## Question

Two requests that turn out to be the same shape: settings saved as reusable **profiles**
(like the built-in presets, but yours), and datasets **uploaded once and picked again**
rather than re-uploaded per run.

## Answer

### One concept, three uses

"A named parameter set for a form" already exists three times: the built-in presets
(Quick test / Balanced / Full training), the compiler profile (`yolo11-det-h8l-v3`,
already versioned in its name), and now user-saved profiles. They unify — a built-in
preset is simply a profile that ships with the app.

### Profiles are immutable and versioned, *and* runs keep a full snapshot

The trap this avoids: a run recorded as `preset: Balanced` becomes a lie the moment
someone edits Balanced from 250 epochs to 400. Nothing warns, and every past run's
record silently changes meaning — the same class of drift this whole map exists to kill.

So both defences, not one:

- Editing a profile creates a new version (`Balanced v2`); the old one stays.
- A run stores its **fully resolved effective config** regardless, as already required
  by [07](./07-provenance-effective-config.md). The profile name is a convenience label,
  never the source of truth — a run stays self-describing even if its profile is deleted.

### A profile holds tunables only

Hyperparameters and compile options; **not** the dataset, the checkpoint or the run name.
The point is "this way of training, applied to whatever data" — binding a dataset into it
would make it unreusable. Storing only the delta from defaults was rejected: a delta-based
profile silently changes meaning when a default changes.

### Bound to a model line

Values that suit the sack detector need not suit another line, and a second model line is
the stated direction. Copying a profile to another line is allowed; inheriting silently is not.

### One table, with built-ins seeded by migration

All profiles live in Supabase, built-ins included, seeded by a migration so they remain
reviewable in git. The alternative — built-ins in the repo, user profiles in the table —
forces the form to merge two sources, rank them, and answer what happens when a saved
profile shares a built-in's name. One table means one code path, one uniqueness rule and
one versioning mechanism. The cost is that the dev-only `?preview=1` mode cannot list
profiles without a session, which is acceptable.

### Datasets and calibration sets are the same kind of thing

"Upload once, reuse" is exactly the shape already decided for calibration sets in
[08](./08-compile-notebook-and-recompile-flow.md): a named, hashed artifact referenced by
key rather than a path. Datasets differ only in carrying splits and classes. They therefore
share one table with a `kind` discriminator and a JSON `stats` column for the kind-specific
parts, which keeps a single upload path, a single picker and a single retention story.

Consequence for the form: `DatasetUploader` becomes *pick an existing dataset, or upload a
new one* — and the upload registers it for reuse instead of belonging to one run.
