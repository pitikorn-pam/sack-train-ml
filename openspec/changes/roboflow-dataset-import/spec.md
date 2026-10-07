# Roboflow dataset source — direct on Colab

## Dataset selection and request contract

New run offers Upload files and Paste Roboflow code as separate dataset sources.
Files JSON remains `dataset: string`, optional `dataset_bundle`, and `classes: string[]`.
Roboflow JSON uses `dataset_source` with exactly `kind: roboflow`, `workspace`, `project`, positive safe integer `version`, and `format: yolov8 | yolov11`.
Roboflow creation omits `dataset`, `dataset_bundle`, and `classes` because classes are resolved on Colab.
The web form and cloud validator share `contracts/dataset-source.ts`.
References containing unknown fields or credential fields are rejected.

The standard four-assignment notebook snippet, optional import, and conventional installer are parsed locally as literal data.
The parser never executes Python or requests dataset bytes.
The Roboflow branch never invokes upload-dataset or uploads dataset files to R2.
The raw snippet and key are cleared on parsing, including failure, cancellation, and source changes.
Known keys cannot appear in the returned source metadata.
Neither snippets nor keys enter browser persistence, configs, or error messages.
Changing sources clears stale selection, and failed parsing or cancellation blocks creation.
Late saved-dataset loading cannot hide an active new-dataset editor.

Files upload keeps its existing presigned R2 flow and pending-state protection.
Saved files datasets load their YAML to restore ordered classes.
Cloning a Roboflow run preserves the reference and defers classes again.
Run detail and config preview display a readable reference label.
No local Roboflow download API is required.

## Colab preparation and training

The notebook calls the network adapter in `src/sack_train_ml/roboflow.py`.
It obtains `ROBOFLOW_API_KEY` from Colab Secrets or hidden input through `getpass`.
Credentials remain in memory and explicit adapter arguments, not environment variables, subprocess arguments, or registry fields.
Roboflow dataset bytes go directly to `/content/datasets/<run-id>/<attempt-id>/roboflow`, not through the Mac, browser, or R2.
The notebook invalidates cached package modules after syncing the repository so subsequent imports use the synchronized implementation.

The adapter rejects source metadata containing the supplied key before downloads or staging.
It polls export preparation within a deadline, validates HTTPS hosts and redirects, and bounds ZIP and expanded sizes.
It rejects path traversal, duplicate paths, symlinks, unsafe YAML hooks, and credentials in archive contents or decoded YAML.
Cross-host redirects and storage export URLs carrying decoded API-key query parameters are refused.
Transport failures return generic errors with chained exceptions suppressed.
Extraction uses a fresh staging directory before publishing a source marker and normalized local YAML.

Class names come only from YAML list order or contiguous integer mapping IDs starting at zero.
Empty, duplicate, or invalid names, duplicate YAML keys, invalid IDs, and inconsistent `nc` are rejected.
No placeholder classes or project-metadata class inference are used.
The training loader requires a prepared directory matching the selected source before constructing `RunConfig`.
It persists resolved classes through a checked optimistic config update that preserves other fields.
A refused update or concurrent config change aborts before training starts.
Source metadata and ordered names remain traceable in effective config, release manifests, and version metadata.
Manual local-directory and R2 YAML/ZIP flows remain supported.
A manual override cannot replace a selected Roboflow source.

## Verification and publication boundary

Python and Vitest regressions cover parser safety, credentials, class order, prepared-directory binding, checked registry updates, provenance, delayed dataset loading, and manual compatibility.
Notebook code is syntax-checked and its import fragment is tested without executing training.
Isolated browser checks intercept remote requests and verify source-only config, secret clearing, source switching, and zero Roboflow dataset uploads.

Run local checks with `python -m pytest -q`, `npm test` from `apps/web`, and `npm run build` from `apps/web`.
Live Colab execution, authenticated Roboflow exports, native Deno, and PostgREST persistence or concurrency remain unverified.
Publishing the notebook and code to GitHub does not deploy the Supabase function.
The `start-training` function must be deployed separately to accept Roboflow source requests.
No real training or deployment is performed as part of these checks.
