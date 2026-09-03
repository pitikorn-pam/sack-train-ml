# sack-train-ml

The training-side pipeline for BSCP sack detection: a model is trained on Colab, exported to ONNX, and compiled to a Hailo-8L `.hef` that the edge device runs. This glossary fixes the vocabulary for how a training run is described, launched, and traced.

## Language

**Lab**:
The platform as a whole — the web app, the registry behind it, and the executors it drives. Its job is to make training and compiling a model something you configure, launch and compare, rather than something you hand-run.
_Avoid_: the dashboard, the webapp

**Replay**:
The tool that re-runs a recorded video through the counting pipeline to inspect what the model and counter did, frame by frame. It is one instrument inside the Lab, not the Lab itself — it was called "Lab" before that name was given to the platform.

**Executor**:
Wherever a run's training actually happens. Today that is a Google Colab session driven by a launcher notebook; the Lab holds the configuration, the executor only borrows it for the duration of a run.

**Model line**:
A named lineage of models that serve the same purpose on the same target, e.g. `yolo11s-sack-hailo8l`. Runs belong to a model line; versions are promoted within it.

**Run**:
One parameterised execution — a config, what it emitted while working, and the artifacts it produced. Runs come in kinds.

**Train run**:
A run that fits a model, producing `.pt` and `.onnx`.

**Compile run**:
A run that turns a train run's `.onnx` into a `.hef` for a target device. It names the run it consumes as its **source run**, so a model can be compiled several ways without being retrained.

**Launcher**:
The notebook that starts a run on an executor. It receives a run id and nothing else — configuration is read from the registry, never held in the notebook.

**Run config**:
The stored JSON description of what a run should do: dataset, classes, source weights, hyperparameters, export options and compile options. Written once when the run is created, then read by both the notebook and the pipeline.
_Avoid_: settings, params blob

**Requested config**:
The run config exactly as submitted by the person launching the run.

**Effective config**:
The values the pipeline actually called training and compilation with, after defaults were merged in. It differs from the requested config wherever a default filled a gap — which is why only the effective config can be trusted as a record of what happened.
_Avoid_: final config, resolved params

**Silent default**:
A value that changes a run's outcome without appearing anywhere the person launching it can see. Named after ultralytics' `optimizer="auto"` selecting an experimental optimizer that no one had chosen and no one could see.

**Parameter contract**:
The guarantee that a parameter offered in the form is the parameter the pipeline honours, and that nothing outside that surface alters the outcome.

**First-class field**:
A parameter given its own labelled control, validation and help text in the form, because changing it is a normal part of an experiment here.

**Escape hatch**:
The free-form area for parameters with no first-class field, checked against the real argument list before a run is accepted.

**Compile-capable model**:
A checkpoint this repo can carry all the way to a Hailo-8L `.hef`. Everything else is **train-only** — trainable, but never producing an edge artifact.
_Avoid_: supported model

**Calibration set**:
The images a compile run measures the model's activations against in order to quantize it. A named, stored artifact addressed by key — never a filesystem path, because two compiles can only be compared if they can be shown to have used the same images.

**Proof-grade calibration set**:
A calibration set sampled from the run's own training data. Enough to prove the compile pipeline works end to end; not enough to trust the resulting INT8 accuracy.

**Production calibration set**:
A calibration set drawn from the deployment domain — real frames from the edge camera, in the conditions the model will actually meet.
