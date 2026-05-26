// =============================================================================
// training-callback — Receive metric / log / status events from Colab notebook
// =============================================================================
// POST body (JSON):
//   { type: "metric",   run_id, step, epoch?, name, value }
//   { type: "log",      run_id, step?, phase?, status?, message }
//   { type: "succeeded", run_id }
//   { type: "failed",   run_id, error?: string }
//
// Auth: HMAC SHA-256 signature in `x-training-signature: sha256=<hex>` header.
// Secret: env var TRAINING_CALLBACK_SECRET. Notebook must sign the raw body.
//
// Behavior:
//   - metric    → INSERT into run_metrics (idempotent by PK)
//   - log       → APPEND to runs.config_yaml.logs[]
//   - succeeded → UPDATE runs SET status='succeeded', finished_at=now()
//   - failed    → UPDATE runs SET status='failed', finished_at=now() + log
//
// Metric name aliases — Phase 1 D3=A: hardcoded for YOLO detection only.
//   (Segmentation aliases like maskMap50 are intentionally NOT included.)
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

const METRIC_ALIASES: Record<string, string> = {
  "metrics/mAP50(B)": "map50",
  "metrics/mAP50-95(B)": "map50_95",
  "metrics/precision(B)": "precision",
  "metrics/recall(B)": "recall",
  "train/box_loss": "box_loss",
  "train/cls_loss": "cls_loss",
  "train/dfl_loss": "dfl_loss",
  "val/box_loss": "val_box_loss",
  "val/cls_loss": "val_cls_loss",
  "val/dfl_loss": "val_dfl_loss",
  "lr/pg0": "lr_pg0",
  "lr/pg1": "lr_pg1",
  "lr/pg2": "lr_pg2",
  "progress": "progress",
};

interface MetricEvent {
  type: "metric";
  run_id: string;
  step: number;
  epoch?: number;
  name: string;
  value: number;
}

interface LogEvent {
  type: "log";
  run_id: string;
  step?: number;
  phase?: string;
  status?: string;
  message: string;
}

interface StatusEvent {
  type: "succeeded" | "failed";
  run_id: string;
  error?: string;
}

type CallbackEvent = MetricEvent | LogEvent | StatusEvent;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("TRAINING_CALLBACK_SECRET");
  if (!secret) return json({ error: "callback_secret_not_configured" }, 500);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-training-signature") ?? "";

  if (!(await verifySignature(rawBody, sigHeader, secret))) {
    return json({ error: "invalid_signature" }, 401);
  }

  let event: CallbackEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!event.run_id) return json({ error: "run_id_required" }, 400);

  const sb = serviceClient();

  if (event.type === "metric") {
    const name = METRIC_ALIASES[event.name] ?? event.name;
    const { error } = await sb.from("run_metrics").upsert(
      {
        run_id: event.run_id,
        step: event.step,
        epoch: event.epoch ?? event.step,
        name,
        value: event.value,
      },
      { onConflict: "run_id,step,name" },
    );
    if (error) return json({ error: "metric_insert_failed", detail: error.message }, 500);
    return json({ ok: true });
  }

  if (event.type === "log") {
    const entry = {
      ts: new Date().toISOString(),
      step: event.step ?? null,
      phase: event.phase ?? null,
      status: event.status ?? "info",
      message: event.message,
    };
    const { data: run } = await sb
      .from("runs")
      .select("config_yaml")
      .eq("id", event.run_id)
      .single();
    const cfg = (run?.config_yaml ?? {}) as Record<string, unknown>;
    const logs = Array.isArray(cfg.logs) ? cfg.logs : [];
    logs.push(entry);
    cfg.logs = logs;
    await sb.from("runs").update({ config_yaml: cfg }).eq("id", event.run_id);
    return json({ ok: true });
  }

  if (event.type === "succeeded" || event.type === "failed") {
    const patch: Record<string, unknown> = {
      status: event.type,
      finished_at: new Date().toISOString(),
    };
    await sb.from("runs").update(patch).eq("id", event.run_id);

    if (event.type === "failed" && event.error) {
      const { data: run } = await sb
        .from("runs")
        .select("config_yaml")
        .eq("id", event.run_id)
        .single();
      const cfg = (run?.config_yaml ?? {}) as Record<string, unknown>;
      const logs = Array.isArray(cfg.logs) ? cfg.logs : [];
      logs.push({
        ts: new Date().toISOString(),
        step: null,
        phase: "finalize",
        status: "error",
        message: event.error,
      });
      cfg.logs = logs;
      await sb.from("runs").update({ config_yaml: cfg }).eq("id", event.run_id);
    }
    return json({ ok: true });
  }

  return json({ error: "unknown_event_type" }, 400);
});

async function verifySignature(body: string, header: string, secret: string): Promise<boolean> {
  const m = header.match(/^sha256=([0-9a-f]+)$/i);
  if (!m) return false;
  const provided = m[1].toLowerCase();
  const expected = await hmacHex(secret, body);
  if (provided.length !== expected.length) return false;
  // Timing-safe compare
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(secret);
  const bodyBytes = new TextEncoder().encode(body);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, bodyBytes);
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
