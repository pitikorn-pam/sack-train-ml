/**
 * Exercises the compat-signature the edge functions compute.
 *
 * `computeCompatSignature` exists to let a runtime notice that a new version on
 * its channel is not drop-in compatible with the one it is running — different
 * classes, a different input size, a different task. The signature is only
 * useful if its canonical form is stable, because a change to the separators or
 * the key order silently renumbers every signature in the registry and makes
 * every deployed model look like a breaking change at once.
 *
 * So the format itself is pinned here, twice: once by spelling out the exact
 * canonical string the function is supposed to hash, and once by a golden
 * digest. Either one trips if the serialization drifts.
 *
 *   deno test supabase/functions/_shared/
 *
 * ASSERTED here as of 2026-09-07: the canonical string and both golden digests were
 * taken from the live database, so this file now pins the two implementations
 * together. They had never agreed — jsonb orders keys by length, not alphabetically,
 * and puts a space after every colon.
 *
 * Still NOT asserted here: agreement with the Postgres
 * `compute_compat_signature()` in migration 03, which is the parity that
 * actually matters (that function is what fills `versions.compat_signature`).
 * Proving it needs a live database. See docs/testing.md.
 */
import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1.0.14";
import { computeCompatSignature, type CompatInput } from "./compat.ts";

const base: CompatInput = {
  class_names: ["person", "sack"],
  input_size: [640, 640, 3],
  output_kind: "detect",
  task: "detect",
};

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("the signature is a lowercase hex SHA-256", async () => {
  assertMatch(await computeCompatSignature(base), /^[0-9a-f]{64}$/);
});

Deno.test("the canonical form is exactly this string", async () => {
  // Spelled out rather than rebuilt, so a change to compat.ts has to change this
  // line too — and whoever changes it has to look at migration 03 while doing so.
  // Taken from Postgres, not from compat.ts: this is the literal output of
  //   jsonb_build_object(...)::text
  // on the live database. jsonb sorts keys by LENGTH then bytewise — task,
  // input_size, class_names, output_kind — and puts a space after every colon.
  // The previous version of this line spelled out an alphabetically-ordered form with
  // no space after the colon, which is what compat.ts used to produce and what the
  // database has never produced. The two disagreed on every input ever tried.
  const canonical =
    '{"task": "detect", "input_size": [640, 640, 3], ' +
    '"class_names": ["person", "sack"], "output_kind": "detect"}';
  assertEquals(await computeCompatSignature(base), await sha256Hex(canonical));
});

Deno.test("golden digest for the base input", async () => {
  assertEquals(
    await computeCompatSignature(base),
    // From `select public.compute_compat_signature(...)` on the live database.
    "7c178507241fc5bd69813e4ecfb8bb9de9f95c3136cc45ca243f9a6dbca37d4a",
  );
});

Deno.test("a scalar input_size is not serialized as an array", async () => {
  const scalar = await computeCompatSignature({ ...base, input_size: 640 });
  assertEquals(scalar, await sha256Hex(
    '{"task": "detect", "input_size": 640, "class_names": ["person", "sack"], "output_kind": "detect"}',
  ));
  assertEquals(scalar, "cf6755f078179b23a01717f6abefa040c8c17b254a642541836c2657d5133cb3");
  assertNotEquals(scalar, await computeCompatSignature({ ...base, input_size: [640] }));
});

Deno.test("every field is load-bearing — changing any one changes the signature", async () => {
  const signature = await computeCompatSignature(base);
  const variants: CompatInput[] = [
    { ...base, class_names: ["person", "bag"] },
    { ...base, input_size: [416, 416, 3] },
    { ...base, output_kind: "segment" },
    { ...base, task: "segment" },
  ];
  for (const v of variants) {
    assertNotEquals(await computeCompatSignature(v), signature);
  }
});

Deno.test("class order is part of the contract — it is the label index", async () => {
  // Swapping two class names keeps the set but renumbers the labels, which is
  // exactly the breaking change this signature is meant to catch.
  assertNotEquals(
    await computeCompatSignature({ ...base, class_names: ["sack", "person"] }),
    await computeCompatSignature(base),
  );
});

Deno.test("class names are JSON-escaped, not concatenated raw", async () => {
  // A name containing a quote or comma must not be able to forge another name's
  // signature.
  assertNotEquals(
    await computeCompatSignature({ ...base, class_names: ['person", "sack'] }),
    await computeCompatSignature(base),
  );
});

Deno.test("a non-ASCII class name hashes identically to Postgres", async () => {
  // Real risk for this project: the class vocabulary is authored in Thai as often as in
  // English. jsonb stores text as UTF-8 and so does TextEncoder, but the two only agree
  // if neither side escapes non-ASCII — JSON.stringify does not, and neither does jsonb.
  // Golden digest from `select public.compute_compat_signature(...)` on the live database.
  assertEquals(
    await computeCompatSignature({
      class_names: ["ถุง", "sack"],
      input_size: [640, 640, 3],
      output_kind: "detect",
      task: "detect",
    }),
    "875876169f2a8eff9c6e603a6989305fe2d17a159cfa78e4156dcc7844c32c37",
  );
});
