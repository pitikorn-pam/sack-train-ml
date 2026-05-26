// =============================================================================
// delete-dataset — Delete a dataset object from R2
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAdmin } from "../_shared/auth.ts";
import { deleteObject } from "../_shared/r2.ts";

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

  await deleteObject(body.r2_key);
  return json({ deleted: body.r2_key });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
