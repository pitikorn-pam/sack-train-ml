// =============================================================================
// storage-usage — Sum of artifact bytes vs configured quota
// =============================================================================
// GET             → { used_bytes, quota_bytes, by_kind: {...} }
// POST /delete    body: { version_id }  → deletes R2 objects + version row
// POST /archive   body: { version_id }  → soft-archive (mark deployments archived)
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { isAdmin } from "../_shared/auth.ts";
import { deleteObject } from "../_shared/r2.ts";
import { artifactDetail, ArtifactKind, ARTIFACT_EXTENSIONS } from "../_shared/artifacts.ts";

const QUOTA_BYTES = () =>
  parseInt(Deno.env.get("STORAGE_QUOTA_BYTES") ?? `${512 * 1024 * 1024}`, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = serviceClient();

  if (req.method === "GET") {
    const { data: versions } = await sb.from("versions").select("artifacts");
    let used = 0;
    const byKind: Record<string, number> = {};
    for (const v of versions ?? []) {
      for (const k of Object.keys(ARTIFACT_EXTENSIONS)) {
        const a = artifactDetail(v.artifacts, k as ArtifactKind);
        if (a.size_bytes) {
          used += a.size_bytes;
          byKind[k] = (byKind[k] ?? 0) + a.size_bytes;
        }
      }
    }
    return json({ used_bytes: used, quota_bytes: QUOTA_BYTES(), by_kind: byKind });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!isAdmin(req)) return json({ error: "forbidden" }, 403);

  const url = new URL(req.url);
  const action = url.pathname.endsWith("/delete")
    ? "delete"
    : url.pathname.endsWith("/archive")
      ? "archive"
      : null;
  if (!action) return json({ error: "use /delete or /archive" }, 400);

  let body: { version_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.version_id) return json({ error: "version_id required" }, 400);

  if (action === "archive") {
    await sb
      .from("channel_deployments")
      .update({ status: "archived" })
      .eq("version_id", body.version_id);
    return json({ archived: body.version_id });
  }

  // delete: refuse if any active deployment references it
  const { data: active } = await sb
    .from("channel_deployments")
    .select("id")
    .eq("version_id", body.version_id)
    .eq("status", "active");
  if (active && active.length > 0) {
    return json({ error: "version_has_active_deployments", count: active.length }, 409);
  }

  const { data: version } = await sb
    .from("versions")
    .select("artifacts")
    .eq("id", body.version_id)
    .single();
  if (!version) return json({ error: "version_not_found" }, 404);

  for (const k of Object.keys(ARTIFACT_EXTENSIONS)) {
    const a = artifactDetail(version.artifacts, k as ArtifactKind);
    if (a.r2_key) {
      try {
        await deleteObject(a.r2_key);
      } catch (e) {
        console.warn("r2 delete failed", a.r2_key, e);
      }
    }
  }

  await sb.from("versions").delete().eq("id", body.version_id);
  return json({ deleted: body.version_id });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
