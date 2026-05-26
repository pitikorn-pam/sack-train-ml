import { useEffect, useState } from "react";
import { supabase, type Run } from "../lib/supabase";

const STATUS_COLOR: Record<Run["status"], string> = {
  pending: "#9ca3af",
  running: "#3b82f6",
  succeeded: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

export function RunsList({ onSelect }: { onSelect: (id: string) => void }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) setError(error.message);
      else setRuns((data ?? []) as Run[]);
    }
    load();
    const ch = supabase
      .channel("runs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "runs" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="panel">
      <h2>Runs</h2>
      {error && <p className="error">{error}</p>}
      <table className="runs-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Status</th>
            <th>Run ID</th>
            <th>Git SHA</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} onClick={() => onSelect(r.id)} className="clickable">
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>
                <span
                  className="status-dot"
                  style={{ background: STATUS_COLOR[r.status] }}
                />
                {r.status}
              </td>
              <td><code>{r.id.slice(0, 8)}</code></td>
              <td><code>{r.git_sha ?? "—"}</code></td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr><td colSpan={4} className="muted">No runs yet — create one.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
