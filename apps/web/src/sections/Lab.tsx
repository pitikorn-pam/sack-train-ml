import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, Download, FlaskConical, GitBranch,
  Layers3, Play, RotateCcw, Trash2, Upload, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  compareRunManifests, labHealth, labModels, labRuns, manifestConfig as getManifestConfig, replayConfigFromManifest,
  runInfer, type ExclusionZone, type LabCapabilities, type LabConfig, type LabResult, type Point, type RunManifest,
  type ScorerMode, type ScorerVerdict,
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
  track_buffer: 30, match_thresh: 0.7, conf_split: 0.6, roi_dedup_px: 25,
  roi_dedup_frames: 120, count_cooldown_frames: 40, heal: false,
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
function Hint({ text }: { text: string }) {
  return <span className="lab-hint" tabIndex={0} aria-label={text}><span aria-hidden="true">?</span><span className="lab-hint-tooltip" role="tooltip">{text}</span></span>;
}
function scorerValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(3) : "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value) ?? "[unavailable]"; } catch { return "[unavailable]"; }
}
function safeNumber(value: unknown, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}
function safePoint(value: unknown): string {
  return Array.isArray(value) && value.length >= 2 ? `(${safeNumber(value[0])}, ${safeNumber(value[1])})` : "—";
}
function safeLine(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const line = value as Record<string, unknown>;
  return `(${safeNumber(line.x1)}, ${safeNumber(line.y1)}) → (${safeNumber(line.x2)}, ${safeNumber(line.y2)})`;
}
function predictorMetadata(value: unknown): string {
  if (!value || typeof value !== "object") return predictorLabel(value);
  const metadata = value as Record<string, unknown>;
  const requested = typeof metadata.requested === "string" ? metadata.requested : "unknown";
  const status = typeof metadata.status === "string" ? metadata.status : metadata.supported === true ? "supported" : metadata.supported === false ? "unsupported" : "status unknown";
  const points = typeof metadata.points_used === "number" ? ` · ${metadata.points_used} pts` : "";
  return `${requested} · ${status}${points}`;
}
function predictorLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "predictor not supplied";
  const metadata = value as { requested?: unknown; supported?: unknown; status?: unknown; points_used?: unknown };
  const requested = typeof metadata.requested === "string" ? metadata.requested : "unknown";
  const status = typeof metadata.status === "string" ? metadata.status : metadata.supported === true ? "supported" : metadata.supported === false ? "unsupported" : "status unknown";
  const points = typeof metadata.points_used === "number" ? ` · ${metadata.points_used} pts` : "";
  return `${requested} · ${status}${points}`;
}
function formatElapsed(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function scorerEntries(values: Record<string, unknown> | undefined) {
  return values ? Object.entries(values).filter(([, value]) => value !== undefined) : [];
}
function scorerModeLabel(mode: ScorerMode | undefined): string { return mode === "fused" ? "FUSED" : mode === "passthrough" ? "PASSTHROUGH" : "SCORER OUTPUT REQUIRED"; }
function verdictLabel(verdict: ScorerVerdict | undefined): string { return verdict ? verdict.toUpperCase() : "—"; }

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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replayElapsedMs, setReplayElapsedMs] = useState<number | null>(null);
  const [replayEtaMs, setReplayEtaMs] = useState<number | null>(null);
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
  const [showTrail, setShowTrail] = useState(false);
  const [trailLength, setTrailLength] = useState(30);
  const [runHistory, setRunHistory] = useState<RunManifest[] | null>(null);
  const [runHistoryLoading, setRunHistoryLoading] = useState(true);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);
  const [baselineRunId, setBaselineRunId] = useState("");
  const [currentRunId, setCurrentRunId] = useState("");
  const [sections, setSections] = useState<Section[]>(Array.from({ length: 8 }, (_, i) => ({ n: i + 1, title: ["Input/Session", "Detection", "Tracker", "Line/Geometry", "Counting/Dedup", "Occlusion-Recovery", "Scorer", "Output/Export"][i], open: i < 2 || i === 3 })));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayStartedAtRef = useRef<number | null>(null);
  const replayEstimateMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!busy) return;
    const startedAt = replayStartedAtRef.current ?? Date.now();
    replayStartedAtRef.current = startedAt;
    const estimateMs = replayEstimateMsRef.current ?? 15000;
    const update = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(95, Math.floor((elapsed / estimateMs) * 100));
      setReplayElapsedMs(elapsed);
      setReplayProgress(progress);
      setReplayEtaMs(Math.max(0, estimateMs - elapsed));
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => {
    replayStartedAtRef.current = null;
    replayEstimateMsRef.current = null;
  }, []);

  useEffect(() => {
    const nextEvents = result?.events;
    if (!nextEvents?.length) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((current) => current && nextEvents.some((event) => event.event_id === current) ? current : nextEvents[0].event_id);
  }, [result]);

  const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) => setCfg((current) => ({ ...current, [key]: value }));
  const selectedRegistry = registry.find((version) => version.id === selectedVersion) ?? null;
  const modelReady = modelMode === "local" ? !!localModel : modelMode === "registry" ? !!selectedRegistry && !!localModel : !!legacyModel;
  const runDisabledReason = !video ? "Add a source video to begin." : !backendUp ? "Lab backend unavailable." : !modelReady ? "Select or upload a .pt model first." : !videoSize ? "Waiting for video metadata." : "";

  useEffect(() => {
    let cancelled = false;
    labRuns().then((response) => {
      if (!cancelled) setRunHistory(response.runs);
    }).catch((error) => {
      if (!cancelled) setRunHistoryError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setRunHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!runHistory?.length) {
      setBaselineRunId("");
      setCurrentRunId("");
      return;
    }
    setCurrentRunId((id) => id && runHistory.some((run) => run.run_id === id) ? id : runHistory[0].run_id);
    setBaselineRunId((id) => id && runHistory.some((run) => run.run_id === id) ? id : runHistory[1]?.run_id ?? "");
  }, [runHistory]);

  async function refreshRunHistory() {
    try {
      const response = await labRuns();
      setRunHistory(response.runs);
      setRunHistoryError(null);
    } catch (error) {
      setRunHistoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunHistoryLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const registryRequest = (async (): Promise<{ data: RegistryVersion[] | null; error: { message: string } | null }> => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return { data: null, error: { message: "Registry needs an active sign-in session." } };
      }
      const response = await supabase.from("versions").select("id, semver, model_line_id, artifacts, metadata, size_bytes, created_at").order("created_at", { ascending: false }).limit(50);
      return { data: (response.data ?? []) as RegistryVersion[], error: response.error ? { message: response.error.message } : null };
    })();
    Promise.allSettled([labHealth(), labModels(), registryRequest])
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
    const durationSeconds = videoRef.current?.duration;
    const estimateMs = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.max(15000, durationSeconds * 2000)
      : Math.max(15000, (video.size / (1024 * 1024)) * 1200);
    replayEstimateMsRef.current = estimateMs;
    replayStartedAtRef.current = Date.now();
    setReplayProgress(0); setReplayElapsedMs(0); setReplayEtaMs(estimateMs);
    setBusy(true); setErr(null); setResult(null);
    const trailConfig = trailSupported ? { show_trail: showTrail, trail_len: trailLength } : {};
    try {
      const nextResult = await runInfer(video, { ...cfg, ...trailConfig, model_path: modelMode === "legacy" ? legacyModel : undefined, exclusion_zones: zones }, modelMode === "legacy" ? undefined : localModel ?? undefined);
      setResult(nextResult);
      await refreshRunHistory();
    }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally {
      setReplayProgress(100);
      setReplayEtaMs(0);
      setBusy(false);
      replayStartedAtRef.current = null;
      replayEstimateMsRef.current = null;
    }
  }
  function toggleClass(id: number) { set("classes", (cfg.classes ?? []).includes(id) ? (cfg.classes ?? []).filter((value) => value !== id) : [...(cfg.classes ?? []), id]); }
  function toggleSection(n: number) { setSections((items) => items.map((item) => item.n === n ? { ...item, open: !item.open } : item)); }
  function loadManifestConfig(run: RunManifest) {
    const replayConfig = replayConfigFromManifest(run);
    setCfg((current) => ({ ...current, ...replayConfig }));
    if (Array.isArray(replayConfig.exclusion_zones)) setZones(replayConfig.exclusion_zones);
    setEditorError(null);
    setErr(null);
  }
  function downloadConfig() { const trailConfig = trailSupported ? { show_trail: showTrail, trail_len: trailLength } : {}; const blob = new Blob([JSON.stringify({ ...cfg, ...trailConfig, exclusion_zones: zones }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lab-config.json"; a.click(); URL.revokeObjectURL(a.href); }
  function downloadManifest() {
    if (!manifestReady || !manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lab-run-${manifest.run_id}.manifest.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function downloadEventsCsv() {
    if (!result?.events?.length) return;
    const columns = ["event_id", "sequence", "frame_index", "timestamp_ms", "track_id", "class_id", "centroid_x", "centroid_y", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2", "direction", "side_before", "side_after", "status", "recovery", "detection_conf", "exclusion_zone_id", "raw_conf", "dedup_hit", "cooldown_hit", "exclusion_hit", "reason", "path_points", "path_predictor", "path_corridor_distance", "path_total_displacement"] as const;
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
      event.provenance?.path?.points ? JSON.stringify(event.provenance.path.points) : undefined,
      event.provenance?.path?.predictor ? predictorLabel(event.provenance.path.predictor) : undefined, event.provenance?.path?.corridor_distance, event.provenance?.path?.total_displacement,
    ].map(csvValue).join(","));
    const blob = new Blob([[columns.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "lab-events.csv"; anchor.click();
    URL.revokeObjectURL(url);
  }
  const stats = useMemo(() => result ? [{ label: "frames", value: result.frames_processed }, { label: "max sacks / frame", value: result.max_sack_per_frame }, { label: "avg sacks / frame", value: result.avg_sack_per_frame }] : [], [result]);
  const capability = (name: keyof LabCapabilities) => Boolean(backendCapabilities[name] || result?.capabilities?.[name]);
  const events = result?.events;
  const selectedEvent = events?.find((event) => event.event_id === selectedEventId) ?? null;
  const summary = result?.summary;
  const hasSummary = Boolean(summary);
  const manifest = result?.manifest ?? result?.run;
  const manifestConfig = manifest ? getManifestConfig(manifest) : undefined;
  const manifestReady = Boolean(manifest?.run_id && manifest?.schema_version && manifestConfig);
  const baselineRun = runHistory?.find((run) => run.run_id === baselineRunId) ?? null;
  const currentRun = runHistory?.find((run) => run.run_id === currentRunId) ?? null;
  const runCompare = baselineRun && currentRun && baselineRun.run_id !== currentRun.run_id
    ? compareRunManifests(baselineRun, currentRun) : null;
  const trailPaths = result?.trails ?? result?.paths ?? result?.trail?.paths ?? [];
  const trailSupported = capability("trail") || capability("path") || trailPaths.length > 0;
  const pathEvents = events?.filter((event) => event.provenance.path?.points?.length) ?? [];
  const hasPathMetadata = trailPaths.length > 0 || pathEvents.length > 0;
  const scorerMode = result?.scorer_mode;
  const scorerConfigEntries = scorerEntries(result?.scorer_config);
  const scorerFeatureEntries = scorerEntries(result?.scorer_features);
  const scoredEvents = events?.filter((event) => event.score_breakdown || event.verdict) ?? [];
  const hasScorerEventOutput = scoredEvents.length > 0;
  const scorerOutputAvailable = Boolean(scorerMode || scorerConfigEntries.length || scorerFeatureEntries.length || hasScorerEventOutput);
  const scorerLockedReason = !capability("scorer")
    ? "Locked: the backend health contract reports scorer capability=false."
    : !hasScorerEventOutput
      ? "Locked: this run returned no event score_breakdown or verdict fields."
      : "";
  const statusLabel = (status: "confirmed" | "flagged" | "excluded") => status.toUpperCase();
  const directionLabel = (direction: "in" | "out" | "unknown") => direction === "unknown" ? "UNKNOWN" : direction.toUpperCase();

  return <div className="lab-shell">
    <header className="lab-topbar"><div><span className="lab-kicker">RESEARCH CONTROL ROOM / {hasSummary ? "V1 COUNTING" : "V0 DETECTION"}</span><h2><FlaskConical size={20} /> Lab Replay</h2></div><div className="lab-top-status"><span className={`lab-status-dot ${backendUp ? "up" : backendUp === false ? "down" : "checking"}`} />{backendUp ? "backend online" : backendUp === false ? "backend unavailable" : "checking backend"}<span className={`lab-chip ${events ? "lab-chip-live" : ""}`}>{events ? `${events.length} events` : "no event stream"}</span></div></header>
    {backendUp === false && <div className="lab-alert"><AlertTriangle size={16} /><span>Lab backend is unavailable. Start <code>python apps/api/lab_server.py</code> on port 8077.</span><button className="lab-button lab-button-retry" type="button" onClick={() => window.location.reload()}>Retry connection</button></div>}
    <div className="lab-workspace">
      <aside className="lab-sidebar">{sections.map((section) => <section className="lab-accordion" key={section.n}><SectionHeader section={section} onToggle={() => toggleSection(section.n)} />{section.open && <div className="lab-section-body">
        {section.n === 1 && <><label>Source video<input type="file" accept="video/*" onChange={(e) => selectVideo(e.target.files?.[0] ?? null)} /></label><div className="lab-file-row"><span className={video ? "lab-ok" : "lab-muted"}>{video ? "READY" : "EMPTY"}</span><span>{video?.name ?? "Choose a video file"}</span></div><div className="lab-field-grid"><label>Frame start<input type="number" min="0" value={cfg.frame_start ?? 0} onChange={(e) => set("frame_start", +e.target.value)} /></label><label>Frame end<input type="number" min="0" placeholder="end" value={cfg.frame_end ?? ""} onChange={(e) => set("frame_end", e.target.value ? +e.target.value : undefined)} /></label></div><label><span>Frame stride <Hint text="Process every Nth video frame; higher values trade detail for speed." /></span><strong>{cfg.frame_stride}</strong><input type="range" min="1" max="10" value={cfg.frame_stride} onChange={(e) => set("frame_stride", +e.target.value)} /></label><div className="lab-field-grid"><label><span>GT target <Hint text="Optional human-verified count used only for backend scoring." /><em>(optional)</em></span><input type="number" min="0" step="1" placeholder="not supplied" value={cfg.ground_truth ?? ""} onChange={(e) => set("ground_truth", e.target.value === "" ? undefined : Math.max(0, Math.floor(+e.target.value)))} /></label><label><span>Tolerance <Hint text="Allowed absolute error from GT, entered as a percentage." /><em>(optional %)</em></span><input type="number" min="0" step="0.1" placeholder="not supplied" value={cfg.tolerance_pct == null ? "" : cfg.tolerance_pct * 100} onChange={(e) => set("tolerance_pct", e.target.value === "" ? undefined : Math.max(0, +e.target.value) / 100)} /></label></div><p className="lab-note">GT target is a human count for scoring. No GT or tolerance is assumed when left blank.</p><button className="lab-button lab-button-subtle" type="button" onClick={() => setCfg({ ...DEFAULT_CFG, ground_truth: undefined, tolerance_pct: undefined })}><RotateCcw size={13} /> Reset deployed defaults</button><p className="lab-note">Source state is local-only until Run Replay.</p></> }
        {section.n === 2 && <><div className="lab-model-tabs">{(["registry", "local", ...(legacyModels.length ? ["legacy"] : [])] as const).map((mode) => <button key={mode} type="button" className={modelMode === mode ? "active" : ""} onClick={() => { setModelMode(mode as "registry" | "local" | "legacy"); if (mode === "registry") setLocalModel(null); setModelError(null); }}>{mode}</button>)}</div>{modelMode === "registry" && <>{registryLoading ? <p className="lab-note">Loading model registry…</p> : registry.length ? <><label>Registry version<select value={selectedVersion} onChange={(e) => { setSelectedVersion(e.target.value); setLocalModel(null); }}><option value="">Select version</option>{registry.map((v) => <option key={v.id} value={v.id}>v{v.semver} · {v.model_line_id}</option>)}</select></label><p className="lab-note">{selectedRegistry ? `Artifact: ${selectedRegistry.artifacts?.pytorch?.key}` : "Choose a version, then fetch the signed R2 artifact."}</p><button className="lab-button" type="button" disabled={!selectedRegistry || modelBusy} onClick={downloadRegistryModel}>{modelBusy ? `Fetching model ${modelProgress}%` : <><Download size={14} /> Fetch model</>}</button></> : <p className="lab-note lab-error">{registryError ?? "No PyTorch artifacts found."}</p>}</>}{modelMode === "local" && <label>Local .pt<input type="file" accept=".pt,application/octet-stream" onChange={(e) => { const file = e.target.files?.[0] ?? null; const valid = !!file && file.name.toLowerCase().endsWith(".pt"); setLocalModel(valid ? file : null); setModelError(file && !valid ? "Choose a .pt file." : null); }} /></label>}{modelMode === "legacy" && <label>Legacy backend model<select value={legacyModel} onChange={(e) => setLegacyModel(e.target.value)}>{legacyModels.map((model) => <option key={model} value={model}>{model.split("/").pop()}</option>)}</select></label>}{localModel && <div className="lab-file-row lab-ok"><Upload size={14} /> {localModel.name} · ready</div>}{modelError && <p className="lab-error">{modelError}</p>}<label><span>Prefilter confidence <Hint text="Minimum detector confidence kept before tracking." /></span><strong>{(cfg.conf ?? 0).toFixed(2)}</strong><input type="range" min="0.05" max="0.95" step="0.05" value={cfg.conf} onChange={(e) => set("conf", +e.target.value)} /></label><label><span>NMS-IoU <Hint text="Overlap threshold for suppressing duplicate detector boxes." /></span><strong>{(cfg.iou ?? 0).toFixed(2)}</strong><input type="range" min="0.1" max="0.95" step="0.05" value={cfg.iou} onChange={(e) => set("iou", +e.target.value)} /><span className="lab-note">Editable on .pt/.onnx only; baked on HEF.</span></label><div className="lab-inline-checks"><label><input type="checkbox" checked={(cfg.classes ?? []).includes(0)} onChange={() => toggleClass(0)} /> person</label><label><input type="checkbox" checked={(cfg.classes ?? []).includes(1)} onChange={() => toggleClass(1)} /> sack</label></div></>}

        {section.n === 3 && <><span className="lab-capability-state">{capability("tracker") ? "TRACKER WIRED" : "TRACKER CAPABILITY REQUIRED"}</span><DisabledField><span>Tracker <Hint text="Backend tracker used to maintain object identity across frames." /></span><select disabled={!capability("tracker")} value={cfg.tracker_type ?? "bytetrack"} onChange={(e) => set("tracker_type", e.target.value)}><option value="bytetrack">ByteTrack</option></select></DisabledField><DisabledField><span>Track buffer <Hint text="Frames an unmatched track remains alive before removal." /></span><input disabled={!capability("tracker")} type="number" min="1" max="300" step="1" value={cfg.track_buffer ?? 30} onChange={(e) => set("track_buffer", Math.max(1, Math.min(300, Math.floor(Number(e.target.value) || 1))))} /></DisabledField><DisabledField><span>Match threshold <Hint text="Association threshold used to match detections to existing tracks." /></span><input disabled={!capability("tracker")} type="number" min="0" max="1" step="0.01" value={cfg.match_thresh ?? 0.7} onChange={(e) => set("match_thresh", Math.max(0, Math.min(1, Number(e.target.value) || 0)))} /></DisabledField></>}
        {section.n === 4 && <><div className="lab-line-status"><GitBranch size={14} />{cfg.line ? "canonical line ready" : "no count line"}<span>frame_ref 0</span></div><button className="lab-button lab-button-cyan" type="button" disabled={!videoSize} onClick={() => { setDrawMode("line"); setDraftPoints([]); }}>Draw canonical count line</button><button className="lab-button" type="button" disabled={!cfg.line} onClick={clearLine}><X size={14} /> Clear line</button><label className="lab-check"><input type="checkbox" checked={!!cfg.inflip} onChange={(e) => { set("inflip", e.target.checked); if (cfg.line) set("line", { ...cfg.line, inflip: e.target.checked }); }} /> In / Out flip</label><hr /><button className="lab-button lab-button-amber" type="button" disabled={!videoSize} title="Ignore detections inside this backend-owned polygon" onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}>Add exclusion zone <Hint text="Polygon where detections are excluded by the backend." /></button>{drawMode === "zone" && <button className="lab-button" type="button" disabled={!draftPoints.length} onClick={commitZone}>Commit zone ({draftPoints.length} pts)</button>}{zones.map((zone) => <div className="lab-zone-row" key={zone.zone_id}><label><input type="checkbox" checked={zone.enabled} onChange={() => toggleZone(zone.zone_id)} />{zone.zone_id}</label><button type="button" className="lab-icon-button" onClick={() => deleteZone(zone.zone_id)} aria-label={`Delete ${zone.zone_id}`}><Trash2 size={14} /></button></div>)}<p className="lab-note">All geometry is pixel-space and anchored to frame 0.</p></>}
        {section.n === 5 && <><span className="lab-capability-state">COUNTING CONTRACT</span><div className="lab-field-grid"><label><span>Conf split <Hint text="Confidence boundary used to separate confirmed and flagged detections." /></span><input type="number" min="0" max="1" step="0.01" value={cfg.conf_split ?? 0.6} onChange={(e) => set("conf_split", Math.max(0, Math.min(1, Number(e.target.value) || 0)))} /></label><label><span>ROI dedup radius <Hint text="Pixel distance used to treat nearby ROI crossings as duplicates." /></span><input type="number" min="0" max="1000" step="1" value={cfg.roi_dedup_px ?? 25} onChange={(e) => set("roi_dedup_px", Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))))} /></label><label><span>ROI dedup frames <Hint text="Frames during which a nearby repeated crossing is deduplicated." /></span><input type="number" min="0" max="10000" step="1" value={cfg.roi_dedup_frames ?? 120} onChange={(e) => set("roi_dedup_frames", Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0))))} /></label><label><span>Count cooldown <Hint text="Minimum frames between accepted count events for the same track." /></span><input type="number" min="0" max="10000" step="1" value={cfg.count_cooldown_frames ?? 40} onChange={(e) => set("count_cooldown_frames", Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0))))} /></label></div><p className="lab-note">Confirmed/flagged counts are emitted only when the backend returns result.summary.</p></>}
        {section.n === 6 && <><span className="lab-capability-state">{capability("healer") ? "HEALER WIRED" : "HEALER NOT WIRED"}</span><p className="lab-note">Occlusion recovery is backend-owned. No local healer controls are exposed until capability metadata is available.</p></>}
        {section.n === 7 && <><div className="lab-scorer-head"><span className="lab-capability-state">{capability("scorer") ? (scorerOutputAvailable ? "SCORER OUTPUT" : "SCORER CAPABILITY · NO OUTPUT") : "SCORER NOT WIRED"}</span>{scorerMode && <span className={`lab-scorer-mode ${scorerMode}`}>{scorerModeLabel(scorerMode)}</span>}</div>{scorerLockedReason ? <div className="lab-locked-output"><strong>SCORER CONTROLS LOCKED</strong><span>{scorerLockedReason}</span><span>Controls will appear only when the backend returns scorer-owned fields.</span></div> : <div className="lab-scorer-contract"><div><span className="lab-output-label">MODE</span><strong>{scorerModeLabel(scorerMode)}</strong></div>{scorerConfigEntries.length > 0 && <div><span className="lab-output-label">CONFIG</span><div className="lab-scorer-list">{scorerConfigEntries.map(([key, value]) => <code key={key}>{key}: {scorerValue(value)}</code>)}</div></div>}{scorerFeatureEntries.length > 0 && <div><span className="lab-output-label">FEATURES</span><div className="lab-scorer-list">{scorerFeatureEntries.map(([key, value]) => <code key={key}>{key}: {scorerValue(value)}</code>)}</div></div>}<p className="lab-note">Scorer configuration and features are read-only backend output. No browser-side weights or healer controls are exposed.</p></div>}</>}
        {section.n === 8 && <><div className="lab-output-group"><span className="lab-output-label">OVERLAY EXPORTS</span><button className="lab-button" type="button" disabled={!result} onClick={() => result && window.open(result.video_url, "_blank")}><Download size={14} /> Download overlay</button><button className="lab-button" type="button" onClick={downloadConfig}><Download size={14} /> Download config JSON</button><button className="lab-button" type="button" disabled={!result?.events?.length} onClick={downloadEventsCsv}><Download size={14} /> Count CSV <span className="lab-muted">(events only)</span></button></div>{trailSupported ? <div className="lab-trail-controls"><span className="lab-output-label">TRAIL DISPLAY</span><label className="lab-check"><input type="checkbox" checked={showTrail} onChange={(event) => setShowTrail(event.target.checked)} /> Show backend trail</label><label>Trail length <strong>{trailLength}</strong><input type="range" min="1" max="120" value={trailLength} onChange={(event) => setTrailLength(+event.target.value)} /></label><p className="lab-note">Sent to the backend on the next replay. No trail is inferred in the browser.</p></div> : <div className="lab-locked-output"><span className="lab-output-label">TRAIL / PATH</span><strong>LOCKED · backend capability required</strong><span>Trail controls appear when health or run metadata advertises backend-owned paths.</span></div>}</>}
      </div>}</section>)}</aside>

      <main className="lab-center"><div className="lab-viewer-card"><div className="lab-viewer-head"><div><span className="lab-kicker">REPLAY VIEWER</span><h3>{video?.name ?? "No source loaded"}</h3></div><div className="lab-meta"><span>{videoSize ? `${videoSize.width} × ${videoSize.height}` : "— × —"}</span><span>frame 0</span><span>{videoFps ? `${videoFps.toFixed(1)} fps` : "fps —"}</span></div></div><div className="lab-viewer"><div className="lab-viewer-empty">{video && videoUrl ? <><video ref={videoRef} src={videoUrl} controls onLoadedMetadata={handleVideoMetadata} onError={() => setEditorError("Unable to load this video.")} /><canvas ref={canvasRef} onClick={handleCanvasClick} aria-label="Lab drawing canvas" className={drawMode ? "drawing" : ""} /></> : <><Layers3 size={34} /><strong>Load a video to start the replay</strong><span>Detection overlay and geometry tools appear here.</span></>}</div></div>{editorError && <div className="lab-error-banner"><AlertTriangle size={14} /> {editorError}</div>}<div className="lab-tool-row"><button type="button" className={`lab-action-card ${drawMode === "line" ? "selected" : ""}`} disabled={!videoSize} onClick={() => { setDrawMode("line"); setDraftPoints([]); }}><GitBranch size={16} /><span>Draw Count Line</span><small>2 points · frame 0</small></button><button type="button" className={`lab-action-card ${drawMode === "zone" ? "selected" : ""}`} disabled={!videoSize} onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}><Layers3 size={16} /><span>Add Exclusion Zone</span><small>polygon editor</small></button><button type="button" className="lab-action-card" onClick={() => { set("inflip", !cfg.inflip); if (cfg.line) set("line", { ...cfg.line, inflip: !cfg.inflip }); }}><RotateCcw size={16} /><span>In–Out Flip</span><small>{cfg.inflip ? "flipped" : "normal"}</small></button><button type="button" className="lab-action-card" disabled title="Mid-clip switching is not wired in v0"><Play size={16} /><span>Mid-Clip Switch</span><small>not wired in v0</small></button></div><div className="lab-timeline"><span>00:00</span><div><i style={{ width: video ? "3%" : "0%" }} /></div><span>{videoRef.current?.duration ? `${Math.round(videoRef.current.duration)}s` : "—"}</span></div><div className="lab-run-row"><button className="lab-run-button" type="button" disabled={busy || !!runDisabledReason} onClick={run}><Play size={18} fill="currentColor" />{busy ? "Running replay…" : "Run Replay"}</button><span className="lab-run-hint">{busy ? "Backend is processing the replay; results will replace this state." : runDisabledReason || "Ready to run. Counts appear only when the backend returns a summary."}</span></div>{busy && <div className="lab-replay-progress" role="status" aria-live="polite"><div className="lab-replay-progress-head"><strong>Estimated client progress</strong><span>{replayProgress}%</span></div><div className="lab-progress-track"><div className="lab-progress-fill" style={{ width: `${replayProgress}%` }} /></div><div className="lab-replay-progress-meta"><span>Elapsed {formatElapsed(replayElapsedMs)}</span><span>Estimated remaining {formatElapsed(replayEtaMs)}</span></div><p className="lab-note">Estimate only — the single backend request does not report server progress. Progress is capped at 95% until the response arrives.</p></div>}{err && <div className="lab-error-banner"><AlertTriangle size={14} /> {err}</div>}</div></main>

      <aside className="lab-inspector"><section className="lab-inspector-card"><div className="lab-card-title"><span>OUTPUT PREVIEW</span>{result && <span className="lab-ok">READY</span>}</div>{result ? <><video src={result.video_url} controls /><div className="lab-stat-grid">{stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div><a className="lab-download-link" href={result.video_url} download><Download size={14} /> Download overlay.mp4</a></> : <div className="lab-empty-inspector"><Layers3 size={22} /><span>Run Replay to populate the backend output.</span></div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>REPRODUCIBILITY</span><span className={`lab-chip ${manifestReady ? "lab-chip-live" : ""}`}>{manifestReady ? "MANIFEST READY" : "BACKEND FIELD REQUIRED"}</span></div>{manifest ? <div className="lab-manifest-grid"><div><span>run ID</span><code>{manifest.run_id}</code></div><div><span>schema</span><code>{manifest.schema_version}</code></div><div><span>config snapshot</span><strong className={manifestConfig ? "lab-ok" : "lab-muted"}>{manifestConfig ? "AVAILABLE" : "NOT RETURNED"}</strong></div><button className="lab-button lab-button-cyan" type="button" disabled={!manifestReady} onClick={downloadManifest}><Download size={14} /> Export reproducible manifest JSON</button></div> : <div className="lab-research-empty">Run Replay did not return a backend-owned run manifest. Reproducible export stays locked; the browser does not synthesize one.</div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>RUN HISTORY</span><span className={`lab-chip ${runHistory?.length ? "lab-chip-live" : ""}`}>{runHistoryLoading ? "LOADING" : runHistory?.length ? `${runHistory.length} SAVED` : "EMPTY"}</span></div>{runHistoryLoading ? <div className="lab-research-empty">Checking the backend run store…</div> : runHistoryError ? <div className="lab-research-empty lab-history-locked">Run history is unavailable. No local history is shown.</div> : runHistory?.length ? <div className="lab-recent-runs">{runHistory.slice(0, 5).map((run) => <div className="lab-recent-run" key={run.run_id}><code>{run.run_id}</code><span>{run.schema_version}</span><small>{run.created_at}</small></div>)}</div> : <div className="lab-research-empty">The backend returned no saved runs yet.</div>}</section>
        <section className="lab-inspector-card lab-compare-card"><div className="lab-card-title"><span>A/B CONFIG COMPARE</span><span className={`lab-chip ${runCompare ? "lab-chip-live" : ""}`}>{runHistoryLoading ? "LOADING" : runHistoryError ? "LOCKED" : runHistory && runHistory.length >= 2 ? "READY" : "2 RUNS REQUIRED"}</span></div>{runHistoryLoading ? <div className="lab-research-empty">Waiting for backend RunManifest history…</div> : runHistoryError ? <div className="lab-research-empty lab-history-locked">Compare is locked because backend run history is unavailable. No local runs are substituted.</div> : runHistory && runHistory.length >= 2 ? <><div className="lab-compare-selects"><label>Baseline<select value={baselineRunId} onChange={(event) => setBaselineRunId(event.target.value)}>{runHistory.map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id}</option>)}</select></label><label>Current<select value={currentRunId} onChange={(event) => setCurrentRunId(event.target.value)}>{runHistory.map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id}</option>)}</select></label></div>{runCompare ? <><div className="lab-compare-ids"><span>baseline <code>{runCompare.baselineId}</code></span><span>current <code>{runCompare.currentId}</code></span></div><div className="lab-compare-block"><span className="lab-output-label">CHANGED CONFIG KEYS</span>{runCompare.changedConfigKeys.length ? <div className="lab-key-list">{runCompare.changedConfigKeys.map((key) => <code key={key}>{key}</code>)}</div> : <p className="lab-note">No changed keys in the backend snapshots.</p>}</div><div className="lab-compare-block"><span className="lab-output-label">BACKEND METRIC DELTAS</span>{runCompare.metricDeltas.length ? <div className="lab-delta-grid">{runCompare.metricDeltas.map((metric) => <div key={metric.key}><strong className={metric.delta > 0 ? "lab-delta-positive" : metric.delta < 0 ? "lab-delta-negative" : ""}>{metric.delta > 0 ? "+" : ""}{metric.delta}</strong><span>{metric.key} · {metric.baseline} → {metric.current}</span></div>)}</div> : <p className="lab-note">No shared numeric metrics were returned by both manifests. Nothing is inferred.</p>}</div><div className="lab-replay-controls"><span className="lab-output-label">REPLAY CONFIG</span><p className="lab-note">Load a selected manifest’s safe config into the editor. This changes local fields only; it never runs replay or changes the model.</p><div className="lab-compare-actions"><button className="lab-button lab-button-cyan" type="button" onClick={() => baselineRun && loadManifestConfig(baselineRun)}>Load baseline config</button><button className="lab-button lab-button-cyan" type="button" onClick={() => currentRun && loadManifestConfig(currentRun)}>Load current config</button></div></div></> : <div className="lab-research-empty">Choose two different backend manifests to compare.</div>}</> : <div className="lab-research-empty lab-history-locked">A/B compare is locked until the backend returns at least two actual RunManifests. No counts, events, or deltas are estimated.</div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>COUNT SUMMARY</span><span className={`lab-chip ${hasSummary ? "lab-chip-live" : ""}`}>{hasSummary ? "BACKEND SUMMARY" : "SUMMARY REQUIRED"}</span></div>{summary ? <div className="lab-summary-grid">{(["confirmed", "flagged", "recovered", "excluded", "total"] as const).map((key) => <div className={`lab-summary-value lab-summary-${key}`} key={key}><strong>{summary[key]}</strong><span>{key.replace("_", " ")}</span></div>)}{summary.ground_truth != null && <div className="lab-summary-value lab-summary-gt"><strong>{summary.ground_truth}</strong><span>GT target</span></div>}{summary.error_vs_ground_truth != null && <div className="lab-summary-value lab-summary-error"><strong>{summary.error_vs_ground_truth}</strong><span>error vs GT</span></div>}{(summary.tolerance_pct != null || summary.tolerance_state != null) && <div className={`lab-summary-note lab-tolerance-${summary.tolerance_state ?? "unknown"}`}><span>tolerance</span><strong>{summary.tolerance_pct != null ? `${(summary.tolerance_pct * 100).toFixed(1)}%` : "—"}</strong>{summary.tolerance_state && <em>{summary.tolerance_state.toUpperCase()}</em>}</div>}</div> : <div className="lab-research-empty">{result ? "Backend returned no result.summary. Counts are not estimated from detection frames." : "Run Replay to show a backend-provided count summary."}</div>}</section>
        <section className="lab-inspector-card"><div className="lab-card-title"><span>PATH PROVENANCE</span><span className={`lab-chip ${hasPathMetadata ? "lab-chip-live" : ""}`}>{hasPathMetadata ? "BACKEND METADATA" : "LOCKED"}</span></div>{hasPathMetadata ? <div className="lab-path-metadata">{trailPaths.length > 0 && <div><strong>{trailPaths.length}</strong><span>track paths returned</span></div>}{pathEvents.length > 0 && <div><strong>{pathEvents.length}</strong><span>events with path slices</span></div>}{pathEvents.slice(0, 3).map((event) => <div className="lab-path-event" key={event.event_id}><span>event {event.sequence} · {event.provenance.path?.points.length} points</span><code>{predictorLabel(event.provenance.path?.predictor)}</code>{event.provenance.path?.total_displacement != null && <small>displacement {event.provenance.path.total_displacement.toFixed(1)} px</small>}</div>)}</div> : <div className="lab-research-empty">Path slices and trails appear here only when returned by the backend. The UI never builds paths from crossing events.</div>}</section>
        <section className="lab-inspector-card lab-events-card"><div className="lab-card-title"><span>PER-CROSSING DETAILS</span><span className={`lab-chip ${events?.length ? "lab-chip-live" : ""}`}>{events ? `${events.length} EVENT${events.length === 1 ? "" : "S"}` : "EVENTS REQUIRED"}</span></div>{events?.length ? <div className="lab-event-table-wrap"><table className="lab-event-table"><thead><tr><th>Seq</th><th>Frame</th><th>Time</th><th>Track</th><th>Dir</th><th>Status</th><th>Recovery</th><th>Conf</th></tr></thead><tbody>{events.map((event) => <tr key={event.event_id} className={selectedEventId === event.event_id ? "selected" : ""} aria-selected={selectedEventId === event.event_id} tabIndex={0} onClick={() => setSelectedEventId(event.event_id)} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); setSelectedEventId(event.event_id); } }}><td>{event.sequence}</td><td>{event.frame_index}</td><td>{safeNumber(event.timestamp_ms / 1000)}s</td><td>{event.track_id ?? "—"}</td><td>{directionLabel(event.direction)}</td><td><span className={`lab-event-status ${event.status}`}>{statusLabel(event.status)}</span></td><td>{event.recovery === "recovered" ? <span className="lab-recovered">RECOVERED</span> : "—"}</td><td>{safeNumber(event.detection_conf)}</td></tr>)}</tbody></table></div> : <div className="lab-research-empty lab-event-empty">{events ? "Detection-only run: backend returned no crossing events. Crossing inspection is locked." : "No result.events[] returned. Crossing inspection is locked until the backend emits crossing events."}</div>}</section>
        <section className="lab-inspector-card lab-crossing-inspector"><div className="lab-card-title"><span>CROSSING INSPECTOR</span><span className={`lab-chip ${selectedEvent ? "lab-chip-live" : ""}`}>{selectedEvent ? `EVENT ${selectedEvent.sequence}` : "SELECT A ROW"}</span></div>{selectedEvent ? <div className="lab-crossing-detail"><div className="lab-detail-grid"><div><span>frame</span><strong>{selectedEvent.frame_index}</strong></div><div><span>time</span><strong>{safeNumber(selectedEvent.timestamp_ms / 1000)}s</strong></div><div><span>track</span><strong>{selectedEvent.track_id ?? "—"}</strong></div><div><span>direction</span><strong>{directionLabel(selectedEvent.direction)}</strong></div><div><span>status</span><strong className={`lab-detail-${selectedEvent.status}`}>{statusLabel(selectedEvent.status)}</strong></div><div><span>recovery</span><strong>{selectedEvent.recovery.toUpperCase()}</strong></div><div><span>confidence</span><strong>{safeNumber(selectedEvent.detection_conf)}</strong></div></div><div className="lab-detail-block"><span className="lab-output-label">DECISION PROVENANCE</span><div className="lab-flag-grid"><span>raw conf <strong>{safeNumber(selectedEvent.provenance?.decision?.raw_conf)}</strong></span><span>dedup hit <strong>{selectedEvent.provenance?.decision?.dedup_hit ? "yes" : "no"}</strong></span><span>cooldown hit <strong>{selectedEvent.provenance?.decision?.cooldown_hit ? "yes" : "no"}</strong></span><span>exclusion hit <strong>{selectedEvent.provenance?.decision?.exclusion_hit ? "yes" : "no"}</strong></span><span>recovered <strong>{selectedEvent.provenance?.decision?.recovered ? "yes" : "no"}</strong></span></div><p className="lab-detail-reason">reason: {selectedEvent.provenance?.decision?.reason ?? "—"}</p></div><div className="lab-detail-block"><span className="lab-output-label">GEOMETRY</span><div className="lab-detail-list"><span>centroid <code>{safePoint(selectedEvent.provenance?.geometry?.centroid ?? selectedEvent.centroid)}</code></span><span>line <code>{safeLine(selectedEvent.provenance?.geometry?.line)}</code></span><span>zone <code>{selectedEvent.provenance?.geometry?.zone_id ?? selectedEvent.exclusion_zone_id ?? "—"}</code></span></div></div>{selectedEvent.provenance?.path ? <div className="lab-detail-block"><span className="lab-output-label">PATH PROVENANCE</span><div className="lab-detail-list"><span>predictor <code>{predictorMetadata(selectedEvent.provenance.path.predictor)}</code></span><span>points <code>{selectedEvent.provenance.path.points.length}</code></span><span>corridor distance <code>{safeNumber(selectedEvent.provenance.path.corridor_distance)}</code></span><span>total displacement <code>{safeNumber(selectedEvent.provenance.path.total_displacement)}</code></span></div><div className="lab-path-points">{selectedEvent.provenance.path.points.map((point, index) => <code key={`${point.frame}-${index}`}>f{point.frame} · {safeNumber(point.t_ms / 1000)}s · ({safeNumber(point.cx)}, {safeNumber(point.cy)}) · c{safeNumber(point.conf)}</code>)}</div></div> : <div className="lab-detail-block lab-detail-locked"><span className="lab-output-label">PATH PROVENANCE</span><span>Locked: this event has no backend-emitted path slice.</span></div>}{selectedEvent.score_breakdown || selectedEvent.verdict ? <div className="lab-detail-block"><span className="lab-output-label">SCORER BREAKDOWN</span>{selectedEvent.verdict && <strong className={`lab-score-verdict ${(selectedEvent.verdict ?? "").toLowerCase()}`}>{verdictLabel(selectedEvent.verdict)}</strong>}{selectedEvent.score_breakdown ? <div className="lab-score-breakdown">{scorerEntries(selectedEvent.score_breakdown).map(([key, value]) => <div key={key}><span>{key}</span><code>{scorerValue(value)}</code></div>)}</div> : <p className="lab-note">Backend returned a verdict without score_breakdown.</p>}</div> : <div className="lab-detail-block lab-detail-locked"><span className="lab-output-label">SCORER BREAKDOWN</span><span>Locked: this event has no backend-emitted scorer fields.</span></div>}</div> : <div className="lab-research-empty">{events?.length ? "Choose a crossing row to inspect backend provenance." : "Crossing inspector locked: no backend crossing events are available."}</div>}</section>
        <section className="lab-inspector-card lab-scorer-card"><div className="lab-card-title"><span>SCORER BREAKDOWN</span><span className={`lab-chip ${hasScorerEventOutput ? "lab-chip-live" : ""}`}>{hasScorerEventOutput ? `${scoredEvents.length} SCORED` : "BACKEND OUTPUT REQUIRED"}</span></div>{hasScorerEventOutput ? <div className="lab-score-events">{scoredEvents.map((event) => <article className="lab-score-event" key={event.event_id}><div className="lab-score-event-head"><strong>#{event.sequence} · {event.event_id}</strong><span className={`lab-score-verdict ${(event.verdict ?? "").toLowerCase()}`}>{verdictLabel(event.verdict)}</span></div>{event.score_breakdown && <div className="lab-score-breakdown">{scorerEntries(event.score_breakdown).map(([key, value]) => <div key={key}><span>{key}</span><code>{scorerValue(value)}</code></div>)}</div>}{!event.score_breakdown && <p className="lab-note">Backend returned a verdict without score_breakdown.</p>}</article>)}</div> : <div className="lab-research-empty">{scorerLockedReason || "Per-event score_breakdown and verdict fields appear here only when emitted by the backend. No score is inferred from confidence, status, or paths."}</div>}</section></aside>
    </div>
  </div>;
}
