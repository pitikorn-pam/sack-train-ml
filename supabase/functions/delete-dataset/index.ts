// =============================================================================
// delete-dataset — Delete a dataset object from R2
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAdmin } from "../_shared/auth.ts";
import { deleteObject, objectExists } from "../_shared/r2.ts";

const KEY_RE = /^datasets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9.:-]+\/[a-zA-Z0-9._-]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAdmin(req)) return json({ error: "forbidden" }, 403);

  let body: { r2_key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.r2_key || !KEY_RE.test(body.r2_key)) {
    return json({ error: "invalid_r2_key" }, 400);
  }

  // S3-compatible DELETE is idempotent: it succeeds for a key that never existed. So a
  // bare success is not evidence anything was removed, and the caller was being told a
  // deletion happened either way. Ask first, then say which it was.
  const existed = await objectExists(body.r2_key);
  try {
    await deleteObject(body.r2_key);
  } catch (e) {
    return json({ error: "r2_delete_failed", detail: String((e as Error)?.message ?? e) }, 502);
  }
  return json({ deleted: body.r2_key, existed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
