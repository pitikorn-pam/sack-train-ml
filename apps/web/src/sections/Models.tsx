import { useEffect, useMemo, useState } from "react";
import { supabase, type ModelLine } from "../lib/supabase";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";

interface Version {
  id: string;
  model_line_id: string;
  run_id: string;
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

type FilterMode = "all" | "deployed" | "candidate";

export function Models({ isAdmin }: { isAdmin: boolean }) {
  const [lines, setLines] = useState<ModelLine[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedVer, setSelectedVer] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [modal, setModal] = useState<null | {
    type: "deploy" | "set-default" | "undeploy";
    version: Version;
    channel: string;
  }>(null);
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: l }, { data: v }, { data: c }, { data: d }] = await Promise.all([
        supabase.from("model_lines").select("*"),
        supabase.from("versions").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("channels").select("*"),
        supabase.from("channel_deployments").select("*").order("deployed_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setLines((l ?? []) as ModelLine[]);
      setVersions((v ?? []) as Version[]);
      setChannels((c ?? []) as Channel[]);
      setDeployments((d ?? []) as Deployment[]);
    }
    load();
    const ch = supabase
      .channel("models-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "versions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_deployments" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVer) ?? null,
    [versions, selectedVer],
  );

  const deployedVersionIds = useMemo(
    () => new Set(deployments.filter((d) => d.status === "active").map((d) => d.version_id)),
    [deployments],
  );

  const filteredVersions = useMemo(() => {
    if (filter === "all") return versions;
    if (filter === "deployed") return versions.filter((v) => deployedVersionIds.has(v.id));
    return versions.filter((v) => !deployedVersionIds.has(v.id));
  }, [versions, filter, deployedVersionIds]);

  function lineLabel(id: string) {
    return lines.find((l) => l.id === id)?.display_name ?? id;
  }

  function channelsForLine(id: string) {
    return channels.filter((c) => c.model_line_id === id);
  }

  async function applyDeploy() {
    if (!modal) return;
    const { type, version, channel } = modal;
    try {
      if (type === "undeploy") {
        const { error } = await supabase
          .from("channel_deployments")
          .update({ status: "archived" })
          .eq("version_id", version.id)
          .eq("channel_name", channel)
          .eq("status", "active");
        if (error) throw error;
        push({ tone: "info", title: "Undeployed", detail: `v${version.semver} from ${channel}` });
      } else if (type === "deploy") {
        const { error } = await supabase.from("channel_deployments").insert({
          model_line_id: version.model_line_id,
          channel_name: channel,
          version_id: version.id,
          status: "active",
          is_default: false,
        });
        if (error) throw error;
        push({ tone: "success", title: "Deployed", detail: `v${version.semver} → ${channel}` });
      } else if (type === "set-default") {
        // Clear current defaults on channel, set new default
        await supabase
          .from("channel_deployments")
          .update({ is_default: false })
          .eq("model_line_id", version.model_line_id)
          .eq("channel_name", channel)
          .eq("status", "active");
        const { error } = await supabase
          .from("channel_deployments")
          .update({ is_default: true })
          .eq("model_line_id", version.model_line_id)
          .eq("channel_name", channel)
          .eq("version_id", version.id)
          .eq("status", "active");
        if (error) throw error;
        // Also update channels.current_version_id
        await supabase
          .from("channels")
          .update({ current_version_id: version.id })
          .eq("model_line_id", version.model_line_id)
          .eq("name", channel);
        push({ tone: "success", title: "Set default", detail: `v${version.semver} is now default on ${channel}` });
      }
    } catch (e: any) {
      push({ tone: "danger", title: "Action failed", detail: String(e?.message ?? e) });
    } finally {
      setModal(null);
    }
  }

  return (
    <div className="models">
      <div className="models-toolbar">
        <div className="filter-pills">
          {(["all", "deployed", "candidate"] as FilterMode[]).map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "deployed" ? "Deployed" : "Candidate"}
            </button>
          ))}
        </div>
        <span className="muted">{filteredVersions.length} versions</span>
      </div>

      <div className="models-layout">
        <div className="version-cards">
          {filteredVersions.length === 0 && (
            <div className="empty-state panel">
              <p>No matching versions.</p>
              <p className="muted">Adjust filter or run a training job.</p>
            </div>
          )}
          {filteredVersions.map((v) => {
            const isSel = v.id === selectedVer;
            const vDeploys = deployments.filter((d) => d.version_id === v.id && d.status === "active");
            const metrics = (v.metadata?.metrics_summary?.fp32 ?? {}) as Record<string, number>;
            const map50 = metrics.map50;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVer(v.id)}
                className={`version-card ${isSel ? "active" : ""}`}
              >
                <div className="version-card-head">
                  <code className="version-semver">v{v.semver}</code>
                  {vDeploys.length > 0 && (
                    <div className="deploy-tags">
                      {vDeploys.map((d) => (
                        <span key={d.id} className={`pill pill-${d.is_default ? "production" : "info"}`}>
                          {d.channel_name}{d.is_default ? " ★" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="version-card-line muted">{lineLabel(v.model_line_id)}</div>
                <div className="version-card-metrics">
                  <span>mAP50: <strong>{map50 != null ? map50.toFixed(3) : "—"}</strong></span>
                  <span className="muted">{Object.keys(v.artifacts ?? {}).length} artifacts</span>
                </div>
                <div className="version-card-foot muted">{new Date(v.created_at).toLocaleDateString()}</div>
              </button>
            );
          })}
        </div>

        <div className="version-detail">
          {!selectedVersion ? (
            <div className="empty-state panel">
              <p>Select a version</p>
              <p className="muted">Click a card on the left to view artifacts + deploy actions.</p>
            </div>
          ) : (
            <VersionDetailPanel
              version={selectedVersion}
              channels={channelsForLine(selectedVersion.model_line_id)}
              deployments={deployments.filter((d) => d.version_id === selectedVersion.id)}
              isAdmin={isAdmin}
              onDeploy={(channel) => setModal({ type: "deploy", version: selectedVersion, channel })}
              onSetDefault={(channel) => setModal({ type: "set-default", version: selectedVersion, channel })}
              onUndeploy={(channel) => setModal({ type: "undeploy", version: selectedVersion, channel })}
            />
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        title={
          modal?.type === "deploy" ? `Deploy v${modal.version.semver} to ${modal.channel}` :
          modal?.type === "set-default" ? `Set v${modal?.version.semver} as default on ${modal?.channel}` :
          modal?.type === "undeploy" ? `Undeploy v${modal?.version.semver} from ${modal?.channel}` :
          ""
        }
        message={
          modal?.type === "deploy"
            ? `Other deployed models on ${modal.channel} remain selectable. Edge devices won't fetch this version until you also Set default.`
            : modal?.type === "set-default"
              ? `This version becomes the default — resolve-channel will return it. Existing deployments stay active.`
              : modal?.type === "undeploy"
                ? `Sets the deployment status to archived. Edge devices currently on this version will keep running; new resolves stop returning it.`
                : ""
        }
        confirmLabel={modal?.type === "undeploy" ? "Undeploy" : modal?.type === "set-default" ? "Set default" : "Deploy"}
        danger={modal?.type === "undeploy"}
        onConfirm={applyDeploy}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}

function VersionDetailPanel({
  version,
  channels,
  deployments,
  isAdmin,
  onDeploy,
  onSetDefault,
  onUndeploy,
}: {
  version: Version;
  channels: Channel[];
  deployments: Deployment[];
  isAdmin: boolean;
  onDeploy: (channel: string) => void;
  onSetDefault: (channel: string) => void;
  onUndeploy: (channel: string) => void;
}) {
  const fp32 = (version.metadata?.metrics_summary?.fp32 ?? {}) as Record<string, number>;
  const int8 = (version.metadata?.metrics_summary?.int8 ?? {}) as Record<string, number>;
  const gate = version.metadata?.metrics_summary?.gate as Record<string, any> | undefined;
  const artifactKinds = ["pytorch", "onnx", "hef", "hef_meta"] as const;

  return (
    <div className="version-detail-inner">
      <section className="panel">
        <h2>v{version.semver}</h2>
        <p className="muted">
          Created {new Date(version.created_at).toLocaleString()} ·
          run <code>{version.run_id.slice(0, 8)}</code>
        </p>
        <p className="muted">compat: <code>{version.compat_signature.slice(0, 16)}…</code></p>
      </section>

      <section className="panel">
        <h3>Performance</h3>
        <div className="metric-grid">
          {Object.entries(fp32).map(([k, v]) => (
            <div key={k} className="metric-grid-item">
              <span className="muted">{k}</span>
              <strong>{typeof v === "number" ? v.toFixed(4) : String(v)}</strong>
            </div>
          ))}
          {Object.keys(fp32).length === 0 && <span className="muted">No FP32 metrics recorded.</span>}
        </div>
        {Object.keys(int8).length > 0 && (
          <>
            <h4>INT8</h4>
            <div className="metric-grid">
              {Object.entries(int8).map(([k, v]) => (
                <div key={k} className="metric-grid-item">
                  <span className="muted">{k}</span>
                  <strong>{typeof v === "number" ? v.toFixed(4) : String(v)}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        {gate && (
          <p className={gate.passed ? "gate-pass" : "gate-fail"}>
            Gate: {gate.passed ? "PASSED" : "FAILED"} — {gate.reason}
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Artifacts</h3>
        <div className="platform-grid">
          {artifactKinds.map((k) => {
            const a = version.artifacts?.[k];
            const ready = !!a?.key;
            return (
              <div key={k} className={`platform-card ${ready ? "ready" : "missing"}`}>
                <div className="platform-head">
                  <code>{k}</code>
                  <span className={`pill pill-${ready ? "active" : "muted"}`}>
                    {ready ? "ready" : "missing"}
                  </span>
                </div>
                {ready && (
                  <>
                    <code className="muted platform-key">{a.key}</code>
                    <div className="muted">{formatBytes(a.size_bytes)}</div>
                    {a.quantization && (
                      <div className="muted">
                        {a.quantization.precision} · {a.quantization.method ?? ""}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h3>Channels</h3>
        <ul className="channel-actions">
          {channels.map((c) => {
            const active = deployments.find(
              (d) => d.channel_name === c.name && d.status === "active",
            );
            const isDefault = !!active?.is_default;
            return (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  {active && (
                    <span className={`pill pill-${isDefault ? "production" : "info"}`}>
                      {isDefault ? "default" : "active"}
                    </span>
                  )}
                </div>
                <div className="channel-buttons">
                  {!active && isAdmin && (
                    <button onClick={() => onDeploy(c.name)} className="button">Deploy</button>
                  )}
                  {active && !isDefault && isAdmin && (
                    <button onClick={() => onSetDefault(c.name)} className="button primary">
                      Set default
                    </button>
                  )}
                  {active && isAdmin && (
                    <button onClick={() => onUndeploy(c.name)} className="button danger">
                      Undeploy
                    </button>
                  )}
                  {!isAdmin && active && (
                    <span className="muted">admin-only</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
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
