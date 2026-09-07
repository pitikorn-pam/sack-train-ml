#!/usr/bin/env python3
"""Not an entry point. Training lives elsewhere.

This was a scaffold that printed "TODO" and exited 0, which is the worst of both: it
looked like a command that had run and done nothing. It refuses now, and says where the
real thing is.

Training is driven by a registry run, not by a bare script: the config comes from
the `runs` row so that what ran can be read back afterwards. A script that trains
from local arguments would produce a model nothing can account for.

    scripts/train_for_run.py --run-id <id>
"""
import sys

MESSAGE = """train_yolo.py is not an entry point and never became one.

Training lives at:
    scripts/train_for_run.py --run-id <id>

Training is driven by a registry run, not by a bare script: the config comes from
the `runs` row so that what ran can be read back afterwards. A script that trains
from local arguments would produce a model nothing can account for.

See README.md and docs/testing.md."""

if __name__ == "__main__":
    print(MESSAGE, file=sys.stderr)
    raise SystemExit(2)
