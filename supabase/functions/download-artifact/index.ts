// =============================================================================
// download-artifact — Issue a presigned R2 GET URL for a stored artifact
// =============================================================================
// POST body: { r2_key: string }
// Response: { download_url }
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAdmin } from "../_shared/auth.ts";
import { presignGet } from "../_shared/r2.ts";

const KEY_RE = /^runs\/[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+\.(pt|onnx|hef|hef\.meta\.yaml)$/;

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

  const download_url = await presignGet(body.r2_key, 900);
  return json({ download_url });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
