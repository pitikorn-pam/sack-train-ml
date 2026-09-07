/**
 * Every edge function must gate, or be on a list that says why it does not.
 *
 * `storage-usage` handled GET before its `isAdmin` guard and never called
 * `isAuthenticated` at all, so it disclosed total stored bytes and a per-kind breakdown
 * to anyone. Its siblings all gate. `list-deployed-models` and `resolve-channel` are
 * documented as public because a device on the fleet needs them without a user session
 * — that is a decision. `storage-usage` was an omission, and the two look identical
 * from outside unless the difference is written down.
 *
 * So it is written down here. A new function that forgets to gate fails this test; a
 * new function that is deliberately public has to be added to PUBLIC_BY_DESIGN, which
 * is a line someone has to justify in review.
 *
 *   deno test --allow-read supabase/functions/_shared/auth_policy_test.ts
 */
import { assert } from "jsr:@std/assert@1.0.14";

const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

/** Reachable without a user session, on purpose. Each must say so in its own header. */
const PUBLIC_BY_DESIGN = new Set([
  "list-deployed-models",
  "resolve-channel",
  // training-callback authenticates with an HMAC signature over the body instead of a
  // user JWT, because the caller is a Colab run rather than a person.
  "training-callback",
]);

async function functionDirs(): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && !entry.name.startsWith("_")) out.push(entry.name);
  }
  return out.sort();
}

Deno.test("every edge function gates, or is listed as public by design", async () => {
  const ungated: string[] = [];
  for (const name of await functionDirs()) {
    if (PUBLIC_BY_DESIGN.has(name)) continue;
    let src: string;
    try {
      src = await Deno.readTextFile(`${FUNCTIONS_DIR}${name}/index.ts`);
    } catch {
      continue; // no index.ts — not a deployed function
    }
    const gates = /\bis(Admin|Authenticated)\s*\(/.test(src);
    if (!gates) ungated.push(name);
  }
  assert(
    ungated.length === 0,
    `these edge functions call no auth helper — add a gate, or add them to ` +
      `PUBLIC_BY_DESIGN with a reason: ${ungated.join(", ")}`,
  );
});

Deno.test("a function that is public by design says so in its own header", async () => {
  const silent: string[] = [];
  for (const name of PUBLIC_BY_DESIGN) {
    let src: string;
    try {
      src = await Deno.readTextFile(`${FUNCTIONS_DIR}${name}/index.ts`);
    } catch {
      silent.push(`${name} (no index.ts)`);
      continue;
    }
    const header = src.slice(0, 1400).toLowerCase();
    if (!/public|unauthenticated|no auth|hmac|signature|device/.test(header)) {
      silent.push(name);
    }
  }
  assert(
    silent.length === 0,
    `listed as public by design but the file itself does not say why: ${silent.join(", ")}`,
  );
});

Deno.test("storage-usage gates its GET — the specific regression", async () => {
  const src = await Deno.readTextFile(`${FUNCTIONS_DIR}storage-usage/index.ts`);
  const getBlock = src.slice(src.indexOf('req.method === "GET"'), src.indexOf('req.method !== "POST"'));
  assert(
    /\bisAuthenticated\s*\(/.test(getBlock),
    "the GET branch reads the registry without checking who is asking",
  );
});

Deno.test("training-callback requires its HMAC and has no unverified-claim bypass", async () => {
  const src = await Deno.readTextFile(`${FUNCTIONS_DIR}training-callback/index.ts`);

  // The bypass: a JWT whose payload said role=service_role skipped the signature check.
  // Reading a claim from a token nobody verified is only safe behind a gateway that
  // verified it, and this function is deployed with verify_jwt=false.
  assert(
    !/function\s+isServiceRoleJwt\s*\(/.test(src),
    "isServiceRoleJwt is back — it trusts an unverified JWT payload",
  );
  assert(
    !/hasServiceRole/.test(src),
    "the service-role shortcut around the signature check is back",
  );

  // And the check itself must be unconditional.
  const idx = src.indexOf("verifySignature");
  assert(idx > 0, "the signature is never verified");
  const before = src.slice(Math.max(0, idx - 700), idx);
  assert(
    !/if\s*\(\s*!\s*has\w*Role/.test(before),
    "the signature check sits behind a role condition again",
  );
});
