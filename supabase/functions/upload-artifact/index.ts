// =============================================================================
// upload-artifact — Issue a presigned R2 PUT URL for a training artifact
// =============================================================================
// POST body: { kind: "pytorch"|"onnx"|"hef"|"hef_meta",
//              run_id: string,
//              semver: string,
//              content_type?: string }
// Response: { upload_url, r2_key }
// R2 key pattern: runs/{run_id}/{semver}.{ext}
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthenticated } from "../_shared/auth.ts";
import { presignPut } from "../_shared/r2.ts";
import {
  ARTIFACT_EXTENSIONS,
  ARTIFACT_CONTENT_TYPES,
  ArtifactKind,
} from "../_shared/artifacts.ts";

interface Body {
  kind: ArtifactKind;
  run_id: string;
  semver: string;
  content_type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAuthenticated(req)) return json({ error: "forbidden" }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.kind || !body.run_id || !body.semver) {
    return json({ error: "kind, run_id, semver required" }, 400);
  }

  const ext = ARTIFACT_EXTENSIONS[body.kind];
  if (!ext) {
    return json({ error: "unsupported_artifact_kind", kind: body.kind }, 400);
  }

  const safeSemver = body.semver.replace(/[^a-zA-Z0-9._-]/g, "");
  const safeRunId = body.run_id.replace(/[^a-zA-Z0-9-]/g, "");
  const r2_key = `runs/${safeRunId}/${safeSemver}.${ext}`;

  const contentType = body.content_type ?? ARTIFACT_CONTENT_TYPES[body.kind];
  const upload_url = await presignPut(r2_key, contentType, 900);

  return json({ upload_url, r2_key });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
