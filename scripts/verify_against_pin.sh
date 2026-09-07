#!/usr/bin/env bash
# =============================================================================
# verify_against_pin.sh — prove the schema matches the ultralytics the contract pins
# =============================================================================
# The problem this solves: `tests/test_contract.py` compares the schema against the
# ultralytics that happens to be INSTALLED, and downgrades a version mismatch to a
# warning rather than a failure — honestly, because a green tick must not imply more
# than it earned. But the consequence is that conformance can be "proven" against a
# version nobody ships, and the pin exists precisely because the Muon defect lived in
# exactly one upstream release.
#
# Rather than rewrite the developer's working virtualenv to find out, this builds a
# throwaway one, installs the pinned version into it, and runs the conformance checks
# there. Nothing outside $VENV_DIR is touched.
#
#   ./scripts/verify_against_pin.sh
#   VENV_DIR=/tmp/mine ./scripts/verify_against_pin.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${VENV_DIR:-${TMPDIR:-/tmp}/sack-train-ml-pinned-venv}"

PINNED="$(python3 - "$REPO_ROOT/contracts/param-schema.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))["toolchain"]["ultralytics"])
PY
)"

echo "contract pins ultralytics==$PINNED"
echo "building a throwaway venv at $VENV_DIR (nothing else is modified)"

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -q --disable-pip-version-check "ultralytics==$PINNED" pytest

cd "$REPO_ROOT"
"$VENV_DIR/bin/python" - <<'PY'
import sys
sys.path.insert(0, "src")
import ultralytics
from sack_train_ml import contract

pin = contract.check_toolchain_pin()
if pin:
    raise SystemExit("the throwaway venv does not hold the pinned version: " + "; ".join(pin))

problems = contract.check_against_ultralytics()
if problems:
    print("the schema has drifted from the PINNED ultralytics:")
    for p in problems:
        print("  -", p)
    raise SystemExit(1)

print(f"schema conforms to ultralytics {ultralytics.__version__} — the version the contract pins")
PY

"$VENV_DIR/bin/python" -m pytest tests/test_contract.py tests/test_compile_contract.py -q

echo
echo "OK — conformance proven against the pinned version, not against whatever was installed."
echo "To make your own environment match: pip install -e ."
