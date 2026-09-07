/**
 * The download allow-list must admit every artifact kind the upload path writes.
 *
 * `_shared/artifacts.ts` registers `effective_config` with the extension
 * `effective-config.json`, `train_for_run.py` uploads it on every successful run, and
 * this regex rejected it — so the third provenance layer, the only one that can name a
 * value nobody chose, was write-only.
 *
 *   deno test supabase/functions/download-artifact/key_test.ts
 */
// Same source and pin as _shared/compat_test.ts — one assert library, one version.
import { assert } from "jsr:@std/assert@1.0.14";
import { ARTIFACT_EXTENSIONS } from "../_shared/artifacts.ts";

const KEY_RE =
  /^runs\/[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+\.(pt|onnx|hef|hef\.meta\.yaml|effective-config\.json)$/;

Deno.test("every registered artifact extension is downloadable", () => {
  for (const [kind, ext] of Object.entries(ARTIFACT_EXTENSIONS)) {
    const key = `runs/abc-123/v1.0.0.${ext}`;
    assert(KEY_RE.test(key), `${kind} (.${ext}) is uploadable but not downloadable: ${key}`);
  }
});

Deno.test("path traversal and foreign prefixes are still refused", () => {
  for (const bad of [
    "runs/abc/../../etc/passwd.pt",
    "tools/hailo/wheel.whl",
    "runs/abc/v1.0.0.exe",
    "runs/abc/v1.0.0.json",
  ]) {
    assert(!KEY_RE.test(bad), `should have been refused: ${bad}`);
  }
});
