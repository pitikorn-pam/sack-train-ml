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
 * Also exposes the YAML text content to the parent so NewRunV3 can parse
 * class names locally without re-fetching.
 */
import { useState } from "react";
import { Upload, FileText, FileArchive, Check, X } from "lucide-react";
import { type DatasetSelection, uploadDatasetFile } from "../lib/datasetUpload";

interface FileSlot {
  file: File | null;
  r2_key: string | null;
  uploading: boolean;
  progress: number; // 0-100
  error: string | null;
}

interface Props {
  modelLineSlug: string;
  onChange: (state: DatasetSelection) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function DatasetUploader({ modelLineSlug, onChange, onBusyChange }: Props) {
  const [yaml, setYaml] = useState<FileSlot>(emptySlot());
  const [bundle, setBundle] = useState<FileSlot>(emptySlot());

  /**
   * Clear a slot so a different file can be chosen.
   *
   * This is its own path rather than `handleSelect(kind, null)`, which is what the
   * "change" button used to call: `handleSelect` opens with `if (!file) return`
   * (the file picker's own cancel case), so the button was inert — a visible
   * control that could not do the one thing it named. The parent has to be told
   * too, or a successful upload's r2_key survives the file being taken away.
   */
  function handleReset(kind: "yaml" | "zip") {
    if (kind === "yaml") {
      setYaml(emptySlot());
      onChange({ yamlKey: null, bundleKey: bundle.r2_key, yamlText: null });
    } else {
      setBundle(emptySlot());
      onChange({ yamlKey: yaml.r2_key, bundleKey: null, yamlText: null });
    }
  }

  async function handleSelect(kind: "yaml" | "zip", file: File | null) {
    if (!file || yaml.uploading || bundle.uploading) return;
    onBusyChange?.(true);
    onChange(kind === "yaml"
      ? { yamlKey: null, bundleKey: bundle.r2_key, yamlText: null }
      : { yamlKey: yaml.r2_key, bundleKey: null, yamlText: null });
    const setter = kind === "yaml" ? setYaml : setBundle;
    setter({ file, r2_key: null, uploading: true, progress: 30, error: null });

    let yamlText: string | null = null;
    if (kind === "yaml") {
      try { yamlText = await file.text(); } catch { yamlText = null; }
    }

    try {
      setter((s) => ({ ...s, progress: 60 }));
      const r2_key = await uploadDatasetFile({ modelLineSlug, kind, file });
      setter({ file, r2_key, uploading: false, progress: 100, error: null });

      // Push state to parent — fetch the *current* sibling slot's r2_key
      if (kind === "yaml") {
        onChange({ yamlKey: r2_key, bundleKey: bundle.r2_key, yamlText });
      } else {
        onChange({ yamlKey: yaml.r2_key, bundleKey: r2_key, yamlText: null });
      }
    } catch (error) {
      setter({ file, r2_key: null, uploading: false, progress: 0,
        error: error instanceof Error ? error.message : String(error) });
    } finally {
      onBusyChange?.(false);
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
        disabled={bundle.uploading}
        onSelect={(f) => handleSelect("yaml", f)}
        onReset={() => handleReset("yaml")}
      />
      <Slot
        kind="zip"
        icon={<FileArchive size={16} />}
        label="Image bundle (.zip)"
        accept=".zip"
        slot={bundle}
        disabled={yaml.uploading}
        onSelect={(f) => handleSelect("zip", f)}
        onReset={() => handleReset("zip")}
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
  onReset: () => void;
  optional?: boolean;
  disabled?: boolean;
}) {
  const { icon, label, accept, slot, onSelect, onReset, optional } = props;
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
            disabled={props.disabled}
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
            <button type="button" className="link-button" disabled={props.disabled} onClick={onReset}>
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
