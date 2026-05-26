/**
 * Derive a unified activity stream from runs / versions / deployments.
 * Stored "read" set lives in localStorage keyed by user email.
 */
import type { Run } from "./supabase";

export type ActivityTone = "info" | "success" | "danger" | "muted";

export interface Activity {
  id: string;             // stable key — "run:<id>:<status>"
  tone: ActivityTone;
  title: string;
  detail: string;
  ts: string;
  section?: "overview" | "train" | "models" | "storage";
}

interface Version {
  id: string;
  semver: string;
  created_at: string;
}

interface Deployment {
  id: string;
  channel_name: string;
  version_id: string;
  status: "active" | "archived";
  is_default: boolean;
  deployed_at: string;
}

export function deriveActivities(args: {
  runs: Run[];
  versions: Version[];
  deployments: Deployment[];
}): Activity[] {
  const { runs, versions, deployments } = args;
  const out: Activity[] = [];

  for (const r of runs) {
    const stable = `run:${r.id}:${r.status}`;
    let tone: ActivityTone = "info";
    let title = "";
    let detail = `${r.id.slice(0, 8)} · ${r.status}`;
    switch (r.status) {
      case "running":
        tone = "info";
        title = "Training running";
        break;
      case "succeeded":
        tone = "success";
        title = "Training finished";
        break;
      case "failed":
        tone = "danger";
        title = "Training failed";
        const logs = (r.config_yaml as any)?.logs as any[] | undefined;
        const lastErr = logs?.filter((l) => l?.status === "error").pop();
        if (lastErr?.message) detail = lastErr.message.slice(0, 120);
        break;
      case "cancelled":
        tone = "muted";
        title = "Training cancelled";
        break;
      default:
        continue; // skip pending
    }
    out.push({
      id: stable,
      tone,
      title,
      detail,
      ts: r.finished_at ?? r.started_at ?? r.updated_at ?? r.created_at,
      section: "train",
    });
  }

  for (const v of versions) {
    out.push({
      id: `version:${v.id}`,
      tone: "success",
      title: "New version",
      detail: `v${v.semver} created`,
      ts: v.created_at,
      section: "models",
    });
  }

  for (const d of deployments) {
    out.push({
      id: `deploy:${d.id}:${d.status}:${d.is_default ? "default" : ""}`,
      tone: d.status === "archived" ? "muted" : (d.is_default ? "success" : "info"),
      title: d.status === "archived"
        ? `Undeployed from ${d.channel_name}`
        : d.is_default
          ? `Default on ${d.channel_name}`
          : `Deployed to ${d.channel_name}`,
      detail: `version ${d.version_id.slice(0, 8)}`,
      ts: d.deployed_at,
      section: "models",
    });
  }

  out.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  return out.slice(0, 24);
}

const READ_KEY = (email: string) => `bscp.activity.read.${email}`;

export function loadReadSet(email: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(email)) || "[]"));
  } catch {
    return new Set();
  }
}

export function saveReadSet(email: string, set: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY(email), JSON.stringify([...set]));
  } catch {
    // localStorage may be disabled
  }
}
