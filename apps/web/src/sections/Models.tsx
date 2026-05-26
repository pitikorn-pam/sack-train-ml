import { useEffect, useState } from "react";
import { supabase, type ModelLine } from "../lib/supabase";

interface Version {
  id: string;
  model_line_id: string;
  semver: string;
  compat_signature: string;
  artifacts: Record<string, any>;
  metadata: Record<string, any>;
  size_bytes: number | null;
  created_at: string;
}

interface Channel {
  id: string;
  model_line_id: string;
  name: string;
  current_version_id: string | null;
  updated_at: string;
}

interface Deployment {
  id: string;
  model_line_id: string;
  channel_name: string;
  version_id: string;
  status: "active" | "archived";
  is_default: boolean;
  deployed_at: string;
}

export function Models() {
  const [lines, setLines] = useState<ModelLine[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [{ data: l }, { data: v }, { data: c }, { data: d }] = await Promise.all([
          supabase.from("model_lines").select("*"),
          supabase.from("versions").select("*").order("created_at", { ascending: false }).limit(50),
          supabase.from("channels").select("*"),
          supabase.from("channel_deployments").select("*").order("deployed_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setLines((l ?? []) as ModelLine[]);
        setVersions((v ?? []) as Version[]);
        setChannels((c ?? []) as Channel[]);
        setDeployments((d ?? []) as Deployment[]);
      } catch (e: any) {
        setError(String(e));
      }
    }
    load();
    const ch = supabase
      .channel("models-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "versions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_deployments" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  function versionLabel(id: string | null) {
    if (!id) return <span className="muted">none</span>;
    const v = versions.find((x) => x.id === id);
    return v ? <code>{v.semver}</code> : <code className="muted">{id.slice(0, 8)}</code>;
  }

  return (
    <div className="models">
      {error && <p className="error">{error}</p>}

      {lines.map((line) => {
        const lineVers = versions.filter((v) => v.model_line_id === line.id);
        const lineChannels = channels.filter((c) => c.model_line_id === line.id);
        const lineDeploys = deployments.filter((d) => d.model_line_id === line.id);
        return (
          <section key={line.id} className="panel">
            <header className="line-header">
              <div>
                <h2>{line.display_name}</h2>
                <code className="muted">{line.slug}</code>
              </div>
            </header>

            <h3>Channels</h3>
            <table className="runs-table">
              <thead>
                <tr><th>Name</th><th>Current version</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {lineChannels.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{versionLabel(c.current_version_id)}</td>
                    <td>{new Date(c.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
                {lineChannels.length === 0 && (
                  <tr><td colSpan={3} className="muted">No channels.</td></tr>
                )}
              </tbody>
            </table>

            <h3>Deployments</h3>
            <table className="runs-table">
              <thead>
                <tr><th>Channel</th><th>Version</th><th>Status</th><th>Default</th><th>Deployed</th></tr>
              </thead>
              <tbody>
                {lineDeploys.map((d) => (
                  <tr key={d.id}>
                    <td>{d.channel_name}</td>
                    <td>{versionLabel(d.version_id)}</td>
                    <td>
                      <span className={`pill pill-${d.status}`}>{d.status}</span>
                    </td>
                    <td>{d.is_default ? "★" : ""}</td>
                    <td>{new Date(d.deployed_at).toLocaleString()}</td>
                  </tr>
                ))}
                {lineDeploys.length === 0 && (
                  <tr><td colSpan={5} className="muted">No deployments yet.</td></tr>
                )}
              </tbody>
            </table>

            <h3>Versions</h3>
            <table className="runs-table">
              <thead>
                <tr>
                  <th>Semver</th>
                  <th>Artifacts</th>
                  <th>Size</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {lineVers.map((v) => {
                  const artifactKinds = Object.keys(v.artifacts ?? {});
                  return (
                    <tr key={v.id}>
                      <td><code>{v.semver}</code></td>
                      <td>
                        {artifactKinds.length === 0
                          ? <span className="muted">none</span>
                          : artifactKinds.map((k) => <span key={k} className="kind-pill">{k}</span>)
                        }
                      </td>
                      <td>{formatBytes(v.size_bytes)}</td>
                      <td>{new Date(v.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {lineVers.length === 0 && (
                  <tr><td colSpan={4} className="muted">No versions yet.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function formatBytes(b: number | null): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
