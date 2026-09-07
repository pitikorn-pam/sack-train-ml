# Security posture — audited 2026-09-07

Written because three findings were code facts with an unverified live posture, and the
live posture has now been checked. Everything below names how it was established.

## The gateway is off for six functions, and the code does not verify signatures itself

`supabase/functions/_shared/auth.ts` reads claims out of a JWT by splitting on dots and
base64-decoding the payload. It performs **no signature check** — no `crypto.subtle.verify`,
no issuer, no expiry. That is a reasonable design *only* where Supabase's gateway has
already authenticated the token, which is what `verify_jwt` controls.

Read from the Management API on 2026-09-07:

| Function | `verify_jwt` |
|---|---|
| `delete-dataset` | true |
| `download-tool` | true |
| `list-deployed-models` | true |
| `resolve-channel` | true |
| `storage-usage` | true |
| **`download-artifact`** | **false** |
| **`download-dataset`** | **false** |
| **`start-training`** | **false** |
| **`training-callback`** | **false** |
| **`upload-artifact`** | **false** |
| **`upload-dataset`** | **false** |

For the six with `verify_jwt=false`, a hand-made token whose payload reads
`{"role":"service_role"}` satisfies `isAdmin` and `isAuthenticated`. That reaches: creating
training runs, presigned PUT URLs for artifacts and datasets, and presigned GET URLs for
trained models.

**Fixed in this repo:**

- `README.md` no longer prescribes `--no-verify-jwt`, which is how the pattern was
  reproduced on every deploy.
- `training-callback` no longer accepts a service-role *claim* in place of its HMAC
  signature. The old code reasoned that "a service-role JWT is strictly stronger than a
  shared HMAC secret" — true only if the signature is verified, and it is not. The HMAC
  is now unconditional, and `supabase_client` refuses to send an unsigned callback rather
  than failing with a 401 halfway through a run.
- `storage-usage` GET now requires a signed-in caller. It disclosed total stored bytes
  and a per-kind breakdown to anyone; its siblings all gate.
- `_shared/auth_policy_test.ts` fails if any new function forgets to gate, or if the
  `training-callback` bypass returns.

**NOT fixed here, and it needs the project owner.** Flipping `verify_jwt` to true on the
six functions is a change to the live deployment, not to this repository. It should be
safe — the web app sends a real session JWT and Colab sends the service-role key, both of
which the gateway accepts — but "should be" is not "is", and a wrong flip stops training
launches. The command:

```bash
supabase functions deploy download-artifact download-dataset start-training \
  training-callback upload-artifact upload-dataset --use-api
```

Verify afterwards with `GET /v1/projects/<ref>/functions` and confirm every row reads
`verify_jwt=true`, then create one run from the web app and one callback from a Colab
session before considering it done.

## CORS is `*` everywhere

`supabase/functions/_shared/cors.ts` and `apps/api/lab_server.py`. For the Lab this is
defensible — it binds `127.0.0.1` and is a local research tool — but it is stated here as
a boundary rather than left implicit, because `Lab.tsx` instructs the operator to start it.
