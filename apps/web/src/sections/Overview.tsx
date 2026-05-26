import { useEffect, useState } from "react";
import { supabase, type Run, type ModelLine } from "../lib/supabase";

interface Counts {
  modelLines: number;
  runs: { running: number; succeeded: number; failed: number; total: number };
  versions: number;
  channels: number;
}

export function Overview({ onJumpToTrain }: { onJumpToTrain: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: lines }, { data: runs }, { data: versions }, { data: channels }] =
        await Promise.all([
          supabase.from("model_lines").select("*"),
          supabase.from("runs").select("status").limit(1000),
          supabase.from("versions").select("id"),
          supabase.from("channels").select("id"),
        ]);
      if (cancelled) return;
      const r = runs ?? [];
      setCounts({
        modelLines: lines?.length ?? 0,
        runs: {
          running: r.filter((x: any) => x.status === "running").length,
          succeeded: r.filter((x: any) => x.status === "succeeded").length,
          failed: r.filter((x: any) => x.status === "failed").length,
          total: r.length,
        },
        versions: versions?.length ?? 0,
        channels: channels?.length ?? 0,
      });
      setModelLines((lines ?? []) as ModelLine[]);
      const { data: recent } = await supabase
        .from("runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (!cancelled) setRecentRuns((recent ?? []) as Run[]);
    }
    load();
    const ch = supabase
      .channel("overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="overview">
      <section className="panel">
        <h2>System</h2>
        {!counts ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="kpi-grid">
            <KPI label="Model lines" value={counts.modelLines} />
            <KPI label="Runs (total)" value={counts.runs.total} />
            <KPI label="Running" value={counts.runs.running} tone="info" />
            <KPI label="Succeeded" value={counts.runs.succeeded} tone="success" />
            <KPI label="Failed" value={counts.runs.failed} tone="danger" />
            <KPI label="Versions" value={counts.versions} />
            <KPI label="Channels" value={counts.channels} />
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Model lines</h2>
        {modelLines.length === 0 && <p className="muted">No model lines.</p>}
        <ul className="line-list">
          {modelLines.map((m) => (
            <li key={m.id}>
              <strong>{m.display_name}</strong>
              <code className="muted">{m.slug}</code>
              {m.description && <p>{m.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Recent runs</h2>
        <button onClick={onJumpToTrain} className="link-button">→ Open Train</button>
        {recentRuns.length === 0 && <p className="muted">No runs yet.</p>}
        <ul className="run-mini-list">
          {recentRuns.map((r) => (
            <li key={r.id}>
              <code>{r.id.slice(0, 8)}</code>
              <span className={`pill pill-${r.status}`}>{r.status}</span>
              <span className="muted">{new Date(r.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ""}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
