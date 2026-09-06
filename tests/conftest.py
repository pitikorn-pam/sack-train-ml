"""Put `src/` on the path so tests import the package without installing it.

Mirrors what `scripts/train_for_run.py` does, and keeps `pytest` runnable in a venv
that has not had `pip install -e .` — which would otherwise pull the pinned
ultralytics over whatever is already there.
"""
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
