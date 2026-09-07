/**
 * The auth boundary every edge function stands behind.
 *
 * These helpers decide whether a request may start a training run, upload an artifact,
 * or delete a version. They are pure, they had no test, and they parse a JWT by hand —
 * splitting on dots and base64-decoding the middle — which is exactly the kind of code
 * that quietly accepts something it should not.
 *
 * NOT asserted here, and it matters: these functions do not VERIFY the signature. They
 * read claims from a token Supabase's gateway has already authenticated. A test that
 * implied otherwise would be worse than none, so it is said plainly instead.
 *
 *   deno test supabase/functions/_shared/
 */
import { assert, assertEquals } from "jsr:@std/assert@1.0.14";
import { bearerToken, claimsFromJwt, isAdmin, isAuthenticated } from "./auth.ts";

/** Build a token with the given payload. The signature is never checked, so it is junk. */
function token(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.not-a-real-signature`;
}

const req = (auth?: string) =>
  new Request("https://example.test/", { headers: auth ? { Authorization: auth } : {} });

// -------------------------------------------------------------------------
// bearerToken
// -------------------------------------------------------------------------

Deno.test("bearerToken reads the header, case-insensitively on the scheme", () => {
  assertEquals(bearerToken(req("Bearer abc.def.ghi")), "abc.def.ghi");
  assertEquals(bearerToken(req("bearer abc.def.ghi")), "abc.def.ghi");
});

Deno.test("bearerToken returns null rather than a partial value", () => {
  assertEquals(bearerToken(req()), null);
  assertEquals(bearerToken(req("Basic dXNlcjpwYXNz")), null);
  assertEquals(bearerToken(req("Bearer")), null);
});

// -------------------------------------------------------------------------
// claimsFromJwt — hand-rolled parsing is where the surprises live
// -------------------------------------------------------------------------

Deno.test("claims are read from the payload segment", () => {
  const c = claimsFromJwt(token({ role: "authenticated", sub: "user-1" }));
  assertEquals(c?.role, "authenticated");
});

Deno.test("a malformed token yields null, never a partial claim set", () => {
  for (const bad of [null, "", "one-segment", "two.segments", "a.b.c.d", "a.!!!not-base64!!!.c"]) {
    assertEquals(claimsFromJwt(bad as string | null), null, `should reject: ${bad}`);
  }
});

Deno.test("base64url padding is restored, so a payload of any length parses", () => {
  // Payload lengths that need 0, 1 and 2 '=' of padding after base64url stripping.
  for (const sub of ["a", "ab", "abc", "abcd", "abcde"]) {
    const c = claimsFromJwt(token({ role: "authenticated", sub }));
    assertEquals(c?.sub, sub, `padding lost for sub=${sub}`);
  }
});

// -------------------------------------------------------------------------
// the two decisions
// -------------------------------------------------------------------------

Deno.test("isAdmin accepts the service role and an admin claim, and nothing else", () => {
  assert(isAdmin(req(`Bearer ${token({ role: "service_role" })}`)));
  assert(isAdmin(req(`Bearer ${token({ app_metadata: { role: "admin" } })}`)));
  assert(!isAdmin(req(`Bearer ${token({ role: "authenticated" })}`)));
  assert(!isAdmin(req(`Bearer ${token({ role: "anon" })}`)));
});

Deno.test("isAdmin refuses a request with no token at all", () => {
  assert(!isAdmin(req()));
  assert(!isAdmin(req("Bearer garbage")));
});

Deno.test("isAuthenticated admits any signed-in role, including admin and service", () => {
  for (const claims of [
    { role: "authenticated" },
    { role: "service_role" },
    { app_metadata: { role: "admin" } },
  ]) {
    assert(isAuthenticated(req(`Bearer ${token(claims)}`)), JSON.stringify(claims));
  }
});

Deno.test("isAuthenticated refuses anon and refuses nothing-at-all", () => {
  assert(!isAuthenticated(req(`Bearer ${token({ role: "anon" })}`)));
  assert(!isAuthenticated(req()));
});

Deno.test("a claim of admin in the WRONG place does not grant admin", () => {
  // `role: "admin"` at the top level is not what Supabase issues; app_metadata is.
  // Accepting it would let a token shaped by hand widen its own privileges.
  assert(!isAdmin(req(`Bearer ${token({ role: "admin" })}`)));
});

Deno.test("an empty app_metadata does not throw or grant", () => {
  assert(!isAdmin(req(`Bearer ${token({ app_metadata: {} })}`)));
  assert(!isAuthenticated(req(`Bearer ${token({ app_metadata: {} })}`)));
});
