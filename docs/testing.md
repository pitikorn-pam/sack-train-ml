# Running the tests

Five suites, four runtimes.
Run them from the repository root unless a command says otherwise.

| # | Suite | Command | Green baseline |
|---|---|---|---|
| 1 | Python pipeline | `.venv/bin/python -m pytest tests/ -q` | `49 passed, 2 warnings` |
| 2 | Parameter contract (server-side validator) | `node contracts/verify-contract.mjs` | `11 checks, all passing`, exit 0 |
| 3 | Web type gate + production build | `cd apps/web && npm run build` | exit 0, `1817 modules transformed` |
| 4 | Web unit + component | `cd apps/web && npm test` | `3 passed (3)` files, `25 passed (25)` tests |
| 5 | Edge functions (Deno) | `deno test supabase/functions/_shared/` | `7 passed \| 0 failed` |

All five must pass before anything is merged.
Suite 3 is a test in its own right, not just a build: `tsc -b` type-checks every file under `apps/web/src`, and the `.test.ts`/`.test.tsx` files live there, so a test file that stops compiling breaks the build.

---

## 1. Python pipeline

```bash
.venv/bin/python -m pytest tests/ -q
```

Expected: `49 passed, 2 warnings in ~2s`.

One of the two warnings is load-bearing and is expected on a machine that has not run `pip install -e .`:

> `tests/test_contract.py:70: UserWarning: conformance ran against ultralytics 8.4.56, not the pinned version — ultralytics 8.4.56 installed, contract pins 8.4.138.`

It means the contract conformance test checked against whatever ultralytics is installed rather than the pinned version.
It is a warning, not a failure. To check the pin itself, run `pip install -e .` first.

## 2. Parameter contract

```bash
node contracts/verify-contract.mjs
```

Expected: 11 named checks, all `ok`, exit 0.

This bundles the real `supabase/functions/_shared/contract.ts` with esbuild and runs it against the real `contracts/param-schema.json`.
It needs no Deno — esbuild comes in with the web app, so run `npm install` in `apps/web` first if this fails to resolve esbuild.
It is the only automated coverage of the `start-training` validator, which is the choke point a client cannot bypass.

## 3. Web build

```bash
cd apps/web
npm install     # first time only
npm run build
```

Expected: exit 0.
A chunk-size advisory (`Some chunks are larger than 500 kB`) is printed and is expected; it is not a failure.

## 4. Web unit and component tests

```bash
cd apps/web
npm test          # one-shot, this is the CI command
npm run test:watch   # re-runs on save while developing
```

Expected: `Test Files 3 passed (3)`, `Tests 25 passed (25)`.

Runner is [vitest](https://vitest.dev) in a `jsdom` environment with `@testing-library/react`.

**Where tests go.** Beside the file they test, named `*.test.ts` or `*.test.tsx` under `apps/web/src`.
`vitest.config.ts` collects `src/**/*.test.{ts,tsx}`.

**The config is the app's own vite config plus a `test` block**, merged rather than rewritten.
That matters: `apps/web/vite.config.ts` defines the `@contracts` alias that lets the browser read the shared `contracts/param-schema.json`, and a test config with its own hand-copied alias would keep passing after the real one broke.
`src/lib/schema.test.ts` imports through `@contracts` specifically so that a broken alias fails the suite.

**No global `describe`/`it`/`expect`.** Import them from `vitest` in each file.
`apps/web/tsconfig.json` does not declare `vitest/globals` in `types`, so globals would not type-check.

**Cleanup is explicit.** `@testing-library/react` only auto-registers its cleanup when the runner exposes globals, which this setup deliberately does not.
Component test files call `afterEach(cleanup)` themselves — see `src/components/ConfirmModal.test.tsx`.

**No `jest-dom`.** Matchers like `toBeInTheDocument()` and `toBeEmptyDOMElement()` are not available.
Use vitest's built-ins against real DOM values (`expect(container.innerHTML).toBe('')`, `expect(screen.getByText(...)).toBeTruthy()`).

The three suites present are deliberately one of each kind, so that all three paths through the harness are known to work:

| File | Proves |
|---|---|
| `src/lib/yaml.test.ts` | a pure function runs |
| `src/components/ConfirmModal.test.tsx` | jsdom + React rendering + events work |
| `src/lib/schema.test.ts` | the `@contracts` alias resolves inside the runner |

## 5. Edge functions

```bash
deno test supabase/functions/_shared/
```

Expected: `ok | 7 passed | 0 failed`.

Deno is the runtime Supabase edge functions actually run on.
If it is not installed, either `brew install deno` or run it without installing:

```bash
npx --yes -p deno@2.5.3 deno test supabase/functions/_shared/
```

**Where tests go.** Beside the module they test, named `*_test.ts` — Deno's own convention, and what `deno test` discovers by default.

**No `deno.json` and no import map.** Dependencies are imported by fully-qualified, version-pinned specifier (`jsr:@std/assert@1.0.14`), which is what the function sources already do for their own imports.

To widen the run to every function once more tests exist:

```bash
deno test supabase/functions/
```

Adding `--allow-env --allow-net` will be necessary for tests that exercise a function's HTTP handler rather than a pure helper; the current suite needs no permissions.

A type-check pass over the functions is also available and is not currently part of any suite:

```bash
deno check supabase/functions/**/index.ts
```

---

## What is not covered

Recorded so that a green run is not mistaken for a tested system.
The full inventory is in `.scratch/experiment-lab/v1.0.0-acceptance.md`.

- **The web app is covered at three points, not broadly.** The suite exists to make writing tests possible; the ~86 catalogued functions in the audit are still almost entirely untested.
- **18 of 20 edge functions have no test.** Only `_shared/contract.ts` (via suite 2) and `_shared/compat.ts` (via suite 5) are exercised. No HTTP handler is.
- **Compat-signature parity with Postgres is not asserted.** `supabase/functions/_shared/compat.ts` is documented as needing to byte-match `compute_compat_signature()` in `supabase/migrations/20260526100003_versions.sql:53-69`. Suite 5 pins what the TypeScript side produces, but proving the two agree needs a live database, so nothing currently checks it. This is acceptance gate G-13 in the audit and it is open.
- **No linting anywhere.** `ruff` and `mypy` are declared in `pyproject.toml` but no command runs them, and the web app has no eslint config.
- **No CI.** There is no `.github/workflows`, so nothing runs the five commands above automatically.
- **Migrations are never applied from scratch** in any automated check.
