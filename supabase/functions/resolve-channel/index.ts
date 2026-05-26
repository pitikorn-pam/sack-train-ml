// =============================================================================
// resolve-channel — Public endpoint: latest version on a channel + presigned URL
// =============================================================================
// GET ?channel=production&model_line=yolo11s-sack-hailo8l
//     &kind=hef&current_compat=xxx
// Response: { action, version?, model_url?, ... }
//
// action:
//   - "noop"             — runtime already on current version (compat match)
//   - "update"           — newer version available with same compat
//   - "rebuild_required" — channel version has different compat_signature
//   - "artifact_missing" — version row exists but artifact key not stored
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
  const currentCompat = url.searchParams.get("current_compat");
  const currentVersion = url.searchParams.get("current_version");

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

  const { data: ch } = await sb
    .from("channels")
    .select("id, current_version_id")
    .eq("model_line_id", line.id)
    .eq("name", channel)
    .single();
  if (!ch?.current_version_id) {
    return json({ action: "noop", reason: "channel_empty" });
  }

  const { data: version } = await sb
    .from("versions")
    .select("id, semver, compat_signature, artifacts, metadata, size_bytes, content_hash")
    .eq("id", ch.current_version_id)
    .single();
  if (!version) return json({ error: "version_not_found" }, 404);

  if (currentVersion && currentVersion === version.id) {
    return json({ action: "noop", version: version.semver });
  }

  if (currentCompat && currentCompat !== version.compat_signature) {
    return json({
      action: "rebuild_required",
      version: version.semver,
      compat_signature: version.compat_signature,
    });
  }

  const art = artifactDetail(version.artifacts, kind);
  if (!art.r2_key) {
    return json({ action: "artifact_missing", kind, version: version.semver });
  }

  const model_url = await presignGet(art.r2_key, 3600);

  return json({
    action: "update",
    version_id: version.id,
    semver: version.semver,
    compat_signature: version.compat_signature,
    metadata: version.metadata,
    artifact: art,
    model_url,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
