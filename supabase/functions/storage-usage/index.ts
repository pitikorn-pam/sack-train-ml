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
import { isAdmin, isAuthenticated } from "../_shared/auth.ts";
import { deleteObject } from "../_shared/r2.ts";
import { artifactDetail, ArtifactKind, ARTIFACT_EXTENSIONS } from "../_shared/artifacts.ts";

const QUOTA_BYTES = () =>
  parseInt(Deno.env.get("STORAGE_QUOTA_BYTES") ?? `${512 * 1024 * 1024}`, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = serviceClient();

  if (req.method === "GET") {
    // Its siblings all gate; this one did not, and it discloses how much is stored and
    // in what. list-deployed-models and resolve-channel are documented as public
    // because a device needs them; this is a dashboard readout, so the omission reads
    // as an oversight rather than a decision. `isAuthenticated` rather than `isAdmin`:
    // any signed-in operator may see the quota, only an admin may delete.
    if (!isAuthenticated(req)) return json({ error: "forbidden" }, 403);

    const { data: versions, error } = await sb.from("versions").select("artifacts");
    if (error) return json({ error: "query_failed", detail: error.message }, 500);
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
    // RLS turns a forbidden update into a zero-row match rather than an error, so an
    // unchecked write reports success for an action that did nothing. Asking what was
    // touched is the only way to tell them apart — and the count is worth returning:
    // archiving a version that had no active deployment is a no-op the caller should
    // see, not a success it should celebrate.
    const { data: archived, error } = await sb
      .from("channel_deployments")
      .update({ status: "archived" })
      .eq("version_id", body.version_id)
      .eq("status", "active")
      .select("id");
    if (error) return json({ error: "archive_failed", detail: error.message }, 500);
    return json({ archived: body.version_id, deployments_archived: archived?.length ?? 0 });
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

  // The row is the only thing that names these keys. Deleting it after a failed R2
  // delete strands the objects permanently — nothing can find them again to retry —
  // while the UI reports "removed from R2 + DB". So a failure here stops the whole
  // operation: the caller is told exactly which keys survived, and the version row
  // stays, which is what makes a retry possible.
  const failed: { key: string; reason: string }[] = [];
  const removed: string[] = [];
  for (const k of Object.keys(ARTIFACT_EXTENSIONS)) {
    const a = artifactDetail(version.artifacts, k as ArtifactKind);
    if (!a.r2_key) continue;
    try {
      await deleteObject(a.r2_key);
      removed.push(a.r2_key);
    } catch (e) {
      failed.push({ key: a.r2_key, reason: String((e as Error)?.message ?? e) });
    }
  }

  if (failed.length > 0) {
    return json({
      error: "r2_delete_failed",
      detail: "The version row was kept so this can be retried. Objects already removed are listed.",
      failed,
      removed,
    }, 502);
  }

  const { data: gone, error: delErr } = await sb
    .from("versions")
    .delete()
    .eq("id", body.version_id)
    .select("id");
  if (delErr) return json({ error: "version_delete_failed", detail: delErr.message, removed }, 500);
  // RLS turns a forbidden delete into a zero-row match rather than an error, so an
  // unchecked delete would report success for an action that did nothing — while the
  // R2 objects above are already gone.
  if (!gone || gone.length === 0) {
    return json({
      error: "version_delete_matched_no_rows",
      detail: "R2 objects were removed but the registry row was not deleted. Check admin permissions.",
      removed,
    }, 409);
  }

  return json({ deleted: body.version_id, removed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
