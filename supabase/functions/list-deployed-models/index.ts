// =============================================================================
// list-deployed-models — Public endpoint listing active deployments per channel
// =============================================================================
// GET ?channel=production&model_line=yolo11s-sack-hailo8l&kind=hef&ready_only=true
// Response: { channel, model_line, kind, models: [...] }
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { presignGet } from "../_shared/r2.ts";
import { artifactDetail, ArtifactKind, ARTIFACT_EXTENSIONS } from "../_shared/artifacts.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");
  const modelLineSlug = url.searchParams.get("model_line");
  const kind = (url.searchParams.get("kind") ?? "hef") as ArtifactKind;
  const readyOnly = url.searchParams.get("ready_only") === "true";

  if (!channel || !modelLineSlug) {
    return json({ error: "channel and model_line required" }, 400);
  }
  if (!(kind in ARTIFACT_EXTENSIONS)) {
    return json({ error: "unsupported_kind", kind }, 400);
  }

  const sb = serviceClient();

  const { data: line } = await sb
    .from("model_lines")
    .select("id")
    .eq("slug", modelLineSlug)
    .single();
  if (!line) return json({ error: "model_line_not_found" }, 404);

  const { data: deployments } = await sb
    .from("channel_deployments")
    .select(`
      id, status, is_default, deployed_at,
      version:versions ( id, semver, compat_signature, artifacts, metadata )
    `)
    .eq("model_line_id", line.id)
    .eq("channel_name", channel)
    .eq("status", "active")
    .order("deployed_at", { ascending: false });

  const models = [];
  for (const d of deployments ?? []) {
    // deno-lint-ignore no-explicit-any
    const v: any = d.version;
    if (!v) continue;
    const art = artifactDetail(v.artifacts, kind);
    if (readyOnly && !art.r2_key) continue;
    const model_url = art.r2_key ? await presignGet(art.r2_key, 3600) : null;
    models.push({
      deployment_id: d.id,
      is_default: d.is_default,
      deployed_at: d.deployed_at,
      version_id: v.id,
      semver: v.semver,
      compat_signature: v.compat_signature,
      artifact: art,
      model_url,
      metadata: v.metadata,
    });
  }

  return json({ channel, model_line: modelLineSlug, kind, models });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
