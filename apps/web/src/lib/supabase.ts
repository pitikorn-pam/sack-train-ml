import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env not set. Copy apps/web/.env.example to apps/web/.env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Run = {
  id: string;
  model_line_id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  config_yaml: Record<string, unknown>;
  hardware: Record<string, unknown> | null;
  git_sha: string | null;
  provider_job_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RunMetric = {
  run_id: string;
  step: number;
  epoch: number | null;
  name: string;
  value: number;
  ts: string;
};

export type ModelLine = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
};
