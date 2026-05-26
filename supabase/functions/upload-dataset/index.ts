// =============================================================================
// upload-dataset — Issue a presigned R2 PUT URL for a dataset YAML or ZIP
// =============================================================================
// POST body: { filename, model_line_slug, kind?: "yaml"|"zip", content_type? }
// Response: { upload_url, r2_key, kind }
// R2 key pattern: datasets/{model_line_slug}/{ISO-stamp}/{filename}
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAdmin } from "../_shared/auth.ts";
import { presignPut } from "../_shared/r2.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAdmin(req)) return json({ error: "forbidden" }, 403);

  let body: {
    filename?: string;
    model_line_slug?: string;
    kind?: "yaml" | "zip";
    content_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.filename || !body.model_line_slug) {
    return json({ error: "filename and model_line_slug required" }, 400);
  }

  const safeSlug = body.model_line_slug.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFile = body.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const kind = body.kind ?? (safeFile.endsWith(".zip") ? "zip" : "yaml");

  const r2_key = `datasets/${safeSlug}/${stamp}/${safeFile}`;
  const contentType = body.content_type
    ?? (kind === "zip" ? "application/zip" : "application/x-yaml");

  const upload_url = await presignPut(r2_key, contentType, 900);
  return json({ upload_url, r2_key, kind });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
