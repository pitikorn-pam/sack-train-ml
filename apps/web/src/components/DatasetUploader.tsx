/**
 * DatasetUploader — combined widget for uploading a YOLO dataset
 * (YAML config + optional image ZIP bundle) to R2 via the
 * upload-dataset edge function.
 *
 * Flow per file:
 *   1. POST upload-dataset → {upload_url, r2_key, kind}
 *   2. PUT file bytes to upload_url (presigned R2 PUT, 15 min TTL)
 *   3. Report back {yaml_key, bundle_key} to parent
 *
 * Also exposes the YAML text content to the parent so NewRun can parse
 * class names locally without re-fetching.
 */
import { useState } from "react";
import { Upload, FileText, FileArchive, Check, X } from "lucide-react";
import { supabase } from "../lib/supabase";

interface FileSlot {
  file: File | null;
  r2_key: string | null;
  uploading: boolean;
  progress: number; // 0-100
  error: string | null;
}

interface Props {
  modelLineSlug: string;
  onChange: (state: {
    yamlKey: string | null;
    bundleKey: string | null;
    yamlText: string | null;
  }) => void;
}

export function DatasetUploader({ modelLineSlug, onChange }: Props) {
  const [yaml, setYaml] = useState<FileSlot>(emptySlot());
  const [bundle, setBundle] = useState<FileSlot>(emptySlot());

  async function uploadFile(kind: "yaml" | "zip", file: File): Promise<string> {
    const { data, error } = await supabase.functions.invoke("upload-dataset", {
      body: {
        filename: file.name,
        model_line_slug: modelLineSlug,
        kind,
        content_type: kind === "yaml" ? "application/x-yaml" : "application/zip",
      },
    });
    if (error) throw error;
    if (!data?.upload_url || !data?.r2_key) throw new Error("invalid response from upload-dataset");

    // PUT to R2 presigned URL
    const res = await fetch(data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": kind === "yaml" ? "application/x-yaml" : "application/zip" },
      body: file,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 PUT failed (${res.status}): ${text}`);
    }
    return data.r2_key;
  }

  async function handleSelect(kind: "yaml" | "zip", file: File | null) {
    if (!file) return;
    const setter = kind === "yaml" ? setYaml : setBundle;
    setter({ file, r2_key: null, uploading: true, progress: 30, error: null });

    let yamlText: string | null = null;
    if (kind === "yaml") {
      try { yamlText = await file.text(); } catch { yamlText = null; }
    }

    try {
      setter((s) => ({ ...s, progress: 60 }));
      const r2_key = await uploadFile(kind, file);
      setter({ file, r2_key, uploading: false, progress: 100, error: null });

      // Push state to parent — fetch the *current* sibling slot's r2_key
      if (kind === "yaml") {
        onChange({ yamlKey: r2_key, bundleKey: bundle.r2_key, yamlText });
      } else {
        onChange({ yamlKey: yaml.r2_key, bundleKey: r2_key, yamlText: null });
      }
    } catch (e: any) {
      setter({ file, r2_key: null, uploading: false, progress: 0, error: String(e?.message ?? e) });
    }
  }

  return (
    <div className="dataset-uploader">
      <Slot
        kind="yaml"
        icon={<FileText size={16} />}
        label="Dataset YAML"
        accept=".yaml,.yml"
        slot={yaml}
        onSelect={(f) => handleSelect("yaml", f)}
      />
      <Slot
        kind="zip"
        icon={<FileArchive size={16} />}
        label="Image bundle (.zip)"
        accept=".zip"
        slot={bundle}
        onSelect={(f) => handleSelect("zip", f)}
        optional
      />
    </div>
  );
}

function Slot(props: {
  kind: "yaml" | "zip";
  icon: React.ReactNode;
  label: string;
  accept: string;
  slot: FileSlot;
  onSelect: (f: File | null) => void;
  optional?: boolean;
}) {
  const { icon, label, accept, slot, onSelect, optional } = props;
  return (
    <div className="uploader-row">
      <strong>{icon} {label}{optional && <> <span className="muted">(opt)</span></>}</strong>
      {!slot.file && (
        <label className="button">
          <Upload size={14} />
          Choose file
          <input
            type="file"
            accept={accept}
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </label>
      )}
      {slot.file && (
        <>
          <span className="muted">{slot.file.name}</span>
          {slot.uploading && (
            <div className="uploader-progress">
              <div className="uploader-progress-fill" style={{ width: `${slot.progress}%` }} />
            </div>
          )}
          {slot.r2_key && (
            <span className="uploader-status ok"><Check size={12} /> uploaded</span>
          )}
          {slot.error && (
            <span className="uploader-status err"><X size={12} /> {slot.error}</span>
          )}
          {!slot.uploading && (
            <button type="button" className="link-button" onClick={() => onSelect(null)}>
              change
            </button>
          )}
        </>
      )}
    </div>
  );
}

function emptySlot(): FileSlot {
  return { file: null, r2_key: null, uploading: false, progress: 0, error: null };
}
