// =============================================================================
// start-training — Create a new training run, return run_id + Colab launch URL
// =============================================================================
// POST body: { model_line_slug: string, config: object, git_sha?: string,
//              hardware?: object }
// Response: { run_id, colab_url, provider_job_id? }
//
// Auth: admin or service_role JWT
//
// The Colab notebook reads run_id from the URL query string, prompts for the
// service-role key, then pulls config from Supabase REST. We do not dispatch
// to an external training provider for Phase 1 (Colab is operator-driven).
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { isAuthenticated } from "../_shared/auth.ts";

const COLAB_TEMPLATE_URL = Deno.env.get("COLAB_NOTEBOOK_URL")
  ?? "https://colab.research.google.com/github/pitikorn-pam/sack-train-ml/blob/main/notebooks/train_run.ipynb";

interface StartTrainingBody {
  model_line_slug: string;
  config: Record<string, unknown>;
  git_sha?: string;
  hardware?: Record<string, unknown>;
  provider_job_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!isAuthenticated(req)) {
    return json({ error: "forbidden", hint: "sign in first" }, 403);
  }

  let body: StartTrainingBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.model_line_slug || typeof body.config !== "object") {
    return json({ error: "model_line_slug and config required" }, 400);
  }

  const sb = serviceClient();

  const { data: line, error: lineErr } = await sb
    .from("model_lines")
    .select("id, slug")
    .eq("slug", body.model_line_slug)
    .single();

  if (lineErr || !line) {
    return json({ error: "model_line_not_found", slug: body.model_line_slug }, 404);
  }

  const { data: run, error: runErr } = await sb
    .from("runs")
    .insert({
      model_line_id: line.id,
      status: "pending",
      config_yaml: body.config,
      git_sha: body.git_sha ?? null,
      hardware: body.hardware ?? null,
      provider_job_id: body.provider_job_id ?? null,
    })
    .select("id, provider_job_id")
    .single();

  if (runErr || !run) {
    return json({ error: "run_insert_failed", detail: runErr?.message }, 500);
  }

  const colab_url = `${COLAB_TEMPLATE_URL}?run_id=${run.id}`;

  return json({
    run_id: run.id,
    provider_job_id: run.provider_job_id,
    colab_url,
  }, 202);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
