/**
 * Replay — the research instrument, rebuilt on the system's own theme.
 *
 * The engine is carried over verbatim from sections/Lab.tsx: the same
 * lib/labApi.ts client, the same canvas letterbox mapping, the same async job
 * loop with its backoff and its legacy synchronous fallback, the same
 * capability negotiation, the same durable tasks, the same CSV and manifest
 * exports. What changed is the visual language: twelve private `--lab-*` tokens
 * and a viewport-wide dark repaint became the app's own tokens, and the
 * instrument's density now comes from spacing and type rather than from a
 * second colour system (DESIGN.md:1062).
 *
 * Formatted one thing per line on purpose. Several lines of Lab.tsx are 4-6 kB
 * each, which is how reading `result.diagnostics` where the backend sends
 * `detection_diagnostics` survived long enough to render LOCKED on every
 * successful run — docs/web-review.md finding 6.
 *
 * What is deliberately NOT carried, each with its reason, is recorded in
 * .scratch/experiment-lab/research/08-replay-rebuild-spec.md §3: the dark
 * shell, the inert Match-threshold control (its derived value survives as a
 * read-only line), the trail knobs nothing consumes, the permanently-disabled
 * Mid-Clip Switch, the timeline strip that read 3% for every video, and the
 * delta colour that inferred "better" from a sign.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  Download, FlaskConical, GitBranch, Layers3, Play, RotateCcw, Trash2, Upload, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Hint } from "../components/Hint";
import {
  compareRunManifests, createLabTask, getInferJob, labHealth, labModels, labRuns, labTask, labTasks,
  LabJobEndpointUnavailable, manifestConfig as getManifestConfig, replayConfigFromManifest,
  updateLabTask, runInfer, startInferJob,
  type DetectionConfidenceBin, type ExclusionZone, type LabCapabilities, type LabConfig,
  type LabHealth, type LabJobStatus, type LabResult, type LabTask, type Point, type RunManifest,
  type ScorerMode, type ScorerVerdict,
} from "../lib/labApi";

type RegistryVersion = {
  id: string; semver: string; model_line_id: string; artifacts: { pytorch?: { key?: string } } | null;
  metadata: Record<string, unknown> | null; size_bytes: number | null; created_at: string;
};
type DrawMode = "line" | "zone" | null;
type ModelMode = "registry" | "local" | "legacy";
type EventStatus = "confirmed" | "flagged" | "excluded";

// Must agree with webui/lab_core.py::LabConfig. Two values did not: `inflip` was
// inverted here, which swaps "in" for "out" in the count, and `tracker_type` named a
// tracker the backend does not run. tests/test_lab_ground_truth.py pins the Python
// side; apps/web/src/sections/Replay.test.tsx pins this one. Both are a stopgap
// until the shared counting engine owns one config vocabulary.
export const DEFAULT_CFG: LabConfig = {
  conf: 0.25, iou: 0.7, classes: [0, 1], frame_stride: 2, device: "mps",
  exclusion_zones: [], line: null, inflip: true, tracker_type: "centroid",
  track_buffer: 30, match_thresh: 0.7, conf_split: 0.6, roi_dedup_px: 25,
  roi_dedup_frames: 120, count_cooldown_frames: 40, heal: false,
  heal_require_person: true, max_gap_frames: 15,
};

const RAIL_SECTIONS = [
  "Input/Session", "Detection", "Tracker", "Line/Geometry",
  "Counting/Dedup", "Occlusion-Recovery", "Scorer", "Output/Export",
] as const;
/** Sections 1, 2 and 4 open by default — the ones a run cannot start without. */
const RAIL_OPEN_BY_DEFAULT = new Set([1, 2, 4]);

export const LETTERBOX_REFUSAL = "Click inside the rendered video area, not the letterbox bars.";
export const ZONE_MIN_POINTS = 3;

/**
 * The Match-threshold control is gone; this is what it really did.
 *
 * webui/lab_core.py:579 computes `max(roi_dedup_px, 50 * (1 - match_thresh))`, so with
 * the shipped 25 px and 0.70 the second term is 15 and is discarded — the whole upper
 * half of the old slider produced identical runs. Rather than leave that hidden, the
 * tracker section shows the derived value and says when the knob would be inert.
 */
export function matchDistancePx(cfg: { match_thresh?: number | null; roi_dedup_px?: number | null }) {
  const dedup = Number(cfg.roi_dedup_px ?? 25);
  const thresh = Number(cfg.match_thresh ?? 0.7);
  const fromThresh = 50 * Math.max(0, 1 - thresh);
  const px = Math.max(dedup, fromThresh);
  return { px, inert: fromThresh <= dedup, crossover: Math.max(0, 1 - dedup / 50) };
}

export type LetterboxRect = { left: number; top: number; width: number; height: number };
export type ClickMapping = { point: Point; refusal?: undefined } | { point?: undefined; refusal: string };

/**
 * A click on the overlay canvas, in source pixels.
 *
 * The canvas is stretched over a `object-fit: contain` video, so the rendered
 * picture is centred inside the container with letterbox bars on two sides. A
 * click on a bar maps to no source pixel at all, and is refused with a reason
 * rather than clamped to an edge — DESIGN.md:942 quotes this sentence.
 */
export function sourcePointFromClick(
  click: { clientX: number; clientY: number },
  container: LetterboxRect,
  source: { width: number; height: number },
): ClickMapping {
  const aspect = source.width / source.height;
  const renderedWidth = Math.min(container.width, container.height * aspect);
  const renderedHeight = renderedWidth / aspect;
  const renderedLeft = container.left + (container.width - renderedWidth) / 2;
  const renderedTop = container.top + (container.height - renderedHeight) / 2;
  const x = click.clientX - renderedLeft;
  const y = click.clientY - renderedTop;
  if (x < 0 || x > renderedWidth || y < 0 || y > renderedHeight) return { refusal: LETTERBOX_REFUSAL };
  return {
    point: [
      Math.max(0, Math.min(source.width - 1, Math.round((x / renderedWidth) * source.width))),
      Math.max(0, Math.min(source.height - 1, Math.round((y / renderedHeight) * source.height))),
    ],
  };
}

/** A polygon under three points is not a zone. Refused with the reason, never silently ignored. */
export function zoneRefusal(points: Point[]): string | null {
  return points.length < ZONE_MIN_POINTS ? "Exclusion zone needs at least 3 points." : null;
}

/** Two committed points become the canonical line, anchored to frame 0 in pixel space. */
export function lineFromPoints(points: Point[], inflip: boolean) {
  if (points.length !== 2) return null;
  return {
    x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1],
    coordinate_space: "pixel" as const, frame_ref: 0, inflip,
  };
}

/** All four reasons a run cannot start, in the order they are checked. */
export function runDisabledReason(state: {
  hasVideo: boolean; backendUp: boolean | null; modelReady: boolean; hasVideoSize: boolean;
}): string {
  if (!state.hasVideo) return "Add a source video to begin.";
  if (!state.backendUp) return "Lab backend unavailable.";
  if (!state.modelReady) return "Select or upload a .pt model first.";
  if (!state.hasVideoSize) return "Waiting for video metadata.";
  return "";
}

/**
 * The artifact chip for the provenance strip.
 *
 * The kind is always `pt`: webui/lab_core.py runs ultralytics, so this surface
 * cannot produce a `.hef` number. A `.pt` number sitting beside a `.hef` number
 * with no label is the bug class DESIGN.md:844 exists to close.
 */
export function artifactLabel(mode: ModelMode, source: {
  semver?: string | null; localName?: string | null; legacyPath?: string | null;
}): string {
  if (mode === "registry" && source.semver) return `v${source.semver} · pt`;
  if (mode === "local" && source.localName) return `${source.localName} · pt`;
  if (mode === "legacy" && source.legacyPath) return `${source.legacyPath.split("/").pop()} · pt`;
  return "no artifact selected";
}

/**
 * A frame range is shown only when one is set, so a range on screen always
 * means "not the whole clip" (DESIGN.md:848).
 */
export function frameRangeLabel(cfg: { frame_start?: number; frame_end?: number }): string | null {
  const start = cfg.frame_start;
  const end = cfg.frame_end;
  if ((start == null || start === 0) && end == null) return null;
  return `frames ${start ?? 0}–${end ?? "end"}`;
}

/** Bar width for one histogram bin, relative to the largest bin in the set. */
export function histogramBarPercent(count: number, max: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (count / max) * 100));
}

/** A token's colour, resolved once per paint. The canvas needs a literal string;
 *  reading the token is how it stays one colour system (spec §2.1). */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

function overlayColor(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function scorerValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(3) : "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value) ?? "[unavailable]"; } catch { return "[unavailable]"; }
}
function diagnosticObjectValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value) ?? "[unavailable]"; } catch { return "[unavailable]"; }
}
export function confidenceBinLabel(bin: DetectionConfidenceBin): string {
  return `${safeNumber(bin.lower, 2)}–${safeNumber(bin.upper, 2)}`;
}
export function safeNumber(value: unknown, digits = 2): string {
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
/** The predictor, as the backend described it. Lab.tsx had two functions here with
 *  identical bodies (`predictorLabel` and `predictorMetadata`); this is the one. */
function predictorLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "predictor not supplied";
  const metadata = value as { requested?: unknown; supported?: unknown; status?: unknown; points_used?: unknown };
  const requested = typeof metadata.requested === "string" ? metadata.requested : "unknown";
  const status = typeof metadata.status === "string"
    ? metadata.status
    : metadata.supported === true ? "supported" : metadata.supported === false ? "unsupported" : "status unknown";
  const points = typeof metadata.points_used === "number" ? ` · ${metadata.points_used} pts` : "";
  return `${requested} · ${status}${points}`;
}
export function formatElapsed(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function jobProgressPercent(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number == null) return null;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}
function waitForReplayPoll(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Replay polling cancelled", "AbortError"));
    }, { once: true });
  });
}
function scorerEntries(values: Record<string, unknown> | undefined) {
  return values ? Object.entries(values).filter(([, value]) => value !== undefined) : [];
}
function scorerModeLabel(mode: ScorerMode | undefined): string {
  return mode === "fused" ? "FUSED" : mode === "passthrough" ? "PASSTHROUGH" : "SCORER OUTPUT REQUIRED";
}
function verdictLabel(verdict: ScorerVerdict | undefined): string {
  return verdict ? verdict.toUpperCase() : "—";
}
/** A verdict is its own pill family: `excluded` is muted because an exclusion is a
 *  decision the operator asked for, not a failure. */
function verdictPill(value: string | undefined): string {
  const key = (value ?? "").toLowerCase();
  if (key === "confirmed") return "pill-verdict-confirmed";
  if (key === "flagged") return "pill-verdict-flagged";
  if (key === "excluded") return "pill-verdict-excluded";
  if (key === "rejected") return "pill-verdict-rejected";
  return "pill-muted";
}

/* -----------------------------------------------------------------------------
 * Small presentational pieces — the DESIGN.md components this surface uses.
 * -------------------------------------------------------------------------- */

function Panel({ eyebrow, badge, children }: { eyebrow: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel-dense">
      <div className="panel-dense-head">
        <span className="eyebrow">{eyebrow}</span>
        {badge}
      </div>
      {children}
    </section>
  );
}

function RefusalBanner({ children }: { children: ReactNode }) {
  return (
    <div className="refusal-banner" role="alert">
      <span aria-hidden="true">⛔</span>
      {children}
    </div>
  );
}

function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="warning-banner">
      <span aria-hidden="true">⚠</span>
      {children}
    </div>
  );
}

/** A locked panel is an empty state with a cause: what is locked, why, and what
 *  would unlock it (DESIGN.md:820). The reason is always the backend's own. */
function LockedPanel({ label, reason, unlock, compact }: {
  label: string; reason: string; unlock?: string; compact?: boolean;
}) {
  return (
    <div className={`locked-panel${compact ? " locked-panel-compact" : ""}`}>
      <span className="micro-uppercase">{label}</span>
      <p>{reason}</p>
      {unlock && <p>{unlock}</p>}
    </div>
  );
}

function ProvenanceBlock({ label, rows, children }: {
  label: string; rows?: [string, ReactNode][]; children?: ReactNode;
}) {
  return (
    <div className="provenance-block">
      <span className="micro-uppercase">{label}</span>
      {rows && (
        <div className="provenance-rows">
          {rows.map(([key, value]) => (
            <div key={key} style={{ display: "contents" }}>
              <span className="pk">{key}</span>
              <span className="pv">{value}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The strip that sits under every measured number on this surface.
 *
 * `reportable` is driven by the record, never by the renderer, and nothing here
 * writes an `evaluations` row or a `clip_id` yet — so it reads `unverified`,
 * with the reason on the pill. That is the project's own rule applied to a UI: a
 * missing provenance block is treated as unverified, not assumed reportable.
 */
function ProvenanceStrip({ artifact, clip, frameRange }: {
  artifact: string; clip: string | null; frameRange: string | null;
}) {
  return (
    <div className="provenance-strip">
      <span className="chip">{artifact}</span>
      <span className="provenance-clip">{clip ?? "no clip attached"}</span>
      {frameRange && <span className="code-inline">{frameRange}</span>}
      <span
        className="pill pill-waiting"
        title="no clip identity — the source is a browser file, not a registered clip"
      >
        unverified
      </span>
    </div>
  );
}

type Sourced = { artifact: string; clip: string | null; frameRange: string | null };

/** kpi-card-sourced: the numbers and the strip that says where they came from, in
 *  one visual block. A bare kpi-card is not permitted here (DESIGN.md:853). */
function SourcedMetrics({ items, sourced, columns }: {
  items: { label: string; value: ReactNode; headline?: boolean }[];
  sourced: Sourced;
  columns?: 2 | 3;
}) {
  return (
    <div className="kpi-card-sourced">
      <div className={`kpi-grid${columns === 2 ? " kpi-grid-2" : ""}`}>
        {items.map((item) => (
          <div className="kpi-cell" key={item.label}>
            <strong className={item.headline ? "kpi-value" : "metric-numeral-sm"}>{item.value}</strong>
            <span className="kpi-label">{item.label}</span>
          </div>
        ))}
      </div>
      <ProvenanceStrip {...sourced} />
    </div>
  );
}

function EmptyState({ statement, next }: { statement: string; next: string }) {
  return (
    <div className="empty-state">
      <p>{statement}</p>
      <p className="muted">{next}</p>
    </div>
  );
}

export function Replay() {
  const [cfg, setCfg] = useState<LabConfig>(DEFAULT_CFG);
  const [tasks, setTasks] = useState<LabTask[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  // The <video> element's metadata does not carry a frame rate, so this used to be
  // pinned at null and the HUD read "fps —" forever. The backend measures it and puts
  // it in the result (webui/lab_core.py), which is the number that matters anyway —
  // it is the one the count was computed against.
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
  const [replayProcessedFrames, setReplayProcessedFrames] = useState<number | null>(null);
  const [replayTotalFrames, setReplayTotalFrames] = useState<number | null>(null);
  const [replayProgressMode, setReplayProgressMode] = useState<"server" | "estimate" | null>(null);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [backendCapabilities, setBackendCapabilities] = useState<LabCapabilities>({});
  const [backendCapabilityDetails, setBackendCapabilityDetails] = useState<LabHealth["capability_details"]>({});
  const [backendUnsupportedCapabilities, setBackendUnsupportedCapabilities] = useState<string[]>([]);
  const [legacyModels, setLegacyModels] = useState<string[]>([]);
  const [legacyModel, setLegacyModel] = useState("");
  const [registry, setRegistry] = useState<RegistryVersion[]>([]);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [localModel, setLocalModel] = useState<File | null>(null);
  const [modelMode, setModelMode] = useState<ModelMode>("registry");
  const [modelBusy, setModelBusy] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunManifest[] | null>(null);
  const [runHistoryLoading, setRunHistoryLoading] = useState(true);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);
  // The backend reports whether its run store survives a restart. It does not
  // today — the store is an in-process dict — and a task can therefore list run
  // ids whose manifests are gone. Saying "SAVED" over that is a false promise.
  const [runHistoryPersistent, setRunHistoryPersistent] = useState<boolean | null>(null);
  const [baselineRunId, setBaselineRunId] = useState("");
  const [currentRunId, setCurrentRunId] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayStartedAtRef = useRef<number | null>(null);
  const replayEstimateMsRef = useRef<number | null>(null);
  const replayAbortRef = useRef<AbortController | null>(null);
  const replayRunRef = useRef(false);

  useEffect(() => {
    if (!busy) return;
    const startedAt = replayStartedAtRef.current ?? Date.now();
    replayStartedAtRef.current = startedAt;
    const estimateMs = replayEstimateMsRef.current ?? 15000;
    const update = () => {
      // Elapsed is always the client's to measure: it is wall-clock since submit, and
      // the server never sent elapsed_ms or eta_ms, so gating this on the estimate mode
      // froze the timer at 0:00 for the whole of every async replay while the frame
      // counter advanced beside it.
      const elapsed = Date.now() - startedAt;
      setReplayElapsedMs(elapsed);
      if (replayProgressMode === "server") {
        // Progress comes from the backend's frame count; the remaining time follows
        // from it, and is only meaningful once there is progress to extrapolate from.
        setReplayProgress((current) => {
          if (current > 0) setReplayEtaMs(Math.max(0, (elapsed / current) * (100 - current)));
          return current;
        });
        return;
      }
      const progress = Math.min(95, Math.floor((elapsed / estimateMs) * 100));
      setReplayProgress(progress);
      setReplayEtaMs(Math.max(0, estimateMs - elapsed));
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [busy, replayProgressMode]);

  useEffect(() => () => {
    replayAbortRef.current?.abort();
    replayAbortRef.current = null;
    replayRunRef.current = false;
    replayStartedAtRef.current = null;
    replayEstimateMsRef.current = null;
  }, []);

  useEffect(() => {
    const nextEvents = result?.events;
    if (!nextEvents?.length) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((current) =>
      current && nextEvents.some((event) => event.event_id === current) ? current : nextEvents[0].event_id);
  }, [result]);

  const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) =>
    setCfg((current) => ({ ...current, [key]: value }));
  const selectedRegistry = registry.find((version) => version.id === selectedVersion) ?? null;
  const modelReady = modelMode === "local"
    ? !!localModel
    : modelMode === "registry" ? !!selectedRegistry && !!localModel : !!legacyModel;
  const disabledReason = runDisabledReason({
    hasVideo: !!video, backendUp, modelReady, hasVideoSize: !!videoSize,
  });

  useEffect(() => {
    let cancelled = false;
    labTasks().then((items) => {
      if (cancelled) return;
      setTasks(items);
      if (items[0]) setSelectedTaskId((current) => current || items[0].task_id);
    }).catch((error) => {
      if (!cancelled) setTasksError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setTasksLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function loadTask(taskId: string) {
    if (!taskId) return;
    setSelectedTaskId(taskId);
    setTaskMessage(null);
    setResult(null);
    try {
      const task = await labTask(taskId);
      setTasks((items) => items ? items.map((item) => item.task_id === task.task_id ? task : item) : [task]);
      if (task.config) {
        setCfg((current) => ({ ...current, ...task.config }));
        if (Array.isArray(task.config.exclusion_zones)) setZones(task.config.exclusion_zones);
      }
      await refreshRunHistory(taskId);
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveNewTask(event: FormEvent) {
    event.preventDefault();
    if (!taskName.trim()) return;
    setTaskSaving(true);
    setTaskMessage(null);
    try {
      const task = await createLabTask({
        name: taskName.trim(),
        description: taskDescription.trim() || undefined,
      });
      setTasks((items) => [task, ...(items ?? [])]);
      setSelectedTaskId(task.task_id);
      setTaskFormOpen(false);
      setTaskName("");
      setTaskDescription("");
      setTaskMessage("Task created. Save its configuration when ready.");
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTaskSaving(false);
    }
  }

  async function saveTask() {
    if (!selectedTaskId) return;
    setTaskSaving(true);
    setTaskMessage(null);
    try {
      const task = await updateLabTask(selectedTaskId, {
        config: { ...cfg, exclusion_zones: zones },
        source: {
          filename: video?.name ?? null, video_attached: !!video,
          width: videoSize?.width ?? null, height: videoSize?.height ?? null, fps: videoFps ?? null,
        },
        model: {
          identifier: selectedRegistry?.id ?? (legacyModel || null),
          filename: localModel?.name ?? null, model_attached: modelReady,
        },
      });
      setTasks((items) => items ? items.map((item) => item.task_id === task.task_id ? task : item) : [task]);
      setTaskMessage("Task saved.");
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTaskSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    labRuns(selectedTaskId || undefined).then((response) => {
      if (!cancelled) {
        setRunHistory(response.runs);
        setRunHistoryPersistent(response.persistent ?? null);
      }
    }).catch((error) => {
      if (!cancelled) setRunHistoryError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setRunHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedTaskId]);

  useEffect(() => {
    if (!runHistory?.length) {
      setBaselineRunId("");
      setCurrentRunId("");
      return;
    }
    setCurrentRunId((id) => id && runHistory.some((run) => run.run_id === id) ? id : runHistory[0].run_id);
    setBaselineRunId((id) => id && runHistory.some((run) => run.run_id === id) ? id : runHistory[1]?.run_id ?? "");
  }, [runHistory]);

  async function refreshRunHistory(taskId?: string) {
    try {
      const response = await labRuns(taskId);
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
      const response = await supabase
        .from("versions")
        .select("id, semver, model_line_id, artifacts, metadata, size_bytes, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return {
        data: (response.data ?? []) as RegistryVersion[],
        error: response.error ? { message: response.error.message } : null,
      };
    })();
    Promise.allSettled([labHealth(), labModels(), registryRequest]).then(([health, legacy, versions]) => {
      if (cancelled) return;
      setBackendUp(health.status === "fulfilled");
      if (health.status === "fulfilled") {
        setBackendCapabilities(health.value.capabilities ?? {});
        setBackendCapabilityDetails(health.value.capability_details ?? {});
        setBackendUnsupportedCapabilities(health.value.unsupported_capabilities ?? []);
      }
      if (legacy.status === "fulfilled") {
        setLegacyModels(legacy.value.models);
        setLegacyModel(legacy.value.default);
      }
      if (versions.status === "fulfilled" && !versions.value.error) {
        const rows = (versions.value.data ?? []) as RegistryVersion[];
        setRegistry(rows.filter((v) => Boolean(v.artifacts?.pytorch?.key)));
        const first = rows.find((v) => v.artifacts?.pytorch?.key);
        if (first) setSelectedVersion(first.id);
      } else {
        setRegistryError("Registry unavailable. Use a local .pt file or legacy backend fallback.");
      }
      setRegistryLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!video) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(video);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  // Overlay stroke scales with source resolution, not with display size: a line
  // drawn at one zoom must land on the same pixels at another (DESIGN.md:933).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoSize) return;
    canvas.width = videoSize.width;
    canvas.height = videoSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const lineColor = overlayColor("--color-overlay-line", "cyan");
    const zoneColor = overlayColor("--color-overlay-zone", "red");
    const draftColor = overlayColor("--color-overlay-draft", "orange");
    const mutedColor = overlayColor("--color-muted", "gray");
    const polygon = (points: Point[], color: string, fill: string, close = true) => {
      if (!points.length) return;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
      if (close && points.length > 2) context.closePath();
      context.strokeStyle = color;
      context.fillStyle = fill;
      context.lineWidth = Math.max(2, videoSize.width / 500);
      if (close && points.length > 2) context.fill();
      context.stroke();
      points.forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, Math.max(4, videoSize.width / 160), 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      });
    };
    zones.forEach((zone) => polygon(
      zone.points,
      zone.enabled ? zoneColor : mutedColor,
      withAlpha(zone.enabled ? zoneColor : mutedColor, zone.enabled ? 0.2 : 0.12),
    ));
    polygon(
      draftPoints,
      drawMode === "line" ? lineColor : draftColor,
      drawMode === "line" ? "transparent" : withAlpha(draftColor, 0.2),
      drawMode !== "line",
    );
    if (cfg.line) {
      polygon([[cfg.line.x1, cfg.line.y1], [cfg.line.x2, cfg.line.y2]], lineColor, "transparent", false);
    }
  }, [cfg.line, draftPoints, drawMode, videoSize, zones]);

  function selectVideo(file: File | null) {
    setVideo(file);
    setVideoSize(null);
    setVideoFps(null);
    setVideoDuration(null);
    setDraftPoints([]);
    setZones([]);
    setResult(null);
    setErr(null);
    setEditorError(null);
    setDrawMode(null);
    setCfg((current) => ({
      ...current, exclusion_zones: [], line: null, video_width: undefined, video_height: undefined,
    }));
  }

  function handleVideoMetadata() {
    const element = videoRef.current;
    if (!element?.videoWidth || !element.videoHeight) {
      setEditorError("Video metadata unavailable.");
      return;
    }
    const size = { width: element.videoWidth, height: element.videoHeight };
    setVideoSize(size);
    setVideoFps(null);
    setVideoDuration(Number.isFinite(element.duration) ? element.duration : null);
    setCfg((current) => ({ ...current, video_width: size.width, video_height: size.height }));
    setEditorError(null);
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    if (!drawMode || !videoSize) return;
    const canvas = canvasRef.current;
    if (!canvas || !videoRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const { point, refusal } = sourcePointFromClick(event, rect, videoSize);
    if (refusal || !point) {
      setEditorError(refusal ?? LETTERBOX_REFUSAL);
      return;
    }
    if (drawMode === "line") {
      const next = [...draftPoints, point].slice(-2);
      setDraftPoints(next);
      const line = lineFromPoints(next, cfg.inflip ?? false);
      if (line) set("line", line);
    } else {
      setDraftPoints((points) => [...points, point]);
    }
    setEditorError(null);
  }

  function commitZone() {
    const refusal = zoneRefusal(draftPoints);
    if (refusal) {
      setEditorError(refusal);
      return;
    }
    const next: ExclusionZone[] = [...zones, {
      zone_id: `zone-${zones.length + 1}`, points: draftPoints, enabled: true,
      coordinate_space: "pixel", frame_ref: 0, mode: "hard_exclude",
    }];
    setZones(next);
    set("exclusion_zones", next);
    setDraftPoints([]);
    setDrawMode(null);
  }

  function clearLine() {
    set("line", null);
    setDraftPoints([]);
  }
  function toggleZone(zoneId: string) {
    const next = zones.map((zone) => zone.zone_id === zoneId ? { ...zone, enabled: !zone.enabled } : zone);
    setZones(next);
    set("exclusion_zones", next);
  }
  function deleteZone(zoneId: string) {
    const next = zones.filter((zone) => zone.zone_id !== zoneId);
    setZones(next);
    set("exclusion_zones", next);
  }
  function setInflip(value: boolean) {
    set("inflip", value);
    if (cfg.line) set("line", { ...cfg.line, inflip: value });
  }

  async function downloadRegistryModel() {
    const key = selectedRegistry?.artifacts?.pytorch?.key;
    if (!key) return;
    setModelBusy(true);
    setModelError(null);
    setModelProgress(0);
    try {
      const { data, error } = await supabase.functions.invoke("download-artifact", { body: { r2_key: key } });
      if (error || !data?.download_url) throw new Error(error?.message ?? "No signed URL returned.");
      const response = await fetch(data.download_url);
      if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
      const total = Number(response.headers.get("content-length") ?? selectedRegistry.size_bytes ?? 0);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Browser cannot stream model download.");
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        loaded += part.value.byteLength;
        if (total) setModelProgress(Math.round(loaded / total * 100));
      }
      setLocalModel(new File(
        chunks as BlobPart[],
        key.split("/").pop() ?? `model-v${selectedRegistry.semver}.pt`,
        { type: "application/octet-stream" },
      ));
      setModelProgress(100);
    } catch (e) {
      setModelError(e instanceof Error ? e.message : String(e));
    } finally {
      setModelBusy(false);
    }
  }

  async function run() {
    if (busy || replayRunRef.current) return;
    if (!video || !modelReady) {
      setErr(disabledReason || "Model or video is not ready.");
      return;
    }
    const durationSeconds = videoDuration;
    const estimateMs = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.max(15000, durationSeconds * 2000)
      : Math.max(15000, (video.size / (1024 * 1024)) * 1200);
    const requestConfig = {
      ...cfg,
      model_path: modelMode === "legacy" ? legacyModel : undefined,
      exclusion_zones: zones,
    };
    const controller = new AbortController();
    replayAbortRef.current?.abort();
    replayAbortRef.current = controller;
    replayRunRef.current = true;
    replayEstimateMsRef.current = estimateMs;
    replayStartedAtRef.current = Date.now();
    setReplayProgress(0);
    setReplayElapsedMs(0);
    setReplayEtaMs(null);
    setReplayProcessedFrames(null);
    setReplayTotalFrames(null);
    setReplayProgressMode(null);
    setReplayStatus("starting");
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      let nextResult: LabResult | null = null;
      try {
        const job = await startInferJob(
          video, requestConfig,
          modelMode === "legacy" ? undefined : localModel ?? undefined,
          controller.signal, selectedTaskId || undefined,
        );
        setReplayProgressMode("server");
        setReplayStatus(job.status ?? "queued");
        let pollDelay = 500;
        const maxPolls = 240;
        let snapshot: LabJobStatus | null = null;
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          snapshot = await getInferJob(job.job_id, controller.signal);
          setReplayStatus(snapshot.status);
          const processed = finiteNumber(snapshot.processed_frames);
          const total = finiteNumber(snapshot.total_frames);
          const serverProgress = jobProgressPercent(snapshot.progress);
          if (processed != null) setReplayProcessedFrames(Math.max(0, Math.floor(processed)));
          if (total != null) setReplayTotalFrames(Math.max(0, Math.floor(total)));
          const frameProgress = processed != null && total != null && total > 0 ? (processed / total) * 100 : null;
          setReplayProgress(Math.round(Math.max(0, Math.min(100, frameProgress ?? serverProgress ?? 0))));
          if (snapshot.elapsed_ms != null) setReplayElapsedMs(Math.max(0, snapshot.elapsed_ms));
          if (snapshot.eta_ms != null) setReplayEtaMs(Math.max(0, snapshot.eta_ms));
          if (snapshot.status === "succeeded") {
            if (!snapshot.result) throw new Error("Replay job succeeded without a result.");
            nextResult = snapshot.result;
            break;
          }
          if (snapshot.status === "failed") {
            throw new Error(snapshot.message ?? snapshot.error ?? snapshot.detail
              ?? "Replay job failed. Check the backend logs and retry.");
          }
          await waitForReplayPoll(pollDelay, controller.signal);
          pollDelay = Math.min(4000, Math.round(pollDelay * 1.5));
        }
        if (!snapshot || snapshot.status !== "succeeded") {
          throw new Error("Replay job timed out before completion. Retry the replay.");
        }
      } catch (error) {
        if (!(error instanceof LabJobEndpointUnavailable)) throw error;
        setReplayProgressMode("estimate");
        setReplayStatus("legacy synchronous fallback");
        nextResult = await runInfer(
          video, requestConfig,
          modelMode === "legacy" ? undefined : localModel ?? undefined,
          controller.signal, selectedTaskId || undefined,
        );
      }
      if (!nextResult) throw new Error("Replay completed without a result. Retry the replay.");
      setResult(nextResult);
      // The backend measured this against the frames it actually decoded, which is the
      // fps the count was computed at. The <video> element cannot report one at all.
      if (typeof nextResult.fps === "number" && nextResult.fps > 0) setVideoFps(nextResult.fps);
      if (selectedTaskId) {
        try {
          const refreshedTask = await labTask(selectedTaskId);
          setTasks((items) => items
            ? items.map((item) => item.task_id === refreshedTask.task_id ? refreshedTask : item)
            : [refreshedTask]);
        } catch { /* The result remains truthful even if task refresh is temporarily unavailable. */ }
      }
      await refreshRunHistory(selectedTaskId || undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      replayAbortRef.current = null;
      replayRunRef.current = false;
      setReplayProgress(100);
      setReplayEtaMs(0);
      setBusy(false);
      replayStartedAtRef.current = null;
      replayEstimateMsRef.current = null;
    }
  }

  function toggleClass(id: number) {
    set("classes", (cfg.classes ?? []).includes(id)
      ? (cfg.classes ?? []).filter((value) => value !== id)
      : [...(cfg.classes ?? []), id]);
  }

  function loadManifestConfig(manifestRun: RunManifest) {
    const replayConfig = replayConfigFromManifest(manifestRun);
    setCfg((current) => ({ ...current, ...replayConfig }));
    if (Array.isArray(replayConfig.exclusion_zones)) setZones(replayConfig.exclusion_zones);
    setEditorError(null);
    setErr(null);
  }

  function downloadConfig() {
    const blob = new Blob(
      [JSON.stringify({ ...cfg, exclusion_zones: zones }, null, 2)],
      { type: "application/json" },
    );
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "lab-config.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

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
    const columns = [
      "event_id", "sequence", "frame_index", "timestamp_ms", "track_id", "class_id",
      "centroid_x", "centroid_y", "bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2",
      "direction", "side_before", "side_after", "status", "recovery", "detection_conf",
      "exclusion_zone_id", "raw_conf", "exclusion_hit", "reason",
      "path_points", "path_predictor", "path_total_displacement",
    ] as const;
    const csvValue = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return /[",\n\r]/.test(text) ? `"${text.split('"').join('""')}"` : text;
    };
    const rows = result.events.map((event) => [
      event.event_id, event.sequence, event.frame_index, event.timestamp_ms, event.track_id,
      event.class_id, event.centroid?.[0], event.centroid?.[1],
      ...(event.bbox ?? [undefined, undefined, undefined, undefined]),
      event.direction, event.side_before, event.side_after, event.status, event.recovery,
      event.detection_conf, event.exclusion_zone_id, event.provenance?.decision?.raw_conf,
      event.provenance?.decision?.exclusion_hit, event.provenance?.decision?.reason,
      event.provenance?.path?.points ? JSON.stringify(event.provenance.path.points) : undefined,
      event.provenance?.path?.predictor ? predictorLabel(event.provenance.path.predictor) : undefined,
      event.provenance?.path?.total_displacement,
      // NOTE: this row must have exactly `columns.length` cells — the bbox spread
      // contributes four. A mismatch shifts every column after it, which reads as
      // plausible data rather than as an error. tests/test_events_csv.py pins it.
    ].map(csvValue).join(","));
    const blob = new Blob([[columns.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lab-events.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => result ? [
    { label: "frames", value: result.frames_processed },
    { label: "max sacks / frame", value: result.max_sack_per_frame },
    { label: "avg sacks / frame", value: result.avg_sack_per_frame },
  ] : [], [result]);

  // Four-step fallback: health, then the run's own capabilities, then the
  // unsupported list, then a sentence that still names the capability.
  const capability = (name: keyof LabCapabilities) => {
    const healthValue = backendCapabilities[name];
    if (typeof healthValue === "boolean") return healthValue;
    const resultValue = result?.capabilities?.[name];
    if (typeof resultValue === "boolean") return resultValue;
    return false;
  };
  const capabilityReason = (name: keyof LabCapabilities) => {
    const resultReason = result?.capability_details?.[name]?.reason;
    if (resultReason) return resultReason;
    const healthReason = backendCapabilityDetails?.[name]?.reason;
    if (healthReason) return healthReason;
    if (backendUnsupportedCapabilities.includes(name)) {
      return `Backend reports ${name.split("_").join(" ")} is unsupported.`;
    }
    return `Backend health did not advertise ${name.split("_").join(" ")} support.`;
  };

  const events = result?.events;
  const selectedEvent = events?.find((event) => event.event_id === selectedEventId) ?? null;
  const summary = result?.summary;
  const diagnostics = result?.detection_diagnostics;
  const hasDiagnostics = Boolean(diagnostics);
  const hasSummary = Boolean(summary);
  const manifest = result?.manifest ?? result?.run;
  const manifestConfig = manifest ? getManifestConfig(manifest) : undefined;
  const manifestReady = Boolean(manifest?.run_id && manifest?.schema_version && manifestConfig);
  const baselineRun = runHistory?.find((run) => run.run_id === baselineRunId) ?? null;
  const currentRun = runHistory?.find((run) => run.run_id === currentRunId) ?? null;
  const runCompare = baselineRun && currentRun && baselineRun.run_id !== currentRun.run_id
    ? compareRunManifests(baselineRun, currentRun) : null;
  const trailPaths = result?.trails ?? result?.paths ?? result?.trail?.paths ?? [];
  const pathEvents = events?.filter((event) => event.provenance.path?.points?.length) ?? [];
  const hasPathMetadata = trailPaths.length > 0 || pathEvents.length > 0;
  const scorerMode = result?.scorer_mode;
  const scorerConfigEntries = scorerEntries(result?.scorer_config);
  const scorerFeatureEntries = scorerEntries(result?.scorer_features);
  const scoredEvents = events?.filter((event) => event.score_breakdown || event.verdict) ?? [];
  const hasScorerEventOutput = scoredEvents.length > 0;
  const scorerOutputAvailable = Boolean(
    scorerMode || scorerConfigEntries.length || scorerFeatureEntries.length || hasScorerEventOutput);
  const scorerLockedReason = !capability("scorer")
    ? "Locked: the backend health contract reports scorer capability=false."
    : !hasScorerEventOutput
      ? "Locked: this run returned no event score_breakdown or verdict fields."
      : "";
  const statusLabel = (status: EventStatus) => status.toUpperCase();
  const directionLabel = (direction: "in" | "out" | "unknown") =>
    direction === "unknown" ? "UNKNOWN" : direction.toUpperCase();
  const derived = matchDistancePx(cfg);
  const trackerWired = capability("tracker");
  const selectedTask = selectedTaskId ? tasks?.find((task) => task.task_id === selectedTaskId) : undefined;
  const histogramBins = diagnostics?.confidence_histogram?.bins ?? [];
  const histogramMax = histogramBins.reduce((max, bin) => Math.max(max, bin.count ?? 0), 0);
  const sourced: Sourced = {
    artifact: artifactLabel(modelMode, {
      semver: selectedRegistry?.semver, localName: localModel?.name, legacyPath: legacyModel,
    }),
    clip: video?.name ?? null,
    frameRange: frameRangeLabel(cfg),
  };

  return (
    <div className="replay">
      <header className="replay-head">
        <div>
          <span className="eyebrow">RESEARCH CONTROL ROOM / {hasSummary ? "V1 COUNTING" : "V0 DETECTION"}</span>
          <h2 className="replay-title"><FlaskConical size={18} /> Lab Replay</h2>
        </div>
        <div className="replay-head-status">
          <span className={`pill ${backendUp ? "pill-succeeded" : backendUp === false ? "pill-failed" : "pill-muted"}`}>
            {backendUp ? "backend online" : backendUp === false ? "backend unavailable" : "checking backend"}
          </span>
          <span className="chip">{events ? `${events.length} events` : "no event stream"}</span>
        </div>
      </header>

      {backendUp === false && (
        <RefusalBanner>
          <span>
            Lab backend is unavailable. Start <code className="code-inline">python apps/api/lab_server.py</code> on
            port 8077.
          </span>
          <button className="button button-dense" type="button" onClick={() => window.location.reload()}>
            Retry connection
          </button>
        </RefusalBanner>
      )}

      <Panel
        eyebrow="TASK-FIRST WORKSPACE"
        badge={selectedTaskId ? <span className="pill pill-running">TASK ACTIVE</span> : undefined}
      >
        <div className="panel-dense-head">
          <h3>{selectedTaskId ? (selectedTask?.name ?? "Selected task") : "No task selected"}</h3>
        </div>
        <p className="hint-text">Save a replay configuration and return to it later.</p>
        <div className="button-row replay-head-controls">
          <select
            aria-label="Saved task"
            value={selectedTaskId}
            onChange={(event) => loadTask(event.target.value)}
            disabled={tasksLoading || !tasks?.length}
          >
            <option value="">
              {tasksLoading ? "Loading tasks…" : tasks?.length ? "Select a task" : "No saved tasks"}
            </option>
            {tasks?.map((task) => <option key={task.task_id} value={task.task_id}>{task.name}</option>)}
          </select>
          <button className="button button-dense" type="button" onClick={() => setTaskFormOpen((open) => !open)}>
            <FlaskConical size={14} /> New Task
          </button>
          <button
            className="button primary button-dense"
            type="button"
            disabled={!selectedTaskId || taskSaving}
            onClick={saveTask}
          >
            {taskSaving ? "Saving…" : "Save task"}
          </button>
        </div>
        {selectedTaskId && (
          <ProvenanceBlock
            label="TASK STATE"
            rows={[
              ["task_id", <code className="code-inline">{selectedTaskId}</code>],
              ["attachments", video && modelReady
                ? "Ready to run with current attachments."
                : "Reattach video and model files before running; browser files are not persisted."],
            ]}
          />
        )}
        {tasksError && <RefusalBanner><span>Unable to load saved tasks: {tasksError}</span></RefusalBanner>}
        {taskMessage && <p className="hint-text" role="status">{taskMessage}</p>}
        {taskFormOpen && (
          <form className="stack" onSubmit={saveNewTask}>
            <label>
              Task name
              <input
                autoFocus
                required
                type="text"
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
                placeholder="e.g. Loading bay count"
              />
            </label>
            <label>
              Description
              <textarea
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Optional context for this replay"
                rows={2}
              />
            </label>
            <div className="button-row">
              <button className="button primary button-dense" type="submit" disabled={!taskName.trim() || taskSaving}>
                Create task
              </button>
              <button className="button button-dense" type="button" onClick={() => setTaskFormOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Panel>

      <div className="replay-grid">
        <aside className="replay-rail" aria-label="Replay parameters">
          {/* 1 · Input/Session */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(1)}>
            <summary><span className="chip">1</span><strong>{RAIL_SECTIONS[0]}</strong></summary>
            <div className="rail-body">
              <label className="file-drop">
                <Upload size={16} />
                <span>
                  <strong>{video ? "Replace source video" : "Drop source video here"}</strong>
                  <small>MP4, WebM, or another browser-supported video</small>
                </span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => selectVideo(event.target.files?.[0] ?? null)}
                />
              </label>
              <div className="file-row">
                <span className={`pill ${video ? "pill-succeeded" : "pill-muted"}`}>{video ? "READY" : "EMPTY"}</span>
                <span className="file-name">{video?.name ?? "No video attached"}</span>
              </div>
              <div className="field-row">
                <label>
                  Frame start
                  <input
                    type="number"
                    min="0"
                    value={cfg.frame_start ?? 0}
                    onChange={(event) => set("frame_start", +event.target.value)}
                  />
                </label>
                <label>
                  Frame end
                  <input
                    type="number"
                    min="0"
                    placeholder="end"
                    value={cfg.frame_end ?? ""}
                    onChange={(event) => set("frame_end", event.target.value ? +event.target.value : undefined)}
                  />
                </label>
              </div>
              <label className="range-field">
                <span className="field-head">
                  Frame stride
                  <Hint text="Process every Nth video frame; higher values trade detail for speed." />
                </span>
                <strong className="metric-numeral-sm">{cfg.frame_stride}</strong>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={cfg.frame_stride}
                  onChange={(event) => set("frame_stride", +event.target.value)}
                />
              </label>
              <div className="field-row">
                <label>
                  <span className="field-head">
                    GT target
                    <Hint text="Optional human-verified count used only for backend scoring." />
                    <em className="optional-tag">(optional)</em>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="not supplied"
                    value={cfg.ground_truth ?? ""}
                    onChange={(event) => set("ground_truth", event.target.value === ""
                      ? undefined
                      : Math.max(0, Math.floor(+event.target.value)))}
                  />
                </label>
                <label>
                  <span className="field-head">
                    Tolerance
                    <Hint text="Allowed absolute error from GT, entered as a percentage." />
                    <em className="optional-tag">(optional %)</em>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="not supplied"
                    value={cfg.tolerance_pct == null ? "" : cfg.tolerance_pct * 100}
                    onChange={(event) => set("tolerance_pct", event.target.value === ""
                      ? undefined
                      : Math.max(0, +event.target.value) / 100)}
                  />
                </label>
              </div>
              <p className="hint-text">
                GT target is a human count for scoring. No GT or tolerance is assumed when left blank.
              </p>
              <button
                className="button button-dense"
                type="button"
                onClick={() => setCfg({ ...DEFAULT_CFG, ground_truth: undefined, tolerance_pct: undefined })}
              >
                <RotateCcw size={13} /> Reset deployed defaults
              </button>
              <p className="hint-text">Source state is local-only until Run Replay.</p>
            </div>
          </details>

          {/* 2 · Detection */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(2)}>
            <summary><span className="chip">2</span><strong>{RAIL_SECTIONS[1]}</strong></summary>
            <div className="rail-body">
              <div className="sub-tabs sub-tabs-dense">
                {(["registry", "local", ...(legacyModels.length ? ["legacy"] : [])] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={modelMode === mode ? "active" : ""}
                    onClick={() => {
                      setModelMode(mode as ModelMode);
                      if (mode === "registry") setLocalModel(null);
                      setModelError(null);
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {modelMode === "registry" && (registryLoading ? (
                <p className="hint-text">Loading model registry…</p>
              ) : registry.length ? (
                <>
                  <label>
                    Registry version
                    <select
                      value={selectedVersion}
                      onChange={(event) => { setSelectedVersion(event.target.value); setLocalModel(null); }}
                    >
                      <option value="">Select version</option>
                      {registry.map((version) => (
                        <option key={version.id} value={version.id}>
                          v{version.semver} · {version.model_line_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ProvenanceBlock
                    label="ARTIFACT"
                    rows={[[
                      selectedRegistry ? "r2 key" : "next",
                      selectedRegistry
                        ? selectedRegistry.artifacts?.pytorch?.key
                        : "Choose a version, then fetch the signed R2 artifact.",
                    ]]}
                  />
                  <button
                    className="button button-dense"
                    type="button"
                    disabled={!selectedRegistry || modelBusy}
                    onClick={downloadRegistryModel}
                  >
                    {modelBusy ? `Fetching model ${modelProgress}%` : <><Download size={14} /> Fetch model</>}
                  </button>
                </>
              ) : (
                <WarningBanner><span>{registryError ?? "No PyTorch artifacts found."}</span></WarningBanner>
              ))}
              {modelMode === "local" && (
                <label>
                  Local .pt
                  <input
                    type="file"
                    accept=".pt,application/octet-stream"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      const valid = !!file && file.name.toLowerCase().endsWith(".pt");
                      setLocalModel(valid ? file : null);
                      setModelError(file && !valid ? "Choose a .pt file." : null);
                    }}
                  />
                </label>
              )}
              {modelMode === "legacy" && (
                <label>
                  Legacy backend model
                  <select value={legacyModel} onChange={(event) => setLegacyModel(event.target.value)}>
                    {legacyModels.map((model) => (
                      <option key={model} value={model}>{model.split("/").pop()}</option>
                    ))}
                  </select>
                </label>
              )}
              {localModel && (
                <div className="file-row">
                  <span className="pill pill-succeeded">READY</span>
                  <span className="file-name code-inline">{localModel.name}</span>
                </div>
              )}
              {modelError && <span className="field-error">{modelError}</span>}
              <label className="range-field">
                <span className="field-head">
                  Prefilter confidence
                  <Hint text="Minimum detector confidence kept before tracking." />
                </span>
                <strong className="metric-numeral-sm">{(cfg.conf ?? 0).toFixed(2)}</strong>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={cfg.conf}
                  onChange={(event) => set("conf", +event.target.value)}
                />
              </label>
              <label className="range-field">
                <span className="field-head">
                  NMS-IoU
                  <Hint text="Overlap threshold for suppressing duplicate detector boxes." />
                </span>
                <strong className="metric-numeral-sm">{(cfg.iou ?? 0).toFixed(2)}</strong>
                <input
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={cfg.iou}
                  onChange={(event) => set("iou", +event.target.value)}
                />
              </label>
              <p className="hint-text">Editable on .pt/.onnx only; baked on HEF.</p>
              <div className="button-row">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={(cfg.classes ?? []).includes(0)}
                    onChange={() => toggleClass(0)}
                  />
                  person
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={(cfg.classes ?? []).includes(1)}
                    onChange={() => toggleClass(1)}
                  />
                  sack
                </label>
              </div>
            </div>
          </details>

          {/* 3 · Tracker */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(3)}>
            <summary><span className="chip">3</span><strong>{RAIL_SECTIONS[2]}</strong></summary>
            <div className="rail-body">
              <span className={`pill ${trackerWired ? "pill-succeeded" : "pill-muted"}`}>
                {trackerWired ? "TRACKER WIRED" : "TRACKER CAPABILITY REQUIRED"}
              </span>
              {!trackerWired && (
                <LockedPanel
                  label="TRACKER CONTROLS LOCKED"
                  reason={capabilityReason("tracker")}
                  unlock="The controls below stay disabled until backend health advertises tracker support."
                  compact
                />
              )}
              <label>
                <span className="field-head">
                  Tracker
                  <Hint text="What this backend actually runs: a deterministic greedy nearest-centroid tracker (webui/lab_core.py). NOT ByteTrack — the device runs ByteTrack, and until the shared counting engine lands these two count differently. This control used to say ByteTrack, which was untrue." />
                </span>
                <select
                  disabled={!trackerWired}
                  value={cfg.tracker_type ?? "centroid"}
                  onChange={(event) => set("tracker_type", event.target.value)}
                >
                  <option value="centroid">Centroid — greedy nearest-centroid</option>
                </select>
              </label>
              <label>
                <span className="field-head">
                  Track buffer
                  <Hint text="Frames an unmatched track remains alive before removal." />
                </span>
                <input
                  disabled={!trackerWired}
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={cfg.track_buffer ?? 30}
                  onChange={(event) => set("track_buffer",
                    Math.max(1, Math.min(300, Math.floor(Number(event.target.value) || 1))))}
                />
              </label>
              {/* The Match-threshold control is dropped (spec §3.2); the derived value it
                  was really setting stays visible, read-only. */}
              <ProvenanceBlock
                label="DERIVED MATCH DISTANCE"
                rows={[
                  ["effective", `${derived.px} px`],
                  ["formula", "max(roi_dedup_px, 50 * (1 - match_thresh))"],
                  ["source", "webui/lab_core.py:579"],
                  ["match_thresh", `${cfg.match_thresh ?? 0.7}${derived.inert ? " · inert" : ""}`],
                ]}
              >
                <p className="hint-text">
                  Folded into a pixel match distance as max(roi_dedup_px, 50*(1-match_thresh)) in
                  webui/lab_core.py. It is NOT ByteTrack&apos;s IoU association cost despite the borrowed name,
                  and above the crossover it has no effect at all — the ROI dedup radius wins.
                </p>
                {derived.inert && (
                  <p className="hint-text">
                    At {cfg.match_thresh ?? 0.7} the ROI dedup radius ({cfg.roi_dedup_px ?? 25} px) wins;
                    match_thresh only starts having an effect below {derived.crossover.toFixed(2)}.
                  </p>
                )}
              </ProvenanceBlock>
            </div>
          </details>

          {/* 4 · Line/Geometry */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(4)}>
            <summary><span className="chip">4</span><strong>{RAIL_SECTIONS[3]}</strong></summary>
            <div className="rail-body">
              <ProvenanceBlock
                label="COUNT LINE"
                rows={[
                  ["state", cfg.line ? "canonical line ready" : "no count line"],
                  ["frame_ref", "0"],
                  ["space", "pixel"],
                ]}
              />
              <div className="button-row">
                <button
                  className="button button-dense"
                  type="button"
                  disabled={!videoSize}
                  onClick={() => { setDrawMode("line"); setDraftPoints([]); }}
                >
                  <GitBranch size={14} /> Draw canonical count line
                </button>
                <button className="button button-dense" type="button" disabled={!cfg.line} onClick={clearLine}>
                  <X size={14} /> Clear line
                </button>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!cfg.inflip}
                  onChange={(event) => setInflip(event.target.checked)}
                />
                In / Out flip
              </label>
              <div className="button-row">
                <button
                  className="button button-dense"
                  type="button"
                  disabled={!videoSize}
                  onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}
                >
                  <Layers3 size={14} /> Add exclusion zone
                </button>
                <Hint text="Polygon where detections are excluded by the backend." />
                {drawMode === "zone" && (
                  <button
                    className="button primary button-dense"
                    type="button"
                    disabled={!draftPoints.length}
                    onClick={commitZone}
                  >
                    Commit zone ({draftPoints.length} pts)
                  </button>
                )}
              </div>
              {zones.map((zone) => (
                <div className="zone-row" key={zone.zone_id}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={zone.enabled}
                      onChange={() => toggleZone(zone.zone_id)}
                    />
                    {zone.zone_id}
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => deleteZone(zone.zone_id)}
                    aria-label={`Delete ${zone.zone_id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <p className="hint-text">All geometry is pixel-space and anchored to frame 0.</p>
            </div>
          </details>

          {/* 5 · Counting/Dedup */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(5)}>
            <summary><span className="chip">5</span><strong>{RAIL_SECTIONS[4]}</strong></summary>
            <div className="rail-body">
              <span className="eyebrow">COUNTING CONTRACT</span>
              <div className="field-row">
                <label>
                  <span className="field-head">
                    Conf split
                    <Hint text="Confidence boundary used to separate confirmed and flagged detections." />
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={cfg.conf_split ?? 0.6}
                    onChange={(event) => set("conf_split",
                      Math.max(0, Math.min(1, Number(event.target.value) || 0)))}
                  />
                </label>
                <label>
                  <span className="field-head">
                    ROI dedup radius
                    <Hint text="Pixel distance used to treat nearby ROI crossings as duplicates." />
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={cfg.roi_dedup_px ?? 25}
                    onChange={(event) => set("roi_dedup_px",
                      Math.max(0, Math.min(1000, Math.floor(Number(event.target.value) || 0))))}
                  />
                </label>
                <label>
                  <span className="field-head">
                    ROI dedup frames
                    <Hint text="Frames during which a nearby repeated crossing is deduplicated." />
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    value={cfg.roi_dedup_frames ?? 120}
                    onChange={(event) => set("roi_dedup_frames",
                      Math.max(0, Math.min(10000, Math.floor(Number(event.target.value) || 0))))}
                  />
                </label>
                <label>
                  <span className="field-head">
                    Count cooldown
                    <Hint text="Minimum frames between accepted count events for the same track." />
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    value={cfg.count_cooldown_frames ?? 40}
                    onChange={(event) => set("count_cooldown_frames",
                      Math.max(0, Math.min(10000, Math.floor(Number(event.target.value) || 0))))}
                  />
                </label>
              </div>
              <p className="hint-text">
                Confirmed/flagged counts are emitted only when the backend returns result.summary.
              </p>
            </div>
          </details>

          {/* 6 · Occlusion-Recovery */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(6)}>
            <summary><span className="chip">6</span><strong>{RAIL_SECTIONS[5]}</strong></summary>
            <div className="rail-body">
              <span className={`pill ${capability("healer") ? "pill-succeeded" : "pill-muted"}`}>
                {capability("healer") ? "HEALER WIRED" : "CAPABILITIES LIMITED"}
              </span>
              {capability("healer") ? (
                <p className="hint-text">
                  Occlusion recovery is backend-owned. No local healer controls are exposed.
                </p>
              ) : (
                <LockedPanel
                  label="BACKEND CAPABILITIES UNAVAILABLE"
                  reason="Occlusion recovery and optical flow remain locked until the backend advertises support."
                  unlock={`${capabilityReason("healer")} · ${capabilityReason("optical_flow")}`}
                />
              )}
            </div>
          </details>

          {/* 7 · Scorer */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(7)}>
            <summary><span className="chip">7</span><strong>{RAIL_SECTIONS[6]}</strong></summary>
            <div className="rail-body">
              <div className="panel-dense-head">
                <span className={`pill ${capability("scorer")
                  ? scorerOutputAvailable ? "pill-succeeded" : "pill-waiting"
                  : "pill-muted"}`}
                >
                  {capability("scorer")
                    ? scorerOutputAvailable ? "SCORER OUTPUT" : "SCORER CAPABILITY · NO OUTPUT"
                    : "SCORER NOT WIRED"}
                </span>
                {scorerMode && <span className="chip">{scorerModeLabel(scorerMode)}</span>}
              </div>
              {scorerLockedReason ? (
                <LockedPanel
                  label="SCORER CONTROLS LOCKED"
                  reason={scorerLockedReason}
                  unlock="Controls will appear only when the backend returns scorer-owned fields."
                />
              ) : (
                <>
                  <ProvenanceBlock label="MODE" rows={[["mode", scorerModeLabel(scorerMode)]]} />
                  {scorerConfigEntries.length > 0 && (
                    <ProvenanceBlock
                      label="CONFIG"
                      rows={scorerConfigEntries.map(([key, value]) => [key, scorerValue(value)])}
                    />
                  )}
                  {scorerFeatureEntries.length > 0 && (
                    <ProvenanceBlock
                      label="FEATURES"
                      rows={scorerFeatureEntries.map(([key, value]) => [key, scorerValue(value)])}
                    />
                  )}
                  <p className="hint-text">
                    Scorer configuration and features are read-only backend output. No browser-side weights or
                    healer controls are exposed.
                  </p>
                </>
              )}
            </div>
          </details>

          {/* 8 · Output/Export */}
          <details className="rail-section" open={RAIL_OPEN_BY_DEFAULT.has(8)}>
            <summary><span className="chip">8</span><strong>{RAIL_SECTIONS[7]}</strong></summary>
            <div className="rail-body">
              <span className="eyebrow">OVERLAY EXPORTS</span>
              <div className="button-row">
                <button
                  className="button button-dense"
                  type="button"
                  disabled={!result}
                  onClick={() => result && window.open(result.video_url, "_blank")}
                >
                  <Download size={14} /> Download overlay
                </button>
                <button className="button button-dense" type="button" onClick={downloadConfig}>
                  <Download size={14} /> Download config JSON
                </button>
                <button
                  className="button button-dense"
                  type="button"
                  disabled={!result?.events?.length}
                  onClick={downloadEventsCsv}
                >
                  <Download size={14} /> Count CSV <span className="muted">(events only)</span>
                </button>
              </div>
            </div>
          </details>
        </aside>

        <main className="replay-center">
          <section className="panel-dense">
            <div className="panel-dense-head">
              <div>
                <span className="eyebrow">REPLAY VIEWER</span>
                <h3>{video?.name ?? "No source loaded"}</h3>
              </div>
            </div>
            <div className="video-hud">
              <span>{videoSize ? `${videoSize.width} × ${videoSize.height}` : "— × —"}</span>
              <span>geometry frame 0</span>
              <span>{videoFps ? `${videoFps.toFixed(1)} fps` : "fps —"}</span>
              <span>{videoDuration ? `${Math.round(videoDuration)}s` : "duration —"}</span>
            </div>
            <div className="video-surface">
              {video && videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    onLoadedMetadata={handleVideoMetadata}
                    onError={() => setEditorError("Unable to load this video.")}
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    aria-label="Replay drawing canvas"
                    className={drawMode ? "drawing" : ""}
                  />
                </>
              ) : (
                <div className="video-surface-empty">
                  <Layers3 size={30} />
                  <strong>Load a video to start the replay</strong>
                  <span>Detection overlay and geometry tools appear here.</span>
                </div>
              )}
            </div>
            <div className="overlay-legend">
              <span><i className="overlay-swatch overlay-swatch-line" aria-hidden="true" />count line</span>
              <span><i className="overlay-swatch overlay-swatch-zone" aria-hidden="true" />exclusion zone</span>
              <span><i className="overlay-swatch overlay-swatch-draft" aria-hidden="true" />uncommitted draft</span>
            </div>
            {editorError && (
              <RefusalBanner><span>{editorError}</span></RefusalBanner>
            )}
            <div className="tool-row">
              <button
                type="button"
                className={`tool-card ${drawMode === "line" ? "selected" : ""}`}
                disabled={!videoSize}
                onClick={() => { setDrawMode("line"); setDraftPoints([]); }}
              >
                <GitBranch size={16} />
                <span>Draw Count Line</span>
                <small>2 points · frame 0</small>
              </button>
              <button
                type="button"
                className={`tool-card ${drawMode === "zone" ? "selected" : ""}`}
                disabled={!videoSize}
                onClick={() => { setDrawMode("zone"); setDraftPoints([]); }}
              >
                <Layers3 size={16} />
                <span>Add Exclusion Zone</span>
                <small>polygon editor</small>
              </button>
              <button type="button" className="tool-card" onClick={() => setInflip(!cfg.inflip)}>
                <RotateCcw size={16} />
                <span>In–Out Flip</span>
                <small>{cfg.inflip ? "flipped" : "normal"}</small>
              </button>
            </div>
            <div className="run-row">
              <button className="button primary" type="button" disabled={busy || !!disabledReason} onClick={run}>
                <Play size={16} fill="currentColor" />
                {busy ? "Running replay…" : "Run Replay"}
              </button>
              <span className="run-hint">
                {busy
                  ? "Backend is processing the replay; results will replace this state."
                  : disabledReason || "Ready to run. Counts appear only when the backend returns a summary."}
              </span>
            </div>
            {busy && (
              <div
                className={`job-progress ${replayProgressMode === "server"
                  ? "job-progress-measured"
                  : "job-progress-estimated"}`}
                role="status"
                aria-live="polite"
              >
                <div className="job-progress-head">
                  <strong>
                    {replayProgressMode === "server"
                      ? "Server replay progress"
                      : replayProgressMode === "estimate" ? "Estimated client progress" : "Starting replay"}
                  </strong>
                  <span className="metric-numeral-sm">{replayProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${replayProgress}%` }} />
                </div>
                <div className="job-progress-meta">
                  <span>
                    {replayProcessedFrames != null && replayTotalFrames != null
                      ? `${replayProcessedFrames.toLocaleString()} / ${replayTotalFrames.toLocaleString()} frames`
                      : "Frame count pending"}
                  </span>
                  <span>Elapsed {formatElapsed(replayElapsedMs)}</span>
                  <span>{replayEtaMs != null ? `ETA ${formatElapsed(replayEtaMs)}` : "ETA pending"}</span>
                </div>
                <p className="hint-text">
                  {replayProgressMode === "server"
                    ? `Backend status: ${replayStatus ?? "running"}. Progress uses server-reported frames when available.`
                    : replayProgressMode === "estimate"
                      ? "Estimate only — the legacy synchronous fallback does not report server progress and is capped at 95% until the response arrives."
                      : "Submitting an asynchronous replay job…"}
                </p>
              </div>
            )}
            {err && (
              <RefusalBanner>
                <span>{err}</span>
                <button
                  className="button button-dense"
                  type="button"
                  disabled={busy || !!disabledReason}
                  onClick={run}
                >
                  Retry replay
                </button>
              </RefusalBanner>
            )}
          </section>
        </main>

        <aside className="replay-inspector" aria-label="Replay results">
          <Panel
            eyebrow="OUTPUT PREVIEW"
            badge={result ? <span className="pill pill-succeeded">READY</span> : undefined}
          >
            {result ? (
              <>
                <div className="video-surface video-surface-compact">
                  <video src={result.video_url} controls />
                </div>
                <SourcedMetrics
                  items={stats.map((stat) => ({ label: stat.label, value: stat.value }))}
                  sourced={sourced}
                />
                <a className="download-link" href={result.video_url} download>
                  <Download size={14} /> Download overlay.mp4
                </a>
              </>
            ) : (
              <EmptyState
                statement="No backend output yet."
                next="Run Replay to populate the backend output."
              />
            )}
          </Panel>

          <Panel
            eyebrow="REPRODUCIBILITY"
            badge={
              <span className={`pill ${manifestReady ? "pill-succeeded" : "pill-muted"}`}>
                {manifestReady ? "MANIFEST READY" : "BACKEND FIELD REQUIRED"}
              </span>
            }
          >
            {manifest ? (
              <>
                <ProvenanceBlock
                  label="RUN MANIFEST"
                  rows={[
                    ["run ID", <code className="code-inline">{manifest.run_id}</code>],
                    ["schema", <code className="code-inline">{manifest.schema_version}</code>],
                    ["config snapshot", manifestConfig ? "AVAILABLE" : "NOT RETURNED"],
                  ]}
                />
                <button
                  className="button button-dense"
                  type="button"
                  disabled={!manifestReady}
                  onClick={downloadManifest}
                >
                  <Download size={14} /> Export reproducible manifest JSON
                </button>
              </>
            ) : (
              <LockedPanel
                label="REPRODUCIBLE EXPORT LOCKED"
                reason="Run Replay did not return a backend-owned run manifest."
                unlock="Reproducible export stays locked; the browser does not synthesize one."
              />
            )}
          </Panel>

          <Panel
            eyebrow="RUN HISTORY"
            badge={
              <span className={`pill ${runHistory?.length ? "pill-succeeded" : "pill-muted"}`}>
                {runHistoryLoading
                  ? "LOADING"
                  : runHistory?.length
                    ? `${runHistory.length} ${runHistoryPersistent === false ? "THIS SESSION" : "SAVED"}`
                    : "EMPTY"}
              </span>
            }
          >
            {runHistoryPersistent === false && !runHistoryLoading && (
              <WarningBanner>
                <span>
                  Run history lives in the backend process, not on disk — restarting it loses every manifest here,
                  and a saved task will then list run ids with nothing behind them.
                </span>
              </WarningBanner>
            )}
            {runHistoryLoading ? (
              <p className="hint-text">Checking the backend run store…</p>
            ) : runHistoryError ? (
              <LockedPanel
                label="RUN HISTORY UNAVAILABLE"
                reason="Run history is unavailable. No local history is shown."
                unlock={runHistoryError}
              />
            ) : runHistory?.length ? (
              <div>
                {runHistory.slice(0, 5).map((run) => (
                  <div className="data-table-row-dense" key={run.run_id}>
                    <code>{run.run_id}</code>
                    <span>{run.schema_version}</span>
                    <small>{run.created_at}</small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                statement="The backend returned no saved runs yet."
                next="Run Replay to create the first manifest."
              />
            )}
          </Panel>

          <Panel
            eyebrow="A/B EVENT + CONFIG COMPARE"
            badge={
              <span className={`pill ${runCompare ? "pill-succeeded" : "pill-muted"}`}>
                {runHistoryLoading
                  ? "LOADING"
                  : runHistoryError
                    ? "LOCKED"
                    : runHistory && runHistory.length >= 2 ? "READY" : "2 RUNS REQUIRED"}
              </span>
            }
          >
            {runHistoryLoading ? (
              <p className="hint-text">Waiting for backend RunManifest history…</p>
            ) : runHistoryError ? (
              <LockedPanel
                label="COMPARE LOCKED"
                reason="Compare is locked because backend run history is unavailable. No local runs are substituted."
              />
            ) : runHistory && runHistory.length >= 2 ? (
              <>
                <div className="compare-selects">
                  <label>
                    Baseline
                    <select value={baselineRunId} onChange={(event) => setBaselineRunId(event.target.value)}>
                      {runHistory.map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id}</option>)}
                    </select>
                  </label>
                  <label>
                    Current
                    <select value={currentRunId} onChange={(event) => setCurrentRunId(event.target.value)}>
                      {runHistory.map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id}</option>)}
                    </select>
                  </label>
                </div>
                {runCompare ? (
                  <>
                    {/* Both sides are named at the top: never a delta without both run ids. */}
                    <div className="compare-header">
                      <div className="compare-side">
                        <span className="micro-uppercase">baseline</span>
                        <code>{runCompare.baselineId}</code>
                      </div>
                      <div className="compare-side">
                        <span className="micro-uppercase">candidate</span>
                        <code>{runCompare.currentId}</code>
                      </div>
                      {runCompare.changedConfigKeys.length > 0 && (
                        <WarningBanner>
                          <span>
                            {runCompare.changedConfigKeys.length} config key
                            {runCompare.changedConfigKeys.length === 1 ? "" : "s"} differ between these two runs.
                            More than one moved lever makes the delta unattributable.
                          </span>
                        </WarningBanner>
                      )}
                    </div>
                    <div className="compare-block">
                      <h4>Event-level diff · primary</h4>
                      {runCompare.eventDiff.locked ? (
                        <LockedPanel
                          label="EVENT DIFF LOCKED"
                          reason="Both manifests must return backend-owned counts.events.event_records[]. No event identity is inferred from aggregate counts or event_ids."
                          compact
                        />
                      ) : (
                        <>
                          <div className="kpi-grid">
                            <div className="kpi-cell">
                              <strong className="metric-numeral-sm">{runCompare.eventDiff.addedIds.length}</strong>
                              <span className="kpi-label">added</span>
                            </div>
                            <div className="kpi-cell">
                              <strong className="metric-numeral-sm">{runCompare.eventDiff.removedIds.length}</strong>
                              <span className="kpi-label">removed</span>
                            </div>
                            <div className="kpi-cell">
                              <strong className="metric-numeral-sm">
                                {runCompare.eventDiff.changedRecords.length}
                              </strong>
                              <span className="kpi-label">changed</span>
                            </div>
                          </div>
                          {(runCompare.eventDiff.addedIds.length > 0
                            || runCompare.eventDiff.removedIds.length > 0) && (
                            <div className="id-columns">
                              {runCompare.eventDiff.addedIds.length > 0 && (
                                <div>
                                  <span className="micro-uppercase">ADDED IDS</span>
                                  <div className="chip-list">
                                    {runCompare.eventDiff.addedIds.map((id) => (
                                      <span className="pill pill-succeeded" key={id}>{id}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {runCompare.eventDiff.removedIds.length > 0 && (
                                <div>
                                  <span className="micro-uppercase">REMOVED IDS</span>
                                  <div className="chip-list">
                                    {runCompare.eventDiff.removedIds.map((id) => (
                                      <span className="pill pill-failed" key={id}>{id}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {runCompare.eventDiff.changedRecords.map((change) => (
                            <div className="diff-row" key={change.eventId}>
                              <div className="diff-row-head">
                                <code>{change.eventId}</code>
                                <span>{change.changedFields.join(" · ")}</span>
                              </div>
                              <ProvenanceBlock
                                label="BASELINE → CURRENT"
                                rows={[
                                  ["baseline", `frame ${diagnosticObjectValue(change.baseline.frame_index)} · ${diagnosticObjectValue(change.baseline.direction)} · ${diagnosticObjectValue(change.baseline.status)} · conf ${safeNumber(change.baseline.detection_conf)}`],
                                  ["current", `frame ${diagnosticObjectValue(change.current.frame_index)} · ${diagnosticObjectValue(change.current.direction)} · ${diagnosticObjectValue(change.current.status)} · conf ${safeNumber(change.current.detection_conf)}`],
                                  ...(change.changedFields.some((field) => field.startsWith("decision."))
                                    ? [["decision provenance", `${diagnosticObjectValue(change.baseline.decision)} → ${diagnosticObjectValue(change.current.decision)}`] as [string, ReactNode]]
                                    : []),
                                ]}
                              />
                            </div>
                          ))}
                          {runCompare.eventDiff.addedIds.length === 0
                            && runCompare.eventDiff.removedIds.length === 0
                            && runCompare.eventDiff.changedRecords.length === 0 && (
                            <p className="hint-text">No event-level differences in the backend-owned records.</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="compare-block">
                      <span className="eyebrow">AGGREGATE METRIC DELTAS · SECONDARY</span>
                      {runCompare.metricDeltas.length ? (
                        <div className="delta-grid">
                          {/* Signed, with both absolute values, and no colour: improvement is
                              direction-dependent and is not declared yet (DESIGN.md:898). */}
                          {runCompare.metricDeltas.map((metric) => (
                            <div className="delta-cell" key={metric.key}>
                              <strong className="delta-value">
                                {metric.delta > 0 ? "+" : ""}{metric.delta}
                              </strong>
                              <span>{metric.key} · {metric.baseline} → {metric.current}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="hint-text">
                          No shared numeric metrics were returned by both manifests. Nothing is inferred.
                        </p>
                      )}
                    </div>
                    <div className="compare-block">
                      <span className="eyebrow">CHANGED CONFIG KEYS</span>
                      {runCompare.changedConfigKeys.length ? (
                        <div className="chip-list">
                          {runCompare.changedConfigKeys.map((key) => <span className="chip" key={key}>{key}</span>)}
                        </div>
                      ) : (
                        <p className="hint-text">No changed keys in the backend snapshots.</p>
                      )}
                    </div>
                    <div className="compare-block">
                      <span className="eyebrow">REPLAY CONFIG</span>
                      <p className="hint-text">
                        Load a selected manifest’s safe config into the editor. This changes local fields only; it
                        never runs replay or changes the model.
                      </p>
                      <div className="button-row">
                        <button
                          className="button button-dense"
                          type="button"
                          onClick={() => baselineRun && loadManifestConfig(baselineRun)}
                        >
                          Load baseline config
                        </button>
                        <button
                          className="button button-dense"
                          type="button"
                          onClick={() => currentRun && loadManifestConfig(currentRun)}
                        >
                          Load current config
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    statement="Two different manifests are needed."
                    next="Choose two different backend manifests to compare."
                  />
                )}
              </>
            ) : (
              <LockedPanel
                label="A/B COMPARE LOCKED"
                reason="A/B compare is locked until the backend returns at least two actual RunManifests. No counts, events, or deltas are estimated."
              />
            )}
          </Panel>

          <Panel
            eyebrow="COUNT SUMMARY"
            badge={
              <span className={`pill ${hasSummary ? "pill-succeeded" : "pill-muted"}`}>
                {hasSummary ? "BACKEND SUMMARY" : "SUMMARY REQUIRED"}
              </span>
            }
          >
            {summary ? (
              <>
                <SourcedMetrics
                  sourced={sourced}
                  items={[
                    // `dropped` is counted into `total`, so omitting it makes the
                    // arithmetic on screen fail to close (labApi.ts:158-160).
                    { label: "total", value: summary.total, headline: true },
                    { label: "confirmed", value: summary.confirmed },
                    { label: "flagged", value: summary.flagged },
                    { label: "dropped", value: summary.dropped },
                    { label: "recovered", value: summary.recovered },
                    { label: "excluded", value: summary.excluded },
                    ...(summary.ground_truth != null
                      ? [{ label: "GT target", value: summary.ground_truth }] : []),
                    ...(summary.error_vs_ground_truth != null
                      ? [{ label: "error vs GT", value: summary.error_vs_ground_truth }] : []),
                  ]}
                />
                {(summary.tolerance_pct != null || summary.tolerance_state != null) && (
                  <div className="stat-pair">
                    <span>tolerance</span>
                    <strong>
                      {summary.tolerance_pct != null ? `${(summary.tolerance_pct * 100).toFixed(1)}%` : "—"}
                    </strong>
                    <span className={`pill ${summary.tolerance_state === "within"
                      ? "pill-succeeded"
                      : summary.tolerance_state ? "pill-waiting" : "pill-muted"}`}
                    >
                      {summary.tolerance_state ? summary.tolerance_state.toUpperCase() : "UNKNOWN"}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <LockedPanel
                label="COUNT SUMMARY REQUIRED"
                reason={result
                  ? "Backend returned no result.summary. Counts are not estimated from detection frames."
                  : "Run Replay to show a backend-provided count summary."}
              />
            )}
          </Panel>

          <Panel
            eyebrow="DETECTION DIAGNOSTICS"
            badge={
              <span className={`pill ${hasDiagnostics ? "pill-succeeded" : "pill-muted"}`}>
                {hasDiagnostics ? "BACKEND OUTPUT" : "LOCKED"}
              </span>
            }
          >
            <WarningBanner>
              <span>Detector diagnostics only — these are not accuracy or ground-truth metrics.</span>
            </WarningBanner>
            {diagnostics ? (
              <>
                <SourcedMetrics
                  sourced={sourced}
                  items={[
                    { label: "total detections", value: diagnosticObjectValue(diagnostics.total_detections) },
                    {
                      label: "frames with detections",
                      value: diagnosticObjectValue(diagnostics.frames_with_detections),
                    },
                    { label: "sampled density frames", value: diagnostics.sampled_frame_density.length },
                  ]}
                />
                <div className="compare-block">
                  <span className="micro-uppercase">DETECTIONS BY CLASS</span>
                  {Object.entries(diagnostics.detections_by_class ?? {}).length ? (
                    Object.entries(diagnostics.detections_by_class).map(([classId, count]) => (
                      <div className="stat-pair" key={classId}>
                        <span>class {diagnosticObjectValue(classId)}</span>
                        <strong>{diagnosticObjectValue(count)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="hint-text">Backend returned no per-class counts.</p>
                  )}
                </div>
                <div className="compare-block">
                  <span className="micro-uppercase">CONFIDENCE HISTOGRAM</span>
                  {histogramBins.length ? (
                    histogramBins.map((bin, index) => (
                      <div className="histogram-row" key={`${confidenceBinLabel(bin)}-${index}`}>
                        <span>{confidenceBinLabel(bin)}</span>
                        <span className="histogram-bar">
                          <i style={{ width: `${histogramBarPercent(bin.count, histogramMax)}%` }} />
                        </span>
                        <span className="histogram-count">{diagnosticObjectValue(bin.count)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="hint-text">Backend returned no histogram bins.</p>
                  )}
                </div>
              </>
            ) : (
              <LockedPanel
                label="DETECTOR DIAGNOSTICS LOCKED"
                reason={result
                  ? "This result did not include backend diagnostics."
                  : "Run Replay to show backend-provided detector diagnostics."}
                unlock="No detection metrics are estimated in the browser."
              />
            )}
          </Panel>

          <Panel
            eyebrow="PATH PROVENANCE"
            badge={
              <span className={`pill ${hasPathMetadata ? "pill-succeeded" : "pill-muted"}`}>
                {hasPathMetadata ? "BACKEND METADATA" : "LOCKED"}
              </span>
            }
          >
            {hasPathMetadata ? (
              <>
                <div className="kpi-grid kpi-grid-2">
                  <div className="kpi-cell">
                    <strong className="metric-numeral-sm">{trailPaths.length}</strong>
                    <span className="kpi-label">track paths returned</span>
                  </div>
                  <div className="kpi-cell">
                    <strong className="metric-numeral-sm">{pathEvents.length}</strong>
                    <span className="kpi-label">events with path slices</span>
                  </div>
                </div>
                {pathEvents.slice(0, 3).map((event) => (
                  <ProvenanceBlock
                    key={event.event_id}
                    label={`EVENT ${event.sequence}`}
                    rows={[
                      ["points", `${event.provenance.path?.points.length}`],
                      ["predictor", predictorLabel(event.provenance.path?.predictor)],
                      ["displacement", event.provenance.path?.total_displacement != null
                        ? `${event.provenance.path.total_displacement.toFixed(1)} px`
                        : "—"],
                    ]}
                  />
                ))}
              </>
            ) : (
              <LockedPanel
                label="PATH METADATA LOCKED"
                reason="Path slices and trails appear here only when returned by the backend. The UI never builds paths from crossing events."
              />
            )}
          </Panel>

          <Panel
            eyebrow="PER-CROSSING DETAILS"
            badge={
              <span className={`pill ${events?.length ? "pill-succeeded" : "pill-muted"}`}>
                {events ? `${events.length} EVENT${events.length === 1 ? "" : "S"}` : "EVENTS REQUIRED"}
              </span>
            }
          >
            {events?.length ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Seq</th><th>Frame</th><th>Time</th><th>Track</th>
                      <th>Dir</th><th>Status</th><th>Recovery</th><th>Conf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr
                        key={event.event_id}
                        className={selectedEventId === event.event_id ? "selected" : ""}
                        aria-selected={selectedEventId === event.event_id}
                        tabIndex={0}
                        onClick={() => setSelectedEventId(event.event_id)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                            keyboardEvent.preventDefault();
                            setSelectedEventId(event.event_id);
                          }
                        }}
                      >
                        <td>{event.sequence}</td>
                        <td>{event.frame_index}</td>
                        <td>{safeNumber(event.timestamp_ms / 1000)}s</td>
                        <td>{event.track_id ?? "—"}</td>
                        <td>{directionLabel(event.direction)}</td>
                        <td>
                          <span className={`pill ${verdictPill(event.status)}`}>{statusLabel(event.status)}</span>
                        </td>
                        <td>
                          {event.recovery === "recovered"
                            ? <span className="pill pill-info">RECOVERED</span>
                            : "—"}
                        </td>
                        <td>{safeNumber(event.detection_conf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <LockedPanel
                label="CROSSING INSPECTION LOCKED"
                reason={events
                  ? "Detection-only run: backend returned no crossing events. Crossing inspection is locked."
                  : "No result.events[] returned. Crossing inspection is locked until the backend emits crossing events."}
              />
            )}
          </Panel>

          <Panel
            eyebrow="CROSSING INSPECTOR"
            badge={
              <span className={`pill ${selectedEvent ? "pill-succeeded" : "pill-muted"}`}>
                {selectedEvent ? `EVENT ${selectedEvent.sequence}` : "SELECT A ROW"}
              </span>
            }
          >
            {selectedEvent ? (
              <>
                <div className="detail-grid">
                  <div className="detail-cell">
                    <span>frame</span><strong>{selectedEvent.frame_index}</strong>
                  </div>
                  <div className="detail-cell">
                    <span>time</span><strong>{safeNumber(selectedEvent.timestamp_ms / 1000)}s</strong>
                  </div>
                  <div className="detail-cell">
                    <span>track</span><strong>{selectedEvent.track_id ?? "—"}</strong>
                  </div>
                  <div className="detail-cell">
                    <span>direction</span><strong>{directionLabel(selectedEvent.direction)}</strong>
                  </div>
                  <div className="detail-cell">
                    <span>status</span>
                    <span className={`pill ${verdictPill(selectedEvent.status)}`}>
                      {statusLabel(selectedEvent.status)}
                    </span>
                  </div>
                  <div className="detail-cell">
                    <span>recovery</span><strong>{selectedEvent.recovery.toUpperCase()}</strong>
                  </div>
                  <div className="detail-cell">
                    <span>confidence</span><strong>{safeNumber(selectedEvent.detection_conf)}</strong>
                  </div>
                </div>
                <ProvenanceBlock label="DECISION PROVENANCE">
                  <p className="hint-text">
                    Dedup and cooldown suppression are not shown per event: a suppressed crossing never becomes
                    one, so every event that exists passed both. &quot;dedup hit: no&quot; on every row reads as
                    evidence dedup never fired.
                  </p>
                  <div className="flag-grid">
                    <span>
                      raw conf <strong>{safeNumber(selectedEvent.provenance?.decision?.raw_conf)}</strong>
                    </span>
                    <span>
                      exclusion hit
                      <strong>{selectedEvent.provenance?.decision?.exclusion_hit ? "yes" : "no"}</strong>
                    </span>
                    <span>
                      recovered <strong>{selectedEvent.provenance?.decision?.recovered ? "yes" : "no"}</strong>
                    </span>
                    <span>reason <strong>{selectedEvent.provenance?.decision?.reason ?? "—"}</strong></span>
                  </div>
                </ProvenanceBlock>
                <ProvenanceBlock
                  label="GEOMETRY"
                  rows={[
                    ["centroid", safePoint(selectedEvent.provenance?.geometry?.centroid ?? selectedEvent.centroid)],
                    ["line", safeLine(selectedEvent.provenance?.geometry?.line)],
                    ["zone", selectedEvent.provenance?.geometry?.zone_id
                      ?? selectedEvent.exclusion_zone_id ?? "—"],
                  ]}
                />
                {selectedEvent.provenance?.path ? (
                  <ProvenanceBlock
                    label="PATH PROVENANCE"
                    rows={[
                      ["predictor", predictorLabel(selectedEvent.provenance.path.predictor)],
                      ["points", `${selectedEvent.provenance.path.points.length}`],
                      ["total displacement", safeNumber(selectedEvent.provenance.path.total_displacement)],
                    ]}
                  >
                    <div className="provenance-list provenance-list-scroll">
                      {selectedEvent.provenance.path.points.map((point, index) => (
                        <code key={`${point.frame}-${index}`}>
                          f{point.frame} · {safeNumber(point.t_ms / 1000)}s
                          · ({safeNumber(point.cx)}, {safeNumber(point.cy)}) · c{safeNumber(point.conf)}
                        </code>
                      ))}
                    </div>
                  </ProvenanceBlock>
                ) : (
                  <LockedPanel
                    label="PATH PROVENANCE"
                    reason="Locked: this event has no backend-emitted path slice."
                    compact
                  />
                )}
                {selectedEvent.score_breakdown || selectedEvent.verdict ? (
                  <ProvenanceBlock
                    label="SCORER BREAKDOWN"
                    rows={selectedEvent.score_breakdown
                      ? scorerEntries(selectedEvent.score_breakdown).map(([key, value]) => [key, scorerValue(value)])
                      : undefined}
                  >
                    {selectedEvent.verdict && (
                      <span className={`pill ${verdictPill(selectedEvent.verdict)}`}>
                        {verdictLabel(selectedEvent.verdict)}
                      </span>
                    )}
                    {!selectedEvent.score_breakdown && (
                      <p className="hint-text">Backend returned a verdict without score_breakdown.</p>
                    )}
                  </ProvenanceBlock>
                ) : (
                  <LockedPanel
                    label="SCORER BREAKDOWN"
                    reason="Locked: this event has no backend-emitted scorer fields."
                    compact
                  />
                )}
              </>
            ) : (
              <LockedPanel
                label="CROSSING INSPECTOR"
                reason={events?.length
                  ? "Choose a crossing row to inspect backend provenance."
                  : "Crossing inspector locked: no backend crossing events are available."}
              />
            )}
          </Panel>

          <Panel
            eyebrow="SCORER BREAKDOWN"
            badge={
              <span className={`pill ${hasScorerEventOutput ? "pill-succeeded" : "pill-muted"}`}>
                {hasScorerEventOutput ? `${scoredEvents.length} SCORED` : "BACKEND OUTPUT REQUIRED"}
              </span>
            }
          >
            {hasScorerEventOutput ? (
              scoredEvents.map((event) => (
                <div className="diff-row" key={event.event_id}>
                  <div className="diff-row-head">
                    <code>#{event.sequence} · {event.event_id}</code>
                    <span className={`pill ${verdictPill(event.verdict)}`}>{verdictLabel(event.verdict)}</span>
                  </div>
                  {event.score_breakdown ? (
                    <div className="provenance-rows">
                      {scorerEntries(event.score_breakdown).map(([key, value]) => (
                        <div key={key} style={{ display: "contents" }}>
                          <span className="pk">{key}</span>
                          <span className="pv">{scorerValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="hint-text">Backend returned a verdict without score_breakdown.</p>
                  )}
                </div>
              ))
            ) : (
              <LockedPanel
                label="SCORER OUTPUT REQUIRED"
                reason={scorerLockedReason || "Per-event score_breakdown and verdict fields appear here only when emitted by the backend. No score is inferred from confidence, status, or paths."}
              />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
