import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { FilePenLine, Rocket, Package, Target, Play } from "lucide-react";
import { supabase, type Run, type ModelLine } from "../lib/supabase";
import { formatDateTime } from "../lib/format";

interface Counts {
  modelLines: number;
  runs: { running: number; succeeded: number; failed: number; total: number };
  versions: number;
  channels: number;
}

interface JourneyStep {
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  body: string;
}

const JOURNEY: JourneyStep[] = [
  { Icon: FilePenLine, title: "Create", body: "Configure dataset + hyperparams and submit." },
  { Icon: Rocket,      title: "Train",  body: "Launch Colab — metrics stream back live." },
  { Icon: Package,     title: "Release", body: "On success, a new version row + R2 artifacts appear." },
  { Icon: Target,      title: "Deploy",  body: "Promote a version to a channel — edge devices pick it up." },
];

export function Overview({ onJump }: { onJump: (section: "train" | "models" | "storage") => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [liveRuns, setLiveRuns] = useState<Run[]>([]);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: lines }, { data: runs }, { data: versions }, { data: channels }] =
        await Promise.all([
          supabase.from("model_lines").select("*"),
          supabase.from("runs").select("*").limit(1000),
          supabase.from("versions").select("id"),
          supabase.from("channels").select("id"),
        ]);
      if (cancelled) return;
      const r = (runs ?? []) as Run[];
      setCounts({
        modelLines: lines?.length ?? 0,
        runs: {
          running: r.filter((x) => x.status === "running").length,
          succeeded: r.filter((x) => x.status === "succeeded").length,
          failed: r.filter((x) => x.status === "failed").length,
          total: r.length,
        },
        versions: versions?.length ?? 0,
        channels: channels?.length ?? 0,
      });
      setModelLines((lines ?? []) as ModelLine[]);
      setLiveRuns(
        r
          .filter((x) => x.status === "running" || x.status === "pending")
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 4),
      );
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
      <section className="kpi-row">
        <KPI label="Model lines" value={counts?.modelLines} />
        <KPI label="Runs total" value={counts?.runs.total} />
        <KPI label="Running" value={counts?.runs.running} tone="info" />
        <KPI label="Succeeded" value={counts?.runs.succeeded} tone="success" />
        <KPI label="Failed" value={counts?.runs.failed} tone="danger" />
        <KPI label="Versions" value={counts?.versions} />
        <KPI label="Channels" value={counts?.channels} />
      </section>

      <div className="overview-grid">
        <section className="panel">
          <h2>Operator journey</h2>
          <p className="muted">From dataset to deployed model — four short steps.</p>
          <div className="journey-list">
            {JOURNEY.map(({ Icon, title, body }) => (
              <div key={title} className="journey-card">
                <span className="journey-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => onJump("train")} className="button primary">
            <Play size={14} strokeWidth={2.5} />
            Start a training run
          </button>
        </section>

        <section className="panel">
          <h2>Live runs</h2>
          {liveRuns.length === 0 ? (
            <div className="empty-state">
              <p>No live runs.</p>
              <p className="muted">Switch to Train → New run to create one.</p>
            </div>
          ) : (
            <ul className="run-mini-list">
              {liveRuns.map((r) => (
                <li key={r.id} onClick={() => onJump("train")} className="clickable">
                  <code>{r.id.slice(0, 8)}</code>
                  <span className={`pill pill-${r.status}`}>{r.status}</span>
                  <span className="muted">{formatDateTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Model lines</h2>
          {modelLines.length === 0 ? (
            <p className="muted">No model lines.</p>
          ) : (
            <ul className="line-list">
              {modelLines.map((m) => (
                <li key={m.id}>
                  <strong>{m.display_name}</strong>
                  <code className="muted">{m.slug}</code>
                  {m.description && <p>{m.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number | undefined; tone?: string }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ""}`}>
      <div className="kpi-value">{value ?? "…"}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
