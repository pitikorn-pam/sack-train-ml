import { supabase } from "./supabase";

export interface DatasetSelection {
  yamlKey: string | null;
  bundleKey: string | null;
  yamlText: string | null;
  classes?: string[];
}

export async function uploadDatasetFile({
  modelLineSlug, kind, file, signal,
}: {
  modelLineSlug: string;
  kind: "yaml" | "zip";
  file: File;
  signal?: AbortSignal;
}): Promise<string> {
  const contentType = kind === "yaml" ? "application/x-yaml" : "application/zip";
  const { data, error } = await supabase.functions.invoke("upload-dataset", {
    body: { filename: file.name, model_line_slug: modelLineSlug, kind, content_type: contentType },
  });
  if (error) throw error;
  signal?.throwIfAborted();
  const result: unknown = data;
  if (typeof result !== "object" || result === null || !("upload_url" in result) || !("r2_key" in result)
      || typeof result.upload_url !== "string" || typeof result.r2_key !== "string") {
    throw new Error("Invalid response from upload-dataset.");
  }
  let response: Response;
  try {
    response = await fetch(result.upload_url, {
      method: "PUT", headers: { "Content-Type": contentType }, body: file, signal,
    });
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(
      `Could not reach R2 at ${safeHost(result.upload_url)} to upload the file ` +
      `(${error instanceof Error ? error.message : "network error"}). ` +
      `The presigned URL was issued; check that the bucket's CORS policy allows PUT from ${location.origin}.`,
    );
  }
  if (!response.ok) throw new Error(`R2 PUT failed (${response.status}) at ${safeHost(result.upload_url)}.`);
  return result.r2_key;
}

export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the storage host";
  }
}
