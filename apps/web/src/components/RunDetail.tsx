import { useEffect, useState } from "react";
import { supabase, type Run, type RunMetric } from "../lib/supabase";

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
        .limit(2000);
      if (!cancelled) setMetrics((data ?? []) as RunMetric[]);
    }
    loadRun();
    loadMetrics();

    const ch = supabase
      .channel(`run-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` },
        () => loadRun(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_metrics", filter: `run_id=eq.${runId}` },
        (payload) => setMetrics((prev) => [...prev, payload.new as RunMetric]),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [runId]);

  const byName = metrics.reduce<Record<string, RunMetric[]>>((acc, m) => {
    (acc[m.name] ??= []).push(m);
    return acc;
  }, {});

  const logs = (run?.config_yaml as Record<string, unknown> | undefined)?.logs as
    | Array<Record<string, unknown>>
    | undefined;

  return (
    <div className="panel">
      <button onClick={onBack}>← Back</button>
      <h2>Run {runId.slice(0, 8)}</h2>
      <p>Status: <strong>{run?.status ?? "…"}</strong></p>
      <p>Git: <code>{run?.git_sha ?? "—"}</code></p>

      <h3>Metrics</h3>
      {Object.keys(byName).length === 0 && <p className="muted">No metrics yet.</p>}
      {Object.entries(byName).map(([name, rows]) => {
        const last = rows[rows.length - 1];
        return (
          <div key={name} className="metric-row">
            <span className="metric-name">{name}</span>
            <span className="metric-value">{last.value.toFixed(4)}</span>
            <span className="muted">step {last.step}</span>
          </div>
        );
      })}

      <h3>Logs</h3>
      <pre className="logs">
        {(logs ?? []).map((l, i) =>
          `${l.ts ?? ""} [${l.phase ?? ""}/${l.status ?? ""}] ${l.message ?? ""}\n${i % 1 === 0 ? "" : ""}`
        ).join("")}
      </pre>
    </div>
  );
}
