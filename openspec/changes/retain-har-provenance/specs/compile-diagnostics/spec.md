## ADDED Requirements

### Requirement: Isolated successful-stage evidence
The system SHALL create an exclusive attempt before launching the compiler and SHALL journal native/parsed HAR, quantized HAR and HEF only after the corresponding operation succeeds and writes complete. Full-precision optimization SHALL be not_used for the current recipe.

#### Scenario: Interrupted HAR save
- **WHEN** save_har writes bytes then raises
- **THEN** the stage is not completed and its incomplete HAR is excluded from the ready diagnostic ZIP

#### Scenario: Optimization and compilation failure
- **WHEN** optimization fails after native save or compilation fails after quantized save
- **THEN** earlier completed HARs are retained and compile outcome remains partial

#### Scenario: Child cannot start
- **WHEN** process launch or SDK import fails
- **THEN** initial identity and available redacted logs remain without fabricated HAR stages

### Requirement: Measured and bounded provenance
The manifest SHALL include source/result hashes, timestamps, run/attempt/model/target identity, requested options, measured SDK version or explicit unknown, exact generated/applied script and calibration names/count/order/hashes with unchanged preprocessing. Source hash mismatch MUST fail closed. SDK-adjusted settings MUST remain unknown unless measured. ZIPs MUST omit source weights, calibration image bytes, environment/auth dumps and duplicate HEF bytes.

#### Scenario: Requested count exceeds available count
- **WHEN** 512 images are requested but only three selected images exist
- **THEN** actual count is three with the original sorted selection order, decoded-byte hashes and unchanged tensors

#### Scenario: Supplied source hash disagrees
- **WHEN** supplied source ONNX hash differs from measured bytes
- **THEN** no SDK launch occurs and a truthful partial diagnostic reports mismatch

### Requirement: Archive readiness and persistence are separate
The parent SHALL finalize logs/manifest after child exit and construct ReadyArchive only after ZIP completion, validation and hashing. Archive failure MUST surface a retention error and preserve the attempt. External receipts SHALL link the immutable ZIP hash to actual persistence outcomes/keys.

#### Scenario: ZIP or upload fails
- **WHEN** ZIP validation or diagnostic upload fails
- **THEN** local earlier evidence survives, the requested compile flow fails, and no nonexistent remote artifact is registered

#### Scenario: Compile and persistence both fail
- **WHEN** the SDK fails and diagnostic upload also fails
- **THEN** both failures are reported without changing partial compile into success

### Requirement: Existing artifact retrieval and durable destinations
The system SHALL add exactly one compile_diagnostics artifact kind to existing consumers, upload ready diagnostics for success and partial failures using unique attempt stems, and include them in local retained release output. Colab compile SHALL use the mounted Drive output destination and the same package helpers; verification SHALL use the exact current HEF path. Real reload and durable persistence SHALL remain UNVERIFIED until authorized execution supplies evidence.

#### Scenario: Retry and staging cleanup
- **WHEN** a new compile invocation occurs and disposable calibration staging is removed
- **THEN** previous attempt HAR/ZIP bytes remain unchanged outside staging with distinct local and remote identities

#### Scenario: Models retrieval
- **WHEN** a version contains compile_diagnostics.key
- **THEN** Models exposes the existing diagnostic download action for that actual key
