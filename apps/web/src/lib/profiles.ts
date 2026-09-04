/**
 * Profiles and data assets — reads for the New-run form.
 *
 * Both tables arrive in migration 08. Until it is applied these queries fail,
 * so every read degrades to an empty list and the form keeps working with its
 * schema defaults and a direct upload. See issue 13.
 */
import { supabase } from "./supabase";

export interface RunProfile {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  form: "train" | "compile";
  values: Record<string, unknown>;
  version: number;
  builtin: boolean;
}

export interface DataAsset {
  id: string;
  kind: "dataset" | "calibration_set";
  slug: string;
  display_name: string;
  manifest_key: string | null;
  bundle_key: string | null;
  content_hash: string | null;
  stats: Record<string, number | string>;
}

/** A read that distinguishes "no rows yet" from "table does not exist yet". */
export interface Loaded<T> { ok: boolean; rows: T[] }

export async function loadProfiles(
  modelLineId: string | null, form: "train" | "compile",
): Promise<Loaded<RunProfile>> {
  if (!modelLineId) return { ok: true, rows: [] };
  const { data, error } = await supabase
    .from("run_profiles")
    .select("*")
    .eq("model_line_id", modelLineId)
    .eq("form", form)
    .eq("archived", false)
    .order("builtin", { ascending: false })
    .order("display_name");
  if (error) return { ok: false, rows: [] };
  // Keep only the newest version of each slug — older ones exist so past runs stay explainable.
  const newest = new Map<string, RunProfile>();
  for (const p of (data ?? []) as RunProfile[]) {
    const seen = newest.get(p.slug);
    if (!seen || p.version > seen.version) newest.set(p.slug, p);
  }
  return { ok: true, rows: [...newest.values()] };
}

export async function loadDataAssets(
  modelLineId: string | null, kind: DataAsset["kind"],
): Promise<Loaded<DataAsset>> {
  if (!modelLineId) return { ok: true, rows: [] };
  const { data, error } = await supabase
    .from("data_assets")
    .select("*")
    .eq("model_line_id", modelLineId)
    .eq("kind", kind)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: (data ?? []) as DataAsset[] };
}

/**
 * Saving never mutates: it inserts the next version of the slug, so a run that
 * cited version 1 keeps meaning version 1.
 */
export async function saveProfile(args: {
  modelLineId: string;
  slug: string;
  displayName: string;
  form: "train" | "compile";
  values: Record<string, unknown>;
}) {
  const { data: existing } = await supabase
    .from("run_profiles")
    .select("version")
    .eq("model_line_id", args.modelLineId)
    .eq("slug", args.slug)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((existing?.[0] as { version?: number } | undefined)?.version ?? 0) + 1;

  const { error } = await supabase.from("run_profiles").insert({
    model_line_id: args.modelLineId,
    slug: args.slug,
    display_name: args.displayName,
    form: args.form,
    values: args.values,
    version,
    builtin: false,
  });
  if (error) throw error;
  return version;
}

export async function registerDataset(args: {
  modelLineId: string;
  slug: string;
  displayName: string;
  manifestKey: string;
  bundleKey: string | null;
  stats: Record<string, number | string>;
}) {
  const { error } = await supabase.from("data_assets").insert({
    model_line_id: args.modelLineId,
    kind: "dataset",
    slug: args.slug,
    display_name: args.displayName,
    manifest_key: args.manifestKey,
    bundle_key: args.bundleKey,
    stats: args.stats,
  });
  if (error) throw error;
}

export const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
