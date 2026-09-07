// =============================================================================
// submit-evaluation — a worker returns the result for a row it claimed.
// =============================================================================
// This is the ONLY place `reportable` is ever set, and it is never accepted from
// the client. The worker reports FACTS about how it measured; this function decides
// what those facts entitle the row to claim, and the CHECK constraint in migration
// 10 is the floor beneath that decision.
//
// Three producers can generate a count — the web app, the cv-* CLI, and a Pi — and
// the parent CLAUDE.md is explicit that a written rule failed to prevent this class
// of error in nine of nine recorded sessions while a mechanical gate did. So the
// rule lives in one place they all pass through, and under a constraint none of them
// can bypass. Decided in .scratch/experiment-lab/issues/09.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthenticated } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/supabase.ts";

// The only source kinds that can ever back a reportable count. `assembled` — a clip
// stitched from hand-picked frames — is deliberately absent: that is exactly the
// 2026-08-05 "bridge +1" incident, where a count was reported off an assembled clip
// at a guessed fps.
const REPORTABLE_SOURCES = ["registered_session", "original_capture"];

interface Body {
  evaluation_id?: string;
  runner_host?: string;
  status?: "succeeded" | "failed";
  error?: string;
  counted?: number;
  expected?: number;
  missed?: number | null;
  false_positive?: number | null;
  metrics?: Record<string, unknown>;
  overlay_key?: string | null;
  // Reported facts about HOW it was measured. Not a verdict — inputs to one.
  frames_read?: number;
  digest_verified?: boolean;
  fps_measured?: boolean;
  source_kind?: string;
  engine_version?: string;
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
  if (!body.evaluation_id) return json({ error: "evaluation_id_required" }, 400);
  if (!body.runner_host) return json({ error: "runner_host_required" }, 400);
  if (body.status !== "succeeded" && body.status !== "failed") {
    return json({ error: "status_must_be_succeeded_or_failed" }, 400);
  }

  const db = serviceClient();

  const { data: ev, error: evErr } = await db
    .from("evaluations")
    .select("id, status, runner_host, clip_id, suite_run_id, frame_start, frame_end, frame_stride, whole_clip")
    .eq("id", body.evaluation_id)
    .single();
  if (evErr || !ev) return json({ error: "evaluation_not_found" }, 404);

  // You may only submit for a row you are currently running. A token from a box that
  // was returned or lost can finish its own work and nothing else.
  if (ev.status !== "running") {
    return json({ error: "evaluation_not_running", actual_status: ev.status }, 409);
  }
  if (ev.runner_host !== body.runner_host) {
    return json({ error: "not_your_claim" }, 403);
  }

  const finished_at = new Date().toISOString();

  if (body.status === "failed") {
    const upd = await db.from("evaluations")
      .update({ status: "failed", error: (body.error || "unspecified").slice(0, 2000), finished_at, reportable: false })
      .eq("id", ev.id).eq("status", "running").select("id");
    if (upd.error) return json({ error: "write_failed", detail: upd.error.message }, 500);
    if (!upd.data?.length) return json({ error: "evaluation_not_running" }, 409);
    await refreshSuite(db, ev.suite_run_id);
    return json({ ok: true, status: "failed", reportable: false });
  }

  if (typeof body.counted !== "number" || typeof body.expected !== "number") {
    return json({ error: "counted_and_expected_required_on_success" }, 400);
  }

  const { data: clip } = await db
    .from("clips").select("frame_count, gt_kind").eq("id", ev.clip_id).single();

  // DETERMINISM, CHECKED RATHER THAN PROMISED. A replay count is only comparable
  // because every frame was read. A short read is not a smaller number — it is not a
  // number at all, and an unclean finalization state is not a result.
  if (ev.whole_clip && clip && typeof body.frames_read === "number" &&
      body.frames_read !== clip.frame_count) {
    const upd = await db.from("evaluations").update({
      status: "failed",
      error: `short_read: read ${body.frames_read} of ${clip.frame_count} frames on a whole-clip evaluation`,
      finished_at, reportable: false,
    }).eq("id", ev.id).eq("status", "running").select("id");
    if (upd.error) return json({ error: "write_failed", detail: upd.error.message }, 500);
    await refreshSuite(db, ev.suite_run_id);
    return json({ ok: true, status: "failed", reason: "short_read", reportable: false });
  }

  // A clip with only a total count cannot support per-crossing metrics. Storing a 0
  // would say "we looked and found none", which is a different and false claim.
  const perCrossing = clip?.gt_kind === "per_crossing";

  const provenance = {
    source_kind: body.source_kind ?? "unknown",
    fps_measured: body.fps_measured === true,
    count_origin: "machine",
    digest_verified: body.digest_verified === true,
    frames_read: body.frames_read ?? null,
    frame_start: ev.frame_start,
    frame_end: ev.frame_end,
    frame_stride: ev.frame_stride,
    submitted_by_host: body.runner_host,
  };

  // The decision, made here and never accepted from the caller. The CHECK constraint
  // will independently refuse a row whose provenance does not support the flag — this
  // is the same rule stated where it can produce a clear error instead of a 500.
  const reportable =
    REPORTABLE_SOURCES.includes(provenance.source_kind) &&
    provenance.fps_measured === true &&
    provenance.digest_verified === true;

  const upd = await db.from("evaluations").update({
    status: "succeeded",
    counted: body.counted,
    expected: body.expected,
    missed: perCrossing ? (body.missed ?? null) : null,
    false_positive: perCrossing ? (body.false_positive ?? null) : null,
    metrics: body.metrics ?? {},
    artifact_overlay_key: body.overlay_key ?? null,
    engine_version: body.engine_version ?? undefined,
    provenance,
    reportable,
    error: null,
    finished_at,
  }).eq("id", ev.id).eq("status", "running").select("id");

  if (upd.error) return json({ error: "write_failed", detail: upd.error.message }, 500);
  if (!upd.data?.length) return json({ error: "evaluation_not_running" }, 409);

  await refreshSuite(db, ev.suite_run_id);
  return json({ ok: true, status: "succeeded", reportable, provenance });
});

// Recompute the parent suite's counters from its children rather than incrementing.
// An increment drifts the first time a row is retried; a recount cannot.
// `complete` is only ever reached when every child succeeded — the same rule the
// suite_runs_complete_means_complete constraint enforces — which is what stops a
// partial suite from ever rendering an aggregate number.
async function refreshSuite(db: ReturnType<typeof serviceClient>, suiteId: string | null) {
  if (!suiteId) return;
  const { data: suite } = await db.from("suite_runs").select("total").eq("id", suiteId).single();
  if (!suite) return;
  const { data: kids } = await db.from("evaluations").select("status").eq("suite_run_id", suiteId);
  if (!kids) return;

  const succeeded = kids.filter((k) => k.status === "succeeded").length;
  const failed = kids.filter((k) => k.status === "failed").length;
  const settled = succeeded + failed;

  let status = "running";
  if (settled >= suite.total) status = failed === 0 ? "complete" : "incomplete";

  await db.from("suite_runs").update({
    succeeded, failed, status,
    finished_at: settled >= suite.total ? new Date().toISOString() : null,
  }).eq("id", suiteId);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
