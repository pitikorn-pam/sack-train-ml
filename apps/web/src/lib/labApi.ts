// labApi — client for the Lab inference backend (apps/api/lab_server.py, via Vite /api/lab proxy).

/** A pixel coordinate in the source video's coordinate system: [x, y]. */
export type Point = [number, number];

export type ExclusionZone = {
  zone_id: string;
  points: Point[];
  enabled: boolean;
  coordinate_space: "pixel";
  frame_ref: number;
  mode: "hard_exclude";
};

export type CountingLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  coordinate_space: "pixel";
  frame_ref: number;
  inflip: boolean;
};

/** A backend-emitted centroid sample; never derived from crossing events in the UI. */
export type PathPoint = {
  frame: number;
  t_ms: number;
  cx: number;
  cy: number;
  conf: number;
};

export type PathPredictorMetadata = {
  requested?: string | null;
  supported?: boolean | null;
  status?: string | null;
  points_used?: number | null;
};

export type PathProvenance = {
  points: PathPoint[];
  predictor?: "linear" | "quadratic" | "optical-flow" | string | PathPredictorMetadata;
  corridor_distance?: number;
  total_displacement?: number;
};

export type TrackPath = {
  track_id: number | string;
  class_id: number;
  points: PathPoint[];
  born_frame?: number;
  last_frame?: number;
  total_displacement?: number;
  alive?: boolean;
};

export type ScorerMode = "passthrough" | "fused";
export type ScorerValue = number | string | boolean | null;
export type ScorerConfig = Record<string, ScorerValue | ScorerValue[]>;
export type ScorerFeatures = Record<string, ScorerValue>;
export type ScoreBreakdown = Record<string, ScorerValue>;
export type ScorerVerdict = "confirmed" | "flagged" | "rejected" | "excluded" | string;

export type EventProvenance = {
  run_id: string;
  source_video_sha256?: string;
  model_sha256?: string;
  config_hash?: string;
  detector_frame: number;
  crossing_frame: number;
  tracker: {
    tracker_type: string;
    track_id: number | string | null;
    track_age_frames?: number;
  };
  decision: {
    conf_split?: number;
    raw_conf?: number;
    dedup_hit: boolean;
    cooldown_hit: boolean;
    exclusion_hit: boolean;
    recovered: boolean;
    reason?: string;
  };
  geometry: {
    line: CountingLine;
    centroid: Point;
    zone_id?: string;
  };
  /** Present only when the backend produced an auditable path slice. */
  path?: PathProvenance;
};

export type CrossingEvent = {
  event_id: string;
  sequence: number;
  frame_index: number;
  timestamp_ms: number;
  track_id: number | string | null;
  class_id: number;
  centroid: Point;
  bbox?: [number, number, number, number];
  direction: "in" | "out" | "unknown";
  side_before?: "a" | "b" | "unknown";
  side_after?: "a" | "b" | "unknown";
  detection_conf?: number;
  status: "confirmed" | "flagged" | "excluded";
  recovery: "none" | "recovered";
  exclusion_zone_id?: string;
  /** Present only when the backend scorer emitted an auditable decision. */
  score_breakdown?: ScoreBreakdown;
  verdict?: ScorerVerdict;
  provenance: EventProvenance;
};

export type LabCapabilities = {
  tracker?: boolean;
  healer?: boolean;
  optical_flow?: boolean;
  scorer?: boolean;
  trail?: boolean;
  path?: boolean;
};

/** Backend-owned explanations for capabilities that are unavailable or locked. */
export type LabCapabilityDetail = {
  enabled?: boolean;
  supported?: boolean;
  status?: string;
  reason?: string;
};
export type LabCapabilityDetails = Record<string, LabCapabilityDetail>;

/** A persisted event row emitted by the backend manifest. Optional fields keep this client
 * compatible with contract revisions while preserving the rule that identity is backend-owned. */
export type EventRecord = {
  event_id: string;
  frame_index: number;
  track_id: number | string | null;
  direction: string;
  status: string;
  recovery: string;
  detection_conf: number | null;
  decision?: Record<string, unknown> | null;
};

export type LabSummary = {
  confirmed: number;
  flagged: number;
  recovered: number;
  excluded: number;
  /** Total emitted crossing events, including excluded events. */
  total: number;
  total_crossings?: number;
  ground_truth?: number | null;
  tolerance_pct?: number | null;
  error_vs_ground_truth?: number | null;
  tolerance_state?: "within" | "over" | "under" | null;
};

export type RunManifest = {
  schema_version: string;
  run_id: string;
  created_at: string;
  input: {
    filename?: string | null;
    sha256?: string | null;
    video_width?: number | null;
    video_height?: number | null;
    fps?: number | null;
    frame_count?: number | null;
    frame_start?: number;
    frame_end?: number;
    frame_stride?: number;
  };
  model: {
    path?: string;
    identifier?: string;
    sha256?: string | null;
    size_bytes?: number | null;
  };
  config: Record<string, unknown>;
  source: "lab";
  config_snapshot?: Record<string, unknown>;
  counts?: {
    summary?: Record<string, unknown> | null;
    events?: {
      count?: number;
      event_ids?: string[];
      provenance_fields?: string[];
      /** Backend-owned event identity and decision fields. Never synthesize these in the UI. */
      event_records?: EventRecord[];
    };
  };
  output?: { video_id?: string; video_url?: string };
};

export type RunMetricKey = "confirmed" | "flagged" | "recovered" | "excluded" | "total";
export type RunMetricDelta = { key: RunMetricKey; baseline: number; current: number; delta: number };
export type EventRecordChange = {
  eventId: string;
  changedFields: string[];
  baseline: EventRecord;
  current: EventRecord;
};
export type EventRecordDiff = {
  locked: boolean;
  addedIds: string[];
  removedIds: string[];
  changedRecords: EventRecordChange[];
};
export type RunCompare = {
  baselineId: string;
  currentId: string;
  changedConfigKeys: string[];
  metricDeltas: RunMetricDelta[];
  eventDiff: EventRecordDiff;
};

const REPLAY_CONFIG_KEYS: ReadonlySet<keyof LabConfig> = new Set([
  "conf", "iou", "classes", "frame_start", "frame_end", "frame_stride", "device",
  "video_width", "video_height", "line", "exclusion_zones", "conf_split", "roi_dedup_px",
  "roi_dedup_frames", "count_cooldown_frames", "tracker_type", "track_buffer", "match_thresh",
  "heal", "heal_require_person", "max_gap_frames", "inflip", "ground_truth", "tolerance_pct",
  "show_trail", "trail_len",
]);

function jsonValue(value: unknown): string { return JSON.stringify(value) ?? "undefined"; }
function numericMetric(summary: Record<string, unknown> | null | undefined, key: RunMetricKey): number | null {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Read only the backend-owned config snapshot; never reconstruct it from UI state. */
export function manifestConfig(manifest: RunManifest): Record<string, unknown> {
  return manifest.config_snapshot ?? manifest.config;
}

/** Return a conservative, model/path-free config suitable for explicit editor replay. */
export function replayConfigFromManifest(manifest: RunManifest): Partial<LabConfig> {
  const source = manifestConfig(manifest);
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => {
    if (!REPLAY_CONFIG_KEYS.has(key as keyof LabConfig) || key === "model_path") return false;
    return value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string" || Array.isArray(value) || typeof value === "object";
  })) as Partial<LabConfig>;
}

function compareEventRecords(baseline: RunManifest, current: RunManifest): EventRecordDiff {
  const baselineRecords = baseline.counts?.events?.event_records;
  const currentRecords = current.counts?.events?.event_records;
  if (!Array.isArray(baselineRecords) || !Array.isArray(currentRecords)) {
    return { locked: true, addedIds: [], removedIds: [], changedRecords: [] };
  }
  const baselineById = new Map(baselineRecords.map((record) => [record.event_id, record]));
  const currentById = new Map(currentRecords.map((record) => [record.event_id, record]));
  const addedIds = currentRecords.map((record) => record.event_id).filter((id) => !baselineById.has(id));
  const removedIds = baselineRecords.map((record) => record.event_id).filter((id) => !currentById.has(id));
  const changedRecords = currentRecords.flatMap((currentRecord) => {
    const baselineRecord = baselineById.get(currentRecord.event_id);
    if (!baselineRecord) return [];
    const changedFields: string[] = (["frame_index", "track_id", "direction", "status", "recovery", "detection_conf"] as const)
      .filter((key) => jsonValue(baselineRecord[key]) !== jsonValue(currentRecord[key]));
    const decisionKeys = new Set([
      ...Object.keys(baselineRecord.decision ?? {}),
      ...Object.keys(currentRecord.decision ?? {}),
    ]);
    decisionKeys.forEach((key) => {
      if (jsonValue(baselineRecord.decision?.[key]) !== jsonValue(currentRecord.decision?.[key])) changedFields.push(`decision.${key}`);
    });
    return changedFields.length ? [{ eventId: currentRecord.event_id, changedFields, baseline: baselineRecord, current: currentRecord }] : [];
  });
  return { locked: false, addedIds, removedIds, changedRecords };
}

export function compareRunManifests(baseline: RunManifest, current: RunManifest): RunCompare {
  const baselineConfig = manifestConfig(baseline);
  const currentConfig = manifestConfig(current);
  const changedConfigKeys = Array.from(new Set([...Object.keys(baselineConfig), ...Object.keys(currentConfig)]))
    .filter((key) => jsonValue(baselineConfig[key]) !== jsonValue(currentConfig[key])).sort();
  const baselineSummary = baseline.counts?.summary;
  const currentSummary = current.counts?.summary;
  const metricDeltas = (Object.keys({ confirmed: 1, flagged: 1, recovered: 1, excluded: 1, total: 1 }) as RunMetricKey[])
    .map((key) => [key, numericMetric(baselineSummary, key), numericMetric(currentSummary, key)] as const)
    .filter((entry): entry is readonly [RunMetricKey, number, number] => entry[1] !== null && entry[2] !== null)
    .map(([key, baselineValue, currentValue]) => ({ key, baseline: baselineValue, current: currentValue, delta: currentValue - baselineValue }));
  return { baselineId: baseline.run_id, currentId: current.run_id, changedConfigKeys, metricDeltas, eventDiff: compareEventRecords(baseline, current) };
}

/** Backend-owned persisted runs. An empty response is a truthful empty history. */
export type RunHistoryResponse = {
  runs: RunManifest[];
  schema_version?: string;
};

export type LabConfig = {
  model_path?: string;
  conf?: number;
  iou?: number;
  classes?: number[];
  frame_start?: number;
  frame_end?: number;
  frame_stride?: number;
  device?: "mps" | "cpu";
  // v1 research-contract fields; optional to preserve the v0 request shape.
  video_width?: number;
  video_height?: number;
  line?: CountingLine | null;
  exclusion_zones?: ExclusionZone[];
  conf_split?: number;
  roi_dedup_px?: number;
  roi_dedup_frames?: number;
  count_cooldown_frames?: number;
  tracker_type?: string;
  track_buffer?: number;
  match_thresh?: number;
  heal?: boolean;
  heal_require_person?: boolean;
  max_gap_frames?: number;
  inflip?: boolean;
  /** Optional scoring target. Omit to run without GT comparison. */
  ground_truth?: number;
  /** Allowed absolute error from GT, expressed as a percentage. */
  tolerance_pct?: number;
  /** Sent only when the backend advertises trail/path support. */
  show_trail?: boolean;
  trail_len?: number;
  // Experimental fields are retained in the config contract but are not wired by v0 backend.
};

export type DetectionConfidenceBin = {
  /** Inclusive lower edge supplied by the backend. */
  lower: number;
  /** Exclusive upper edge supplied by the backend. */
  upper: number;
  count: number;
};

export type DetectionDiagnostics = {
  total_detections: number;
  detections_by_class: Record<string, number>;
  confidence_histogram: { bins: DetectionConfidenceBin[] };
  frames_with_detections: number;
  sampled_frame_density: unknown[];
};

export type LabResult = {
  video_id: string;
  video_url: string;
  frames_processed: number;
  frames_total: number;
  max_sack_per_frame: number;
  avg_sack_per_frame: number;
  confirmed: number | null;
  flagged: number | null;
  recovered: number | null;
  per_crossing: unknown[];
  /** Backend-owned detector diagnostics; absent means this backend cannot provide them. */
  diagnostics?: DetectionDiagnostics;
  config: Record<string, unknown>;
  // v1 research-contract fields; optional to preserve v0 responses.
  video_width?: number;
  video_height?: number;
  events?: CrossingEvent[];
  summary?: LabSummary;
  manifest?: RunManifest;
  schema_version?: "lab.v1";
  run?: RunManifest;
  provenance?: {
    core_version?: string;
    generated_at?: string;
  };
  artifacts?: {
    overlay_video?: string;
    events_csv?: string;
    config_json?: string;
  };
  /** Backend-owned trails; the frontend must not reconstruct these from events. */
  trails?: TrackPath[];
  paths?: TrackPath[];
  trail?: { trail_len?: number; paths?: TrackPath[] };
  capabilities?: LabCapabilities;
  capability_details?: LabCapabilityDetails;
  unsupported_capabilities?: string[];
  /** Backend scorer contract. Absent means scorer output is unavailable. */
  scorer_mode?: ScorerMode;
  scorer_config?: ScorerConfig;
  scorer_features?: ScorerFeatures;
};

export type LabHealth = {
  ok: boolean;
  capabilities?: LabCapabilities;
  capability_details?: LabCapabilityDetails;
  unsupported_capabilities?: string[];
};
export type LabJobState = "queued" | "running" | "succeeded" | "failed" | string;

/** Backend-owned replay job snapshot. Optional fields keep the client compatible with worker revisions. */
export type LabJobStatus = {
  job_id: string;
  status: LabJobState;
  progress?: number | null;
  processed_frames?: number | null;
  total_frames?: number | null;
  elapsed_ms?: number | null;
  eta_ms?: number | null;
  result?: LabResult;
  message?: string | null;
  error?: string | null;
  detail?: string | null;
};

export type LabJobStart = {
  job_id: string;
  status?: LabJobState;
};

/** Backend-owned saved replay task. File objects are intentionally not persisted. */
export type LabTask = {
  task_id: string;
  name: string;
  description?: string | null;
  config?: LabConfig | null;
  source?: Record<string, unknown> | null;
  model?: Record<string, unknown> | null;
  run_ids?: string[];
  latest_run_id?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
};
export type LabTaskInput = { name: string; description?: string };
export type LabTaskUpdate = { config?: LabConfig; source?: Record<string, unknown>; model?: Record<string, unknown>; description?: string; status?: string };

/** Signals that the optional async endpoint is not deployed; callers may use the legacy sync endpoint. */
export class LabJobEndpointUnavailable extends Error {
  constructor() {
    super("Lab replay jobs are not available");
    this.name = "LabJobEndpointUnavailable";
  }
}

export type LabModels = {
  models: string[];
  default: string;
  defaults: Record<string, unknown>;
};

export async function labHealth(): Promise<LabHealth> {
  const r = await fetch("/api/lab/health");
  if (!r.ok) throw new Error(`lab backend not reachable (${r.status})`);
  return r.json();
}

export async function labModels(): Promise<LabModels> {
  const r = await fetch("/api/lab/models");
  if (!r.ok) throw new Error(`models fetch failed (${r.status})`);
  return r.json();
}

export async function labRuns(taskId?: string): Promise<RunHistoryResponse> {
  const query = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
  const r = await fetch(`/api/lab/runs${query}`);
  if (!r.ok) throw new Error(`run history unavailable (${r.status})`);
  const payload: unknown = await r.json();
  if (Array.isArray(payload)) return { runs: payload as RunManifest[] };
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { runs?: unknown }).runs)) {
    throw new Error("run history response has no runs array");
  }
  return payload as RunHistoryResponse;
}

async function taskResponse(response: Response): Promise<LabTask> {
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`task request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const payload: unknown = await response.json();
  const task = payload && typeof payload === "object" && "task" in payload ? (payload as { task: unknown }).task : payload;
  if (!task || typeof task !== "object" || typeof (task as { task_id?: unknown }).task_id !== "string") throw new Error("task response did not include a task_id");
  return task as LabTask;
}

export async function labTasks(): Promise<LabTask[]> {
  const response = await fetch("/api/lab/tasks");
  if (!response.ok) { const detail = await responseDetail(response); throw new Error(`tasks unavailable (${response.status})${detail ? `: ${detail}` : ""}`); }
  const payload: unknown = await response.json();
  const tasks = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { tasks?: unknown }).tasks) ? (payload as { tasks: LabTask[] }).tasks : null;
  if (!tasks) throw new Error("tasks response has no tasks array");
  return tasks;
}
export async function labTask(taskId: string): Promise<LabTask> { return taskResponse(await fetch(`/api/lab/tasks/${encodeURIComponent(taskId)}`)); }
export async function createLabTask(input: LabTaskInput): Promise<LabTask> {
  return taskResponse(await fetch("/api/lab/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}
export async function updateLabTask(taskId: string, input: LabTaskUpdate): Promise<LabTask> {
  return taskResponse(await fetch(`/api/lab/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}

function replayForm(video: File, config: LabConfig, modelFile?: File, taskId?: string): FormData {
  const fd = new FormData();
  fd.append("video", video);
  fd.append("config", JSON.stringify(config));
  if (modelFile) fd.append("model", modelFile, modelFile.name);
  if (taskId) fd.append("task_id", taskId);
  return fd;
}

async function responseDetail(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { detail?: unknown; message?: unknown; error?: unknown };
    const value = payload.detail ?? payload.message ?? payload.error;
    return typeof value === "string" ? value : "";
  } catch { return ""; }
}

export async function startInferJob(video: File, config: LabConfig, modelFile?: File, signal?: AbortSignal, taskId?: string): Promise<LabJobStart> {
  const response = await fetch("/api/lab/infer/jobs", { method: "POST", body: replayForm(video, config, modelFile, taskId), signal });
  if (response.status === 404 || response.status === 405) throw new LabJobEndpointUnavailable();
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`inference job start failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || typeof (payload as { job_id?: unknown }).job_id !== "string") {
    throw new Error("inference job response did not include a job_id");
  }
  return payload as LabJobStart;
}

export async function getInferJob(jobId: string, signal?: AbortSignal): Promise<LabJobStatus> {
  const response = await fetch(`/api/lab/jobs/${encodeURIComponent(jobId)}`, { signal });
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`inference job status failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || typeof (payload as { status?: unknown }).status !== "string") {
    throw new Error("inference job status response was invalid");
  }
  return { job_id: jobId, ...(payload as Omit<LabJobStatus, "job_id">) };
}

export async function runInfer(video: File, config: LabConfig, modelFile?: File, signal?: AbortSignal, taskId?: string): Promise<LabResult> {
  const response = await fetch("/api/lab/infer", { method: "POST", body: replayForm(video, config, modelFile, taskId), signal });
  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`inference failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}
