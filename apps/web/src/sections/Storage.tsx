import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Usage {
  used_bytes: number;
  quota_bytes: number;
  by_kind: Record<string, number>;
}

export function Storage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.functions.invoke("storage-usage", {
          method: "GET",
        });
        if (cancelled) return;
        if (error) throw error;
        setUsage(data as Usage);
      } catch (e: any) {
        setError(String(e));
      }
    }
    load();
  }, []);

  if (error) return <div className="panel"><p className="error">{error}</p></div>;
  if (!usage) return <div className="panel"><p className="muted">Loading…</p></div>;

  const pct = Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100);

  return (
    <div className="storage">
      <section className="panel">
        <h2>R2 storage usage</h2>
        <div className="usage-bar">
          <div className="usage-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="usage-text">
          <strong>{formatBytes(usage.used_bytes)}</strong> of{" "}
          {formatBytes(usage.quota_bytes)} used ({pct.toFixed(1)}%)
        </p>

        <h3>By artifact kind</h3>
        <table className="runs-table">
          <thead>
            <tr><th>Kind</th><th>Size</th><th>% of used</th></tr>
          </thead>
          <tbody>
            {Object.entries(usage.by_kind).map(([k, v]) => (
              <tr key={k}>
                <td><code>{k}</code></td>
                <td>{formatBytes(v)}</td>
                <td>{((v / Math.max(1, usage.used_bytes)) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {Object.keys(usage.by_kind).length === 0 && (
              <tr><td colSpan={3} className="muted">No artifacts uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Notes</h2>
        <ul>
          <li>Quota is enforced by the <code>storage-usage</code> edge function via <code>STORAGE_QUOTA_BYTES</code> env var.</li>
          <li>Delete operations require admin role (<code>app_metadata.role='admin'</code>).</li>
          <li>Bucket: <code>{(import.meta.env.VITE_R2_BUCKET as string) ?? "bscp-model-registry"}</code> on Cloudflare R2.</li>
        </ul>
      </section>
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
