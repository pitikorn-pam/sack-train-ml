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
  provenance: EventProvenance;
};

export type LabCapabilities = {
  tracker?: boolean;
  healer?: boolean;
  scorer?: boolean;
};

export type LabSummary = {
  confirmed: number;
  flagged: number;
  recovered: number;
  excluded: number;
  total_crossings: number;
  ground_truth?: number | null;
  error_vs_ground_truth?: number | null;
};

export type RunManifest = {
  schema_version: "lab.v1";
  run_id: string;
  created_at: string;
  input: {
    filename?: string;
    sha256?: string;
    video_width: number;
    video_height: number;
    fps: number;
    frame_count: number;
    frame_start: number;
    frame_end: number;
    frame_stride: number;
  };
  model: {
    path: string;
    identifier?: string;
    sha256?: string;
  };
  config: Record<string, unknown>;
  source: "lab";
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
  // Experimental fields are retained in the config contract but are not wired by v0 backend.
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
  capabilities?: LabCapabilities;
};

export type LabHealth = {
  ok: boolean;
  capabilities?: LabCapabilities;
};
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

export async function runInfer(video: File, config: LabConfig, modelFile?: File): Promise<LabResult> {
  const fd = new FormData();
  fd.append("video", video);
  fd.append("config", JSON.stringify(config));
  if (modelFile) fd.append("model", modelFile, modelFile.name);
  const r = await fetch("/api/lab/infer", { method: "POST", body: fd });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json())?.detail ?? ""; } catch { /* non-json response */ }
    throw new Error(`inference failed (${r.status})${detail ? `: ${detail}` : ""}`);
  }
  return r.json();
}
