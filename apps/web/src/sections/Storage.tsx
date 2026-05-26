import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";

interface Usage {
  used_bytes: number;
  quota_bytes: number;
  by_kind: Record<string, number>;
}

interface VersionRow {
  id: string;
  semver: string;
  model_line_id: string;
  size_bytes: number | null;
  artifacts: Record<string, any>;
  created_at: string;
}

export function Storage({ isAdmin }: { isAdmin: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [deployedIds, setDeployedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<VersionRow | null>(null);
  const { push } = useToast();

  async function load() {
    try {
      const [{ data: usageData, error: ue }, { data: vs }, { data: deps }] = await Promise.all([
        supabase.functions.invoke("storage-usage", { method: "GET" }),
        supabase.from("versions").select("id,semver,model_line_id,size_bytes,artifacts,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("channel_deployments").select("version_id,status").eq("status", "active"),
      ]);
      if (ue) throw ue;
      setUsage(usageData as Usage);
      setVersions((vs ?? []) as VersionRow[]);
      setDeployedIds(new Set((deps ?? []).map((d: any) => d.version_id)));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("storage-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "versions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_deployments" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function deleteVersion() {
    if (!confirm) return;
    try {
      const { data, error } = await supabase.functions.invoke("storage-usage", {
        method: "POST",
        body: { version_id: confirm.id },
        headers: { "x-supabase-action": "delete" },
      });
      // storage-usage uses /delete path — invoke doesn't support path suffix
      // Fall back to direct fetch with the trailing path:
      if (error) {
        // workaround: call with path suffix via raw fetch
        const session = (await supabase.auth.getSession()).data.session;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-usage/delete`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ version_id: confirm.id }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
      }
      void data;
      push({ tone: "success", title: "Version deleted", detail: `v${confirm.semver} removed from R2 + DB` });
      setConfirm(null);
      load();
    } catch (e: any) {
      push({ tone: "danger", title: "Delete failed", detail: String(e?.message ?? e) });
    }
  }

  if (error) return <div className="panel"><p className="error">{error}</p></div>;
  if (!usage) return <div className="panel"><p className="muted">Loading…</p></div>;

  const pct = Math.min(100, (usage.used_bytes / Math.max(1, usage.quota_bytes)) * 100);
  const tone = pct > 90 ? "danger" : pct > 75 ? "warn" : "ok";

  return (
    <div className="storage">
      <section className={`panel quota-banner quota-${tone}`}>
        <div className="quota-head">
          <h2>R2 storage</h2>
          {tone === "danger" && <span className="pill pill-failed">Near quota</span>}
        </div>
        <div className="usage-bar"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>
        <p className="usage-text">
          <strong>{formatBytes(usage.used_bytes)}</strong> of {formatBytes(usage.quota_bytes)} used
          <span className="muted"> · {pct.toFixed(1)}%</span>
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
        <h2>Versions ({versions.length})</h2>
        <p className="muted">Deployed versions can't be deleted — undeploy first.</p>
        <table className="runs-table">
          <thead>
            <tr>
              <th>Semver</th>
              <th>Artifacts</th>
              <th>Size</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const deployed = deployedIds.has(v.id);
              return (
                <tr key={v.id}>
                  <td><code>{v.semver}</code></td>
                  <td>
                    {Object.keys(v.artifacts ?? {}).map((k) => (
                      <span key={k} className="kind-pill">{k}</span>
                    ))}
                  </td>
                  <td>{formatBytes(v.size_bytes)}</td>
                  <td>{new Date(v.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`pill pill-${deployed ? "production" : "inactive"}`}>
                      {deployed ? "deployed" : "inactive"}
                    </span>
                  </td>
                  <td>
                    {isAdmin ? (
                      <button
                        className="button danger"
                        disabled={deployed}
                        onClick={() => setConfirm(v)}
                        title={deployed ? "Cannot delete deployed version" : "Delete this version + R2 objects"}
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="muted">admin-only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {versions.length === 0 && (
              <tr><td colSpan={6} className="muted">No versions yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <ConfirmModal
        open={!!confirm}
        title={`Delete v${confirm?.semver}`}
        message={`This permanently deletes the version row + all R2 artifact objects (.pt, .onnx, .hef, .hef.meta.yaml). Edge devices currently using this version will keep their local copy; new resolves stop returning it.`}
        confirmLabel="Delete forever"
        danger
        onConfirm={deleteVersion}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function formatBytes(b: number | null | undefined): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
