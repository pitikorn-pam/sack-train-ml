#!/usr/bin/env python3
"""Not an entry point. Onnx export lives elsewhere.

This was a scaffold that printed "TODO" and exited 0, which is the worst of both: it
looked like a command that had run and done nothing. It refuses now, and says where the
real thing is.

Export happens inside a run so the artifact's sha256 is recorded against it. An
ad-hoc export produces a file the registry has never seen.

    src/sack_train_ml/export_onnx.py (called by train_for_run.py step 5)
"""
import sys

MESSAGE = """export_onnx.py is not an entry point and never became one.

Onnx export lives at:
    src/sack_train_ml/export_onnx.py (called by train_for_run.py step 5)

Export happens inside a run so the artifact's sha256 is recorded against it. An
ad-hoc export produces a file the registry has never seen.

See README.md and docs/testing.md."""

if __name__ == "__main__":
    print(MESSAGE, file=sys.stderr)
    raise SystemExit(2)
