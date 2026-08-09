import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, Download, FlaskConical, GitBranch,
  Layers3, Play, RotateCcw, Trash2, Upload, Wand2, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  labHealth, labModels, runInfer, type ExclusionZone, type LabCapabilities, type LabConfig,
  type LabResult, type Point,
} from "../lib/labApi";

type RegistryVersion = {
  id: string; semver: string; model_line_id: string; artifacts: { pytorch?: { key?: string } } | null;
  metadata: Record<string, unknown> | null; size_bytes: number | null; created_at: string;
};
type DrawMode = "line" | "zone" | null;
type Section = { n: number; title: string; open: boolean };

const DEFAULT_CFG: LabConfig = {
  conf: 0.25, iou: 0.7, classes: [0, 1], frame_stride: 2, device: "mps",
  exclusion_zones: [], line: null, inflip: false, tracker_type: "bytetrack",
  track_buffer: 30, match_thresh: 0.8, conf_split: 0.5, roi_dedup_px: 80,
  roi_dedup_frames: 30, count_cooldown_frames: 45, heal: false,
  heal_require_person: true, max_gap_frames: 15,
};

function SectionHeader({ section, onToggle }: { section: Section; onToggle: () => void }) {
  return <button type="button" className="lab-section-head" onClick={onToggle} aria-expanded={section.open}>
    <span className="lab-section-number">{section.n}</span><strong>{section.title}</strong>
    {section.open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
  </button>;
}
function Experimental() { return <span className="lab-experimental">EXPERIMENTAL · backend not connected</span>; }
function DisabledField({ children }: { children: ReactNode }) { return <div className="lab-disabled-field">{children}</div>; }

export function Lab() {
  const [cfg, setCfg] = useState<LabConfig>(DEFAULT_CFG);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [videoFps, setVideoFps] = useState<number | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [zones, setZones] = useState<ExclusionZone[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [backendCapabilities, setBackendCapabilities] = useState<LabCapabilities>({});
  const [legacyModels, setLegacyModels] = useState<string[]>([]);
  const [legacyModel, setLegacyModel] = useState("");
  const [registry, setRegistry] = useState<RegistryVersion[]>([]);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [localModel, setLocalModel] = useState<File | null>(null);
  const [modelMode, setModelMode] = useState<"registry" | "local" | "legacy">("registry");
  const [modelBusy, setModelBusy] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>(Array.from({ length: 8 }, (_, i) => ({ n: i + 1, title: ["Input / Session", "Detection", "Tracker", "Line & Geometry", "Counting & Dedup", "Occlusion Recovery", "Crossing Confidence Scorer", "Output / Export"][i], open: i < 2 || i === 3 })));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) => setCfg((current) => ({ ...current, [key]: value }));
  const selectedRegistry = registry.find((version) => version.id === selectedVersion) ?? null;
  const modelReady = modelMode === "local" ? !!localModel : modelMode === "registry" ? !!selectedRegistry && !!localModel : !!legacyModel;
  const runDisabledReason = !video ? "Add a source video to begin." : !backendUp ? "Lab backend unavailable." : !modelReady ? "Select or upload a .pt model first." : !videoSize ? "Waiting for video metadata." : "";

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([labHealth(), labModels(), supabase.from("versions").select("id, semver, model_line_id, artifacts, metadata, size_bytes, created_at").order("created_at", { ascending: false }).limit(50)])
      .then(([health, legacy, versions]) => {
        if (cancelled) return;
        setBackendUp(health.status === "fulfilled");
        if (health.status === "fulfilled") setBackendCapabilities(health.value.capabilities ?? {});
        if (legacy.status === "fulfilled") { setLegacyModels(legacy.value.models); setLegacyModel(legacy.value.default); }
        if (versions.status === "fulfilled" && !versions.value.error) {
          const rows = (versions.value.data ?? []) as RegistryVersion[];
          setRegistry(rows.filter((v) => Boolean(v.artifacts?.pytorch?.key)));
          if (rows.find((v) => v.artifacts?.pytorch?.key)) setSelectedVersion(rows.find((v) => v.artifacts?.pytorch?.key)!.id);
        } else setRegistryError("Registry unavailable. Use a local .pt file or legacy backend fallback.");
        setRegistryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!video) { setVideoUrl(null); return; }
    const url = URL.createObjectURL(video); setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !videoSize) return;
    canvas.width = videoSize.width; canvas.height = videoSize.height;
    const context = canvas.getContext("2d"); if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const polygon = (points: Point[], color: string, fill: string, close = true) => {
      if (!points.length) return;
      context.beginPath(); context.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => context.lineTo(x, y)); if (close && points.length > 2) context.closePath();
      context.strokeStyle = color; context.fillStyle = fill; context.lineWidth = Math.max(2, videoSize.width / 500);
      if (close && points.length > 2) context.fill(); context.stroke();
      points.forEach(([x, y]) => { context.beginPath(); context.arc(x, y, Math.max(4, videoSize.width / 160), 0, Math.PI * 2); context.fillStyle = color; context.fill(); });
    };
    zones.forEach((zone) => polygon(zone.points, zone.enabled ? "#ff4d5f" : "#64748b", zone.enabled ? "rgba(255,77,95,.2)" : "rgba(100,116,139,.12)"));
    polygon(draftPoints, drawMode === "line" ? "#4de1ff" : "#ffc44d", drawMode === "line" ? "transparent" : "rgba(255,196,77,.2)", drawMode !== "line");
    if (cfg.line) polygon([[cfg.line.x1, cfg.line.y1], [cfg.line.x2, cfg.line.y2]], "#4de1ff", "transparent", false);
  }, [cfg.line, draftPoints, drawMode, videoSize, zones]);

  function selectVideo(file: File | null) {
    setVideo(file); setVideoSize(null); setVideoFps(null); setDraftPoints([]); setZones([]); setResult(null); setErr(null); setEditorError(null); setDrawMode(null);
    setCfg((current) => ({ ...current, exclusion_zones: [], line: null, video_width: undefined, video_height: undefined }));
  }
  function handleVideoMetadata() {
    const element = videoRef.current;
    if (!element?.videoWidth || !element.videoHeight) { setEditorError("Video metadata unavailable."); return; }
    const size = { width: element.videoWidth, height: element.videoHeight }; setVideoSize(size); setVideoFps(null); setCfg((current) => ({ ...current, video_width: size.width, video_height: size.height })); setEditorError(null);
  }
  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    if (!drawMode || !videoSize) return;
    const canvas = canvasRef.current;
    const videoElement = videoRef.current;
    if (!canvas || !videoElement) return;
    const containerRect = canvas.getBoundingClientRect();
    const aspect = videoSize.width / videoSize.height;
    const renderedWidth = Math.min(containerRect.width, containerRect.height * aspect);
    const renderedHeight = renderedWidth / aspect;
    const renderedLeft = containerRect.left + (containerRect.width - renderedWidth) / 2;
    const renderedTop = containerRect.top + (containerRect.height - renderedHeight) / 2;
    const x = event.clientX - renderedLeft;
    const y = event.clientY - renderedTop;
    if (x < 0 || x > renderedWidth || y < 0 || y > renderedHeight) {
      setEditorError("Click inside the rendered video area, not the letterbox bars.");
      return;
    }
    const point: Point = [
      Math.max(0, Math.min(videoSize.width - 1, Math.round((x / renderedWidth) * videoSize.width))),
      Math.max(0, Math.min(videoSize.height - 1, Math.round((y / renderedHeight) * videoSize.height))),
    ];
    if (drawMode === "line") {
      const next = [...draftPoints, point].slice(-2); setDraftPoints(next); if (next.length === 2) set("line", { x1: next[0][0], y1: next[0][1], x2: next[1][0], y2: next[1][1], coordinate_space: "pixel", frame_ref: 0, inflip: cfg.inflip ?? false });
    } else setDraftPoints((points) => [...points, point]);
    setEditorError(null);
  }
  function commitZone() {
    if (draftPoints.length < 3) { setEditorError("Exclusion zone needs at least 3 points."); return; }
    const next: ExclusionZone[] = [...zones, { zone_id: `zone-${zones.length + 1}`, points: draftPoints, enabled: true, coordinate_space: "pixel", frame_ref: 0, mode: "hard_exclude" }];
    setZones(next); set("exclusion_zones", next); setDraftPoints([]); setDrawMode(null);
  }
  function clearLine() { set("line", null); setDraftPoints([]); }
  function toggleZone(zoneId: string) { const next = zones.map((zone) => zone.zone_id === zoneId ? { ...zone, enabled: !zone.enabled } : zone); setZones(next); set("exclusion_zones", next); }
  function deleteZone(zoneId: string) { const next = zones.filter((zone) => zone.zone_id !== zoneId); setZones(next); set("exclusion_zones", next); }

  async function downloadRegistryModel() {
    const key = selectedRegistry?.artifacts?.pytorch?.key; if (!key) return;
    setModelBusy(true); setModelError(null); setModelProgress(0);
    try {
      const { data, error } = await supabase.functions.invoke("download-artifact", { body: { r2_key: key } });
      if (error || !data?.download_url) throw new Error(error?.message ?? "No signed URL returned.");
      const response = await fetch(data.download_url); if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
      const total = Number(response.headers.get("content-length") ?? selectedRegistry.size_bytes ?? 0); const reader = response.body?.getReader();
      if (!reader) throw new Error("Browser cannot stream model download.");
      const chunks: Uint8Array[] = []; let loaded = 0; while (true) { const part = await reader.read(); if (part.done) break; chunks.push(part.value); loaded += part.value.byteLength; if (total) setModelProgress(Math.round(loaded / total * 100)); }
      setLocalModel(new File(chunks as BlobPart[], key.split("/").pop() ?? `model-v${selectedRegistry.semver}.pt`, { type: "application/octet-stream" })); setModelProgress(100);
    } catch (e) { setModelError(e instanceof Error ? e.message : String(e)); }
    finally { setModelBusy(false); }
  }
  async function run() {
    if (!video || !modelReady) { setErr(runDisabledReason || "Model or video is not ready."); return; }
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await runInfer(video, { ...cfg, model_path: modelMode === "legacy" ? legacyModel : undefined, exclusion_zones: zones }, modelMode === "legacy" ? undefined : localModel ?? undefined)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  function toggleClass(id: number) { set("classes", (cfg.classes ?? []).includes(id) ? (cfg.classes ?? []).filter((value) => value !== id) : [...(cfg.classes ?? []), id]); }
  function toggleSection(n: number) { setSections((items) => items.map((item) => item.n === n ? { ...item, open: !item.open } : item)); }
  function downloadConfig() { const blob = new Blob([JSON.stringify({ ...cfg, exclusion_zones: zones }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lab-config.json"; a.click(); URL.revokeObjectURL(a.href); }
  function downloadEventsCsv() {
    if (!result?.events?.length) return;
    const columns = ["event_id", "sequence", "frame_index", "timestamp_ms", "track_id", "class_id", "centroid_x", "centroid_y", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2", "direction", "side_before", "side_after", "status", "recovery", "detection_conf", "exclusion_zone_id", "raw_conf", "dedup_hit", "cooldown_hit", "exclusion_hit", "reason"] as const;
    const csvValue = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return /[",\n\r]/.test(text) ? `"${text.split('"').join('""')}"` : text;
    };
    const rows = result.events.map((event) => [
      event.event_id, event.sequence, event.frame_index, event.timestamp_ms, event.track_id,
      event.class_id, event.centroid?.[0], event.centroid?.[1], ...(event.bbox ?? [undefined, undefined, undefined, undefined]),
      event.direction, event.side_before, event.side_after, event.status, event.recovery, event.detection_conf,
      event.exclusion_zone_id, event.provenance?.decision?.raw_conf, event.provenance?.decision?.dedup_hit,
      event.provenance?.decision?.cooldown_hit, event.provenance?.decision?.exclusion_hit, event.provenance?.decision?.reason,
    ].map(csvValue).join(","));
    const blob = new Blob([[columns.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "lab-events.csv"; anchor.click();
    URL.revokeObjectURL(url);
  }
  const stats = useMemo(() => result ? [{ label: "frames", value: result.frames_processed }, { label: "max sacks / frame", value: result.max_sack_per_frame }, { label: "avg sacks / frame", value: result.avg_sack_per_frame }] : [], [result]);
  const capability = (name: keyof LabCapabilities) => Boolean(backendCapabilities[name] || result?.capabilities?.[name]);
  const events = result?.events;
  const hasSummary = Boolean(result?.summary);
  const statusLabel = (status: string) => status === "confirmed" ? "CONFIRMED" : status === "flagged" ? "FLAGGED" : "EXCLUDED";

  return <div className="lab-shell">
    <header className="lab-topbar"><div><span className="lab-kicker">RESEARCH CONTROL ROOM / {hasSummary ? "V1 COUNTING" : "V0 DETECTION"}</span><h2><FlaskConical size={20} /> Lab Replay</h2></div><div className="lab-top-status"><span className={`lab-status-dot ${backendUp ? "up" : backendUp === false ? "down" : "checking"}`} />{backendUp ? "backend online" : backendUp === false ? "backend unavailable" : "checking backend"}<span className={`lab-chip ${events ? "lab-chip-live" : ""}`}>{events ? `${events.length} events` : "no event stream"}</span></div></header>
    {backendUp === false && <div className="lab-alert"><AlertTriangle size={16} /> Lab backend is unavailable. Start <code>python apps/api/lab_server.py</code> on port 8077.</div>}
    <div className="lab-workspace">
      <aside className="lab-sidebar">{sections.map((section) => <section className="lab-accordion" key={section.n}><SectionHeader section={section} onToggle={() => toggleSection(section.n)} />{section.open && <div className="lab-section-body">
        {section.n === 1 && <><label>Source video<input type="file" accept="video/*" onChange={(e) => selectVideo(e.target.files?.[0] ?? null)} /></label><div className="lab-file-row"><span className={video ? "lab-ok" : "lab-muted"}>{video ? "READY" : "EMPTY"}</span><span>{video?.name ?? "Choose a video file"}</span></div><div className="lab-field-grid"><label>Frame start<input type="number" min="0" value={cfg.frame_start ?? 0} onChange={(e) => set("frame_start", +e.target.value)} /></label><label>Frame end<input type="number" min="0" placeholder="end" value={cfg.frame_end ?? ""} onChange={(e) => set("frame_end", e.target.value ? +e.target.value : undefined)} /></label></div><label>Frame stride <strong>{cfg.frame_stride}</strong><input type="range" min="1" max="10" value={cfg.frame_stride} onChange={(e) => set("frame_stride", +e.target.value)} /></label><p className="lab-note">Source state is local-only until Run Replay.</p></>}
        {section.n === 2 && <><div className="lab-model-tabs">{(["registry", "local", ...(legacyModels.length ? ["legacy"] : [])] as const).map((mode) => <button key={mode} type="button" className={modelMode === mode ? "active" : ""} onClick={() => { setModelMode(mode as "registry" | "local" | "legacy"); if (mode === "registry") setLocalModel(null); setModelError(null); }}>{mode}</button>)}</div>{modelMode === "registry" && <>{registryLoading ? <p className="lab-note">Loading model registry…</p> : registry.length ? <><label>Registry version<select value={selectedVersion} onChange={(e) => { setSelectedVersion(e.target.value); setLocalModel(null); }}><option value="">Select version</option>{registry.map((v) => <option key={v.id} value={v.id}>v{v.semver} · {v.model_line_id}</option>)}</select></label><p className="lab-note">{selectedRegistry ? `Artifact: ${selectedRegistry.artifacts?.pytorch?.key}` : "Choose a version, then fetch the signed R2 artifact."}</p><button className="lab-button" type="button" disabled={!selectedRegistry || modelBusy} onClick={downloadRegistryModel}>{modelBusy ? `Fetching model ${modelProgress}%` : <><Download size={14} /> Fetch model</>}</button></> : <p className="lab-note lab-error">{registryError ?? "No PyTorch artifacts found."}</p>}</>}{modelMode === "local" && <label>Local .pt<input type="file" accept=".pt,application/octet-stream" onChange={(e) => { const file = e.target.files?.[0] ?? null; const valid = !!file && file.name.toLowerCase().endsWith(".pt"); setLocalModel(valid ? file : null); setModelError(file && !valid ? "Choose a .pt file." : null); }} /></label>}{modelMode === "legacy" && <label>Legacy backend model<select value={legacyModel} onChange={(e) => setLegacyModel(e.target.value)}>{legacyModels.map((model) => <option key={model} value={model}>{model.split("/").pop()}</option>)}</select></label>}{localModel && <div className="lab-file-row lab-ok"><Upload size={14} /> {localModel.name} · ready</div>}{modelError && <p className="lab-error">{modelError}</p>}<label>Confidence threshold <strong>{(cfg.conf ?? 0).toFixed(2)}</strong><input type="range" min="0.05" max="0.95" step="0.05" value={cfg.conf} onChange={(e) => set("conf", +e.target.value)} /></label><label>IoU threshold <strong>{(cfg.iou ?? 0).toFixed(2)}</strong><input type="range" min="0.1" max="0.95" step="0.05" value={cfg.iou} onChange={(e) => set("iou", +e.target.value)} /></label><div className="lab-inline-checks"><label><input type="checkbox" checked={(cfg.classes ?? []).includes(0)} onChange={() => toggleClass(0)} /> person</label><label><input type="checkbox" checked={(cfg.classes ?? []).includes(1)} onChange={() => toggleClass(1)} /> sack</label></div></>}
        {section.n === 3 && <><span className="lab-capability-state">{capability("tracker") ? "TRACKER WIRED" : "TRACKER CAPABILITY REQUIRED"}</span><DisabledField>Tracker<select disabled={!capability("tracker")} value={cfg.tracker_type}><option>ByteTrack</option></select></DisabledField><DisabledField>Track buffer<input disabled={!capability("tracker")} type="number" value={cfg.track_buffer} readOnly /></DisabledField><DisabledField>Match threshold<input disabled={!capability("tracker")} type="number" value={cfg.match_thresh} readOnly /></DisabledField></>}
        {section.n === 4 && <><div className="lab-line-status"><GitBranch size={14} />{cfg.line ? "canonical line ready" : "no count line"}<span>frame_ref 0</span></div><button className="lab-button lab-button-cyan" type="button" disabled={!videoSize} onClick={() => { setDrawMode("line"); setDraftPoints([]); }}>Draw canonical count line</button><button className="lab-button" type="button" disabled={!cfg.line} onClick={clearLine}><X size={14} /> Clear line</button><label className="lab-check"><input type="checkbox" checked={!!cfg.inflip} onChange={(e) => { set("inflip", e.target.checked); if (cfg.line) set("line", { ...cfg.line, inflip: e.target.checked }); }} /> In / Out flip</label><hr /><button className="lab-button lab-button-amber" type="button" disabled={!videoSize} onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}>Add exclusion zone</button>{drawMode === "zone" && <button className="lab-button" type="button" disabled={!draftPoints.length} onClick={commitZone}>Commit zone ({draftPoints.length} pts)</button>}{zones.map((zone) => <div className="lab-zone-row" key={zone.zone_id}><label><input type="checkbox" checked={zone.enabled} onChange={() => toggleZone(zone.zone_id)} />{zone.zone_id}</label><button type="button" className="lab-icon-button" onClick={() => deleteZone(zone.zone_id)} aria-label={`Delete ${zone.zone_id}`}><Trash2 size={14} /></button></div>)}<p className="lab-note">All geometry is pixel-space and anchored to frame 0.</p></>}
        {section.n === 5 && <><Experimental /><DisabledField>Confidence split<input disabled type="number" value={cfg.conf_split} readOnly /></DisabledField><DisabledField>ROI dedup / cooldown<input disabled value={`${cfg.roi_dedup_px}px · ${cfg.count_cooldown_frames} frames`} readOnly /></DisabledField></>}
        {section.n === 6 && <><span className="lab-capability-state">{capability("healer") ? "HEALER WIRED" : "HEALER CAPABILITY REQUIRED"}</span><DisabledField>Heal track gaps<input disabled={!capability("healer")} type="checkbox" checked={capability("healer") && !!cfg.heal} readOnly /></DisabledField><DisabledField>Max gap<input disabled={!capability("healer")} type="number" value={cfg.max_gap_frames} readOnly /></DisabledField></>}
        {section.n === 7 && <><span className="lab-capability-state">{capability("scorer") ? "SCORER WIRED" : "SCORER CAPABILITY REQUIRED"}</span><div className="lab-empty-mini"><Wand2 size={16} />{capability("scorer") ? "Scorer output will be shown with crossing events." : "Scorer waits for backend capability metadata."}</div></>}
        {section.n === 8 && <><button className="lab-button" type="button" disabled={!result} onClick={() => result && window.open(result.video_url, "_blank")}><Download size={14} /> Download overlay</button><button className="lab-button" type="button" onClick={downloadConfig}><Download size={14} /> Download config JSON</button><button className="lab-button" type="button" disabled={!result?.events?.length} onClick={downloadEventsCsv}><Download size={14} /> Count CSV <span className="lab-muted">(events only)</span></button></>}
      </div>}</section>)}</aside>

      <main className="lab-center"><div className="lab-viewer-card"><div className="lab-viewer-head"><div><span className="lab-kicker">REPLAY VIEWER</span><h3>{video?.name ?? "No source loaded"}</h3></div><div className="lab-meta"><span>{videoSize ? `${videoSize.width} × ${videoSize.height}` : "— × —"}</span><span>frame 0</span><span>{videoFps ? `${videoFps.toFixed(1)} fps` : "fps —"}</span></div></div><div className="lab-viewer"><div className="lab-viewer-empty">{video && videoUrl ? <><video ref={videoRef} src={videoUrl} controls onLoadedMetadata={handleVideoMetadata} onError={() => setEditorError("Unable to load this video.")} /><canvas ref={canvasRef} onClick={handleCanvasClick} aria-label="Lab drawing canvas" className={drawMode ? "drawing" : ""} /></> : <><Layers3 size={34} /><strong>Load a video to start the replay</strong><span>Detection overlay and geometry tools appear here.</span></>}</div></div>{editorError && <div className="lab-error-banner"><AlertTriangle size={14} /> {editorError}</div>}<div className="lab-tool-row"><button type="button" className={`lab-action-card ${drawMode === "line" ? "selected" : ""}`} disabled={!videoSize} onClick={() => { setDrawMode("line"); setDraftPoints([]); }}><GitBranch size={16} /><span>Draw Count Line</span><small>2 points · frame 0</small></button><button type="button" className={`lab-action-card ${drawMode === "zone" ? "selected" : ""}`} disabled={!videoSize} onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}><Layers3 size={16} /><span>Add Exclusion Zone</span><small>polygon editor</small></button><button type="button" className="lab-action-card" onClick={() => { set("inflip", !cfg.inflip); if (cfg.line) set("line", { ...cfg.line, inflip: !cfg.inflip }); }}><RotateCcw size={16} /><span>In–Out Flip</span><small>{cfg.inflip ? "flipped" : "normal"}</small></button><button type="button" className="lab-action-card" disabled title="Mid-clip switching is not wired in v0"><Play size={16} /><span>Mid-Clip Switch</span><small>not wired in v0</small></button></div><div className="lab-timeline"><span>00:00</span><div><i style={{ width: video ? "3%" : "0%" }} /></div><span>{videoRef.current?.duration ? `${Math.round(videoRef.current.duration)}s` : "—"}</span></div><div className="lab-run-row"><button className="lab-run-button" type="button" disabled={busy || !!runDisabledReason} onClick={run}><Play size={18} fill="currentColor" />{busy ? "Running replay…" : "Run Replay"}</button><span className="lab-run-hint">{busy ? "Backend is processing v0 detection overlay." : runDisabledReason || "Ready: overlay-only detection. No counts are emitted by backend."}</span></div>{err && <div className="lab-error-banner"><AlertTriangle size={14} /> {err}</div>}</div></main>

      <aside className="lab-inspector"><section className="lab-inspector-card"><div className="lab-card-title"><span>OUTPUT PREVIEW</span>{result && <span className="lab-ok">READY</span>}</div>{result ? <><video src={result.video_url} controls /><div className="lab-stat-grid">{stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div><a className="lab-download-link" href={result.video_url} download><Download size={14} /> Download overlay.mp4</a></> : <div className="lab-empty-inspector"><Layers3 size={22} /><span>Run Replay to populate the v0 detection output.</span></div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>COUNT SUMMARY</span><span className={`lab-chip ${hasSummary ? "lab-chip-live" : ""}`}>{hasSummary ? "FROM EVENTS" : "EVENTS REQUIRED"}</span></div>{result?.summary ? <div className="lab-summary-grid">{(["confirmed", "flagged", "recovered", "excluded", "total_crossings"] as const).map((key) => <div className={`lab-summary-value lab-summary-${key}`} key={key}><strong>{result.summary?.[key]}</strong><span>{key.replace("_", " ")}</span></div>)}{result.summary.ground_truth != null && <div className="lab-summary-value"><strong>{result.summary.ground_truth}</strong><span>ground truth</span></div>}{result.summary.error_vs_ground_truth != null && <div className="lab-summary-note">error vs ground truth: <strong>{result.summary.error_vs_ground_truth}</strong></div>}</div> : <div className="lab-research-empty">{result ? "Backend returned no result.summary. Counts are not estimated from detection frames." : "Run Replay to show a backend-provided count summary."}</div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>SCORE BREAKDOWN</span><span className="lab-chip">{capability("scorer") ? "WIRED" : "LOCKED"}</span></div><div className="lab-research-empty">{capability("scorer") ? "Score details will be attached to crossing events when provided." : "Crossing confidence scorer is disabled until the backend capability is wired."}</div></section>
        <section className="lab-inspector-card lab-events-card"><div className="lab-card-title"><span>PER-CROSSING DETAILS</span><span className={`lab-chip ${events?.length ? "lab-chip-live" : ""}`}>{events ? `${events.length} EVENT${events.length === 1 ? "" : "S"}` : "EVENTS REQUIRED"}</span></div>{events?.length ? <div className="lab-event-table-wrap"><table className="lab-event-table"><thead><tr><th>Seq</th><th>Frame</th><th>Time</th><th>Track</th><th>Dir</th><th>Status</th><th>Recovery</th><th>Conf</th></tr></thead><tbody>{events.map((event) => <tr key={event.event_id}><td>{event.sequence}</td><td>{event.frame_index}</td><td>{(event.timestamp_ms / 1000).toFixed(2)}s</td><td>{event.track_id ?? "—"}</td><td>{event.direction}</td><td><span className={`lab-event-status ${event.status}`}>{statusLabel(event.status)}</span></td><td>{event.recovery === "recovered" ? <span className="lab-recovered">RECOVERED</span> : "—"}</td><td>{event.detection_conf == null ? "—" : event.detection_conf.toFixed(2)}</td></tr>)}</tbody></table></div> : <div className="lab-research-empty">{events ? "Backend emitted no crossing events for this run." : "No crossing events in this run. The table remains locked until result.events is present."}</div>}</section></aside>
    </div>
  </div>;
}
