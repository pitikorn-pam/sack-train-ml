import { useEffect, useMemo, useState } from "react";
import { supabase, type Run, type RunMetric } from "../lib/supabase";
import { MetricChart } from "./MetricChart";
import { ColabSteps } from "./ColabSteps";

const COLAB_URL = (runId: string) =>
  `https://colab.research.google.com/github/pitikorn-pam/sack-train-ml/blob/main/notebooks/train_run.ipynb?run_id=${runId}`;

export function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<Run | null>(null);
  const [metrics, setMetrics] = useState<RunMetric[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadRun() {
      const { data } = await supabase.from("runs").select("*").eq("id", runId).single();
      if (!cancelled) setRun(data as Run);
    }
    async function loadMetrics() {
      const { data } = await supabase
        .from("run_metrics")
        .select("*")
        .eq("run_id", runId)
        .order("step", { ascending: true })
        .limit(5000);
      if (!cancelled) setMetrics((data ?? []) as RunMetric[]);
    }
    loadRun();
    loadMetrics();

    const ch = supabase
      .channel(`run-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, () => loadRun())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "run_metrics", filter: `run_id=eq.${runId}` }, (p) => {
        setMetrics((prev) => [...prev, p.new as RunMetric]);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [runId]);

  const cfg = (run?.config_yaml as Record<string, any> | undefined) ?? {};
  const logs = (cfg.logs ?? []) as Array<Record<string, any>>;
  const stats = (cfg.dataset_stats ?? {}) as Record<string, any>;

  const displayStatus = useMemo(() => {
    if (!run) return "loading";
    if (run.status === "running" && metrics.length === 0) return "waiting";
    return run.status;
  }, [run, metrics.length]);

  const progress = useMemo(() => {
    const p = metrics.filter((m) => m.name === "progress");
    if (p.length === 0) return null;
    return p[p.length - 1].value;
  }, [metrics]);

  const showColab = displayStatus === "waiting" || displayStatus === "pending";

  return (
    <div className="run-detail">
      <button onClick={onBack} className="link-button">← Back</button>

      <section className="panel run-header">
        <div>
          <h2>Run · <code>{runId.slice(0, 8)}</code></h2>
          <p className="muted">
            Status: <span className={`pill pill-${displayStatus}`}>{displayStatus}</span>
            {run?.git_sha && <> · git <code>{run.git_sha}</code></>}
            {run?.started_at && <> · started {new Date(run.started_at).toLocaleString()}</>}
          </p>
          {progress !== null && (
            <div className="run-progress">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} /></div>
              <span>{progress.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </section>

      {showColab && (
        <section className="panel">
          <h3>Waiting for Colab</h3>
          <ColabSteps runId={runId} colabUrl={COLAB_URL(runId)} />
        </section>
      )}

      <section className="panel">
        <h3>Training metrics</h3>
        <MetricChart metrics={metrics} />
      </section>

      <section className="panel">
        <h3>Config</h3>
        <dl className="config-grid">
          <dt>Source weights</dt>
          <dd><code>{cfg.source_weights ?? "—"}</code></dd>
          <dt>Dataset</dt>
          <dd><code>{cfg.dataset ?? "—"}</code></dd>
          <dt>Classes</dt>
          <dd>
            {(cfg.classes as string[] | undefined)?.map((c, i) => (
              <span key={c + i} className="chip">{i}: {c}</span>
            )) ?? "—"}
          </dd>
          <dt>Input size</dt>
          <dd><code>{JSON.stringify(cfg.input_size)}</code></dd>
          <dt>Task</dt>
          <dd>{cfg.task ?? "—"} · {cfg.output_kind ?? ""}</dd>
          <dt>Hailo target</dt>
          <dd>{cfg.export_options?.hailo_target ?? "—"}</dd>
          <dt>Hyperparameters</dt>
          <dd>
            <code>
              epochs={cfg.hyperparameters?.epochs} · imgsz={cfg.hyperparameters?.imgsz} ·
              batch={cfg.hyperparameters?.batch} · patience={cfg.hyperparameters?.patience} ·
              lr0={cfg.hyperparameters?.lr0}
            </code>
          </dd>
          {cfg.note && (<><dt>Note</dt><dd>{cfg.note}</dd></>)}
        </dl>
      </section>

      {Object.keys(stats).length > 0 && (
        <section className="panel">
          <h3>Dataset split</h3>
          <dl className="config-grid">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="panel">
        <h3>Logs ({logs.length})</h3>
        {logs.length === 0 ? (
          <p className="muted">No logs yet.</p>
        ) : (
          <pre className="logs">
            {logs.map((l) =>
              `${(l.ts || "").slice(11, 19)} [${l.phase ?? "?"}/${l.status ?? "?"}] ${l.message ?? ""}`
            ).join("\n")}
          </pre>
        )}
      </section>
    </div>
  );
}
