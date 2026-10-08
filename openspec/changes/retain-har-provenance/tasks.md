## 1. Offline contract and implementation

- [x] 1.1 Write failing fixture tests before introducing the diagnostics module.
- [x] 1.2 Implement exclusive attempts, atomic stage journals, measured hashes/calibration and validated ZIP finalization.
- [x] 1.3 Integrate successful-save evidence into the unchanged SDK recipe and migrate wrapper/CLI return and error contracts.
- [x] 1.4 Persist ready diagnostics independently on success/partial failure using existing uploader and external receipts; include local release output/metadata.

## 2. Retrieval and notebook integration

- [x] 2.1 Synchronize the artifact schema, Python Literal, shared TS, download key regex/tests and Models list.
- [x] 2.2 Use the same helpers in compile notebook at mounted Drive with exact-attempt verification and failure-safe logs.
- [x] 2.3 Add train notebook retrieval instructions while preserving all manual-dataset QA code/output cells.
- [x] 2.4 Document local CLI/retention/retrieval and supported future SDK HAR constructor without executing it.

## 3. Verification and handoff

- [x] 3.1 Generate prominently labeled offline sample with valid calibration fixture images and computed archived digests.
- [x] 3.2 Run focused fixture tests and web suite/production build with env-file loading disabled.
- [x] 3.3 Finish safe Python suite, protected-hash/notebook-cell checks and implementation evidence report.

Real SDK reload, native Deno/live Supabase, Colab Drive and live R2 persistence require separately authorized execution and are UNVERIFIED, not tasks executed in this change.
