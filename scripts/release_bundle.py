#!/usr/bin/env python3
"""Not an entry point. Release bundles lives elsewhere.

This was a scaffold that printed "TODO" and exited 0, which is the worst of both: it
looked like a command that had run and done nothing. It refuses now, and says where the
real thing is.

A bundle is assembled from a run's uploaded artifacts and its manifest. Built by
hand it would carry names and hashes nothing verified.

    src/sack_train_ml/release.py::assemble_bundle (called by train_for_run.py step 7)
"""
import sys

MESSAGE = """release_bundle.py is not an entry point and never became one.

Release bundles lives at:
    src/sack_train_ml/release.py::assemble_bundle (called by train_for_run.py step 7)

A bundle is assembled from a run's uploaded artifacts and its manifest. Built by
hand it would carry names and hashes nothing verified.

See README.md and docs/testing.md."""

if __name__ == "__main__":
    print(MESSAGE, file=sys.stderr)
    raise SystemExit(2)
