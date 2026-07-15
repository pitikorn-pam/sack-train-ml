import { useEffect, useState } from "react";
import { supabase, type Run } from "../lib/supabase";
import { formatDateTime } from "../lib/format";

const STATUS_COLOR: Record<Run["status"], string> = {
  pending: "#9ca3af",
  running: "#3b82f6",
  succeeded: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

/** Read a field out of a run's config_yaml (stored by NewRun). */
function cfgField(run: Run, key: string): string | undefined {
  const v = (run.config_yaml as Record<string, unknown> | undefined)?.[key];
  return typeof v === "string" ? v : undefined;
}

/** "yolo11s-seg.pt" -> "11s-seg"; "yolo26m.pt" -> "26m". */
function shortWeight(weight?: string): string {
  if (!weight) return "—";
  return weight.replace(/^yolo/, "").replace(/\.pt$/, "");
}

/** Last path segment of an R2 dataset key, for compact display. */
function shortDataset(key?: string): string {
  if (!key) return "—";
  return key.split("/").filter(Boolean).pop() ?? key;
}

interface Props {
  onSelect: (id: string) => void;
  filter?: Run["status"];
}

export function RunsList({ onSelect, filter }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let q = supabase.from("runs").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter) q = q.eq("status", filter);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else setRuns((data ?? []) as Run[]);
    }
    load();
    const ch = supabase
      .channel(`runs-live${filter ? `-${filter}` : ""}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [filter]);

  return (
    <div className="panel">
      <h2>{filter ? `${filter[0].toUpperCase()}${filter.slice(1)} runs` : "All runs"}</h2>
      {error && <p className="error">{error}</p>}
      <table className="runs-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Status</th>
            <th>Model</th>
            <th>Dataset</th>
            <th>Note</th>
            <th>Run ID</th>
            <th>Git SHA</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} onClick={() => onSelect(r.id)} className="clickable">
              <td>{formatDateTime(r.created_at)}</td>
              <td>
                <span
                  className="status-dot"
                  style={{ background: STATUS_COLOR[r.status] }}
                />
                {r.status}
              </td>
              <td>
                {(() => {
                  const task = cfgField(r, "task");
                  return (
                    <>
                      {task && (
                        <span className={`pill pill-${task === "segmentation" ? "info" : "active"}`}>
                          {task === "segmentation" ? "seg" : "det"}
                        </span>
                      )}{" "}
                      <code>{shortWeight(cfgField(r, "source_weights"))}</code>
                    </>
                  );
                })()}
              </td>
              <td><code>{shortDataset(cfgField(r, "dataset"))}</code></td>
              <td className="muted">{cfgField(r, "note") ?? "—"}</td>
              <td><code>{r.id.slice(0, 8)}</code></td>
              <td><code>{r.git_sha ?? "—"}</code></td>
              <td>{r.started_at ? formatDateTime(r.started_at) : "—"}</td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr><td colSpan={8} className="muted">No runs.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
