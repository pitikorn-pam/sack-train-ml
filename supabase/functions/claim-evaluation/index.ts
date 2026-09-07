// =============================================================================
// claim-evaluation — a worker takes one pending evaluation off the queue.
// =============================================================================
// Launching a suite writes N `evaluations` rows at status='pending'. A Mac claims
// the artifact_kind='pt' ones; a Raspberry Pi with /dev/hailo0 claims the 'hef'
// ones. Resumability after a sleeping laptop, multi-machine execution, and "clone
// the runner onto whichever box is free" are then one mechanism rather than three
// features. Decided in .scratch/experiment-lab/issues/06 and /07.
//
// WHY THIS FUNCTION EXISTS AT ALL, rather than the worker talking to the database:
// `evaluations` is admin-write under RLS and service_role bypasses RLS entirely, so
// a worker holding a service key would hold the whole registry. These are DEV boxes
// handled by whoever is free. The key stays here; the worker carries only its own
// signed-in token. A borrowed box that is later lost can finish work it already
// claimed and nothing else.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthenticated } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { presignGet } from "../_shared/r2.ts";

const RUNNERS = ["lab-web", "lab-cli", "device"] as const;
const KINDS = ["pt", "hef", "onnx"] as const;

// How many pending rows to try before giving up. Each attempt is a conditional
// UPDATE, which is what makes the claim atomic: two workers racing for the same row
// produce one winner and one zero-row update, and the loser simply tries the next.
const MAX_ATTEMPTS = 10;
const URL_TTL_SECONDS = 3600;

interface Body {
  runner?: string;
  runner_host?: string;
  artifact_kind?: string;
  evaluation_id?: string;
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

  if (!body.runner || !RUNNERS.includes(body.runner as typeof RUNNERS[number])) {
    return json({ error: "invalid_runner", allowed: RUNNERS }, 400);
  }
  if (!body.runner_host || body.runner_host.length > 200) {
    return json({ error: "runner_host_required" }, 400);
  }
  if (body.artifact_kind && !KINDS.includes(body.artifact_kind as typeof KINDS[number])) {
    return json({ error: "invalid_artifact_kind", allowed: KINDS }, 400);
  }

  const db = serviceClient();

  // Candidates, oldest first. A specific evaluation_id narrows it to one — that is
  // the "work this exact row" path, and it still goes through the same conditional
  // update, so it cannot steal a row another worker is already running.
  let q = db
    .from("evaluations")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_ATTEMPTS);
  if (body.evaluation_id) q = q.eq("id", body.evaluation_id);
  if (body.artifact_kind) q = q.eq("artifact_kind", body.artifact_kind);

  const { data: candidates, error: listErr } = await q;
  if (listErr) return json({ error: "query_failed", detail: listErr.message }, 500);
  if (!candidates || candidates.length === 0) return json({ claimed: null }, 200);

  for (const c of candidates) {
    // THE CLAIM. `.eq("status","pending")` is the guard: if another worker got here
    // first the row is no longer pending and this updates zero rows.
    const { data: rows, error } = await db
      .from("evaluations")
      .update({
        status: "running",
        runner: body.runner,
        runner_host: body.runner_host,
        started_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("status", "pending")
      .select("*");

    if (error) return json({ error: "claim_failed", detail: error.message }, 500);
    if (!rows || rows.length === 0) continue; // lost the race; try the next

    const evaluation = rows[0];

    const { data: clip, error: clipErr } = await db
      .from("clips")
      .select("id, name, slug, r2_key, sha256, fps, frame_count, width, height, line, inflip, exclusion_zones, gt_kind, expected_count")
      .eq("id", evaluation.clip_id)
      .single();
    if (clipErr || !clip) {
      // Do not leave the row stuck in `running` because of our own failure.
      await db.from("evaluations")
        .update({ status: "failed", error: `clip_not_found: ${evaluation.clip_id}`, finished_at: new Date().toISOString() })
        .eq("id", evaluation.id);
      return json({ error: "clip_not_found", evaluation_id: evaluation.id }, 500);
    }

    // Short-lived URLs. The worker verifies artifact_sha256 against the bytes it
    // downloads and refuses to run on a mismatch — measuring a different artifact
    // than the one named is the bug this whole effort exists to close.
    const artifact_url = await presignGet(evaluation.artifact_ref, URL_TTL_SECONDS);
    const clip_url = await presignGet(clip.r2_key, URL_TTL_SECONDS);

    return json({ claimed: { evaluation, clip, artifact_url, clip_url, url_ttl_seconds: URL_TTL_SECONDS } });
  }

  // Every candidate was taken by someone else between the select and the update.
  return json({ claimed: null, contended: true }, 200);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
