.PHONY: help test test-py test-web test-edge test-contract build web-dev verify-pin

# Targets that cannot be honoured are not listed. Six used to echo "TODO" and exit 0,
# which is worse than their absence: `make train` looked like it ran.
#
# Training and compiling are not `make` targets and never will be. A run is created in
# the web app and executed by Colab against the registry, which is what makes the
# executor swappable; a Makefile entry point would be a second way to start a run that
# does not record one.

# A git worktree has no .venv of its own, so this is overridable rather than assumed:
#   PYTHON=../../.venv/bin/python make test-py
PYTHON ?= .venv/bin/python

help:
	@echo "sack-train-ml"
	@echo
	@echo "  make test           run every suite (see docs/testing.md)"
	@echo "  make test-py        pytest"
	@echo "  make test-web       vitest"
	@echo "  make test-edge      deno test (edge functions)"
	@echo "  make test-contract  the server-side validator's own checks"
	@echo "  make build          production build of apps/web"
	@echo "  make web-dev        apps/web dev server on :5173"
	@echo "  make verify-pin     conformance against the PINNED ultralytics"
	@echo
	@echo "Training and compiling are not make targets: a run is created in the web app"
	@echo "and executed by Colab against the registry. See README.md."

test: test-py test-contract test-web test-edge
	@echo
	@echo "Done. If the edge suite reported SKIPPED above, it did not run —"
	@echo "that is 25 tests, and they are not optional before a release."

test-py:
	@test -x "$(PYTHON)" || { \
	  echo "No interpreter at $(PYTHON)."; \
	  echo "Either create one — python3 -m venv .venv && .venv/bin/pip install -e . —"; \
	  echo "or point at an existing one: PYTHON=/path/to/python make test-py"; \
	  echo "(a git worktree has no .venv of its own; use the main checkout's)"; \
	  exit 1; }
	"$(PYTHON)" -m pytest tests/ -q

test-contract:
	node contracts/verify-contract.mjs

test-web:
	cd apps/web && npm test

test-edge:
	@# One shell, one decision. Each recipe LINE is its own shell, so an `exit 0` in a
	@# guard line ends that line successfully and the next one runs anyway — which is
	@# exactly what the first version of this did.
	@if command -v deno >/dev/null 2>&1; then \
	  deno test --allow-read --allow-env --no-check supabase/functions/; \
	else \
	  echo "SKIPPED: deno is not installed, so the edge-function suite did not run."; \
	  echo "  install: curl -fsSL https://deno.land/install.sh | sh"; \
	  echo "  (25 tests — the auth boundary, the artifact allow-list, and the compat"; \
	  echo "   signature's parity with Postgres. Not optional before a release.)"; \
	fi

build:
	cd apps/web && npm run build

web-dev:
	cd apps/web && npm run dev

verify-pin:
	./scripts/verify_against_pin.sh
