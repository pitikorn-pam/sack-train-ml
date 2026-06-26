// =============================================================================
// download-tool — Presigned R2 GET URL for a staged tool asset (e.g. the gated
// Hailo Dataflow Compiler wheel). Tools live under the private ``tools/`` prefix
// and are staged once by an operator; the Colab compile phase pulls them here.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthenticated } from "../_shared/auth.ts";
import { presignGet } from "../_shared/r2.ts";

// e.g. tools/hailo/hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl
const KEY_RE = /^tools\/[a-zA-Z0-9._/-]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAuthenticated(req)) return json({ error: "forbidden" }, 403);

  let body: { r2_key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.r2_key || !KEY_RE.test(body.r2_key) || body.r2_key.includes("..")) {
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
