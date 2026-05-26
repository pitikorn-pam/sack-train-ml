import { useEffect, useState } from "react";
import { supabase, type ModelLine } from "../lib/supabase";
import { parseYoloYaml } from "../lib/yaml";
import { Hint } from "./Hint";
import { ColabSteps } from "./ColabSteps";
import { useToast } from "./Toast";

interface Hyperparams {
  epochs: number;
  imgsz: number;
  batch: string;
  patience: number;
  lr0: number;
}

const SOURCE_WEIGHTS = [
  { value: "yolo11n.pt", label: "YOLO 11n", suffix: "fastest, smallest" },
  { value: "yolo11s.pt", label: "YOLO 11s", suffix: "balanced (default)" },
  { value: "yolo11m.pt", label: "YOLO 11m", suffix: "more capacity" },
  { value: "yolo11l.pt", label: "YOLO 11l", suffix: "large" },
  { value: "yolo11x.pt", label: "YOLO 11x", suffix: "maximum capacity" },
];

const DEFAULT_HP: Hyperparams = {
  epochs: 100,
  imgsz: 640,
  batch: "auto",
  patience: 20,
  lr0: 0.001,
};

interface FieldErrors {
  modelLine?: string;
  dataset?: string;
  classes?: string;
  source_weights?: string;
}

interface CreatedRun {
  runId: string;
  colabUrl: string;
}

export function NewRun({ onCreated }: { onCreated: (id: string) => void }) {
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [slug, setSlug] = useState("yolo11s-sack-hailo8l");
  const [datasetKey, setDatasetKey] = useState("");
  const [classes, setClasses] = useState<string[]>(["sack"]);
  const [classText, setClassText] = useState("sack");
  const [sourceWeights, setSourceWeights] = useState("yolo11s.pt");
  const [imgsz, setImgsz] = useState(640);
  const [hp, setHp] = useState<Hyperparams>(DEFAULT_HP);
  const [hailoTarget, setHailoTarget] = useState("hailo8l");
  const [note, setNote] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [yamlParsed, setYamlParsed] = useState<{ filename: string; train?: string; val?: string } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedRun | null>(null);
  const { push } = useToast();

  useEffect(() => {
    supabase.from("model_lines").select("*").then(({ data }) => {
      setModelLines((data ?? []) as ModelLine[]);
    });
  }, []);

  function clearError(field: keyof FieldErrors) {
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onYamlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const parsed = parseYoloYaml(text);
      if (parsed.names.length > 0) {
        setClasses(parsed.names);
        setClassText(parsed.names.join(", "));
      }
      setYamlParsed({ filename: f.name, train: parsed.train, val: parsed.val });
      clearError("dataset");
      clearError("classes");
    } catch (err) {
      setErrors((p) => ({ ...p, dataset: `Failed to parse YAML: ${err}` }));
    }
  }

  function onClassTextChange(v: string) {
    setClassText(v);
    setClasses(
      v
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!slug) next.modelLine = "Model line is required.";
    if (!datasetKey) next.dataset = "Dataset key (R2 path) is required.";
    if (classes.length === 0) next.classes = "At least one class is required.";
    if (!sourceWeights) next.source_weights = "Source weights are required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      push({ tone: "danger", title: "Fix form errors", detail: "See highlighted fields." });
      return;
    }
    setLoading(true);
    try {
      const config = {
        source_weights: sourceWeights,
        dataset: datasetKey,
        classes,
        input_size: [imgsz, imgsz, 3],
        task: "detection",
        output_kind: "detection-boxes",
        hyperparameters: { ...hp, imgsz },
        export_options: { hailo_target: hailoTarget },
        ...(note ? { note } : {}),
      };
      const { data, error } = await supabase.functions.invoke("start-training", {
        body: { model_line_slug: slug, config },
      });
      if (error) throw error;
      if (!data?.run_id) throw new Error("no run_id in response");

      push({ tone: "success", title: "Training created", detail: `${data.run_id.slice(0, 8)} pending Colab launch` });
      setCreated({ runId: data.run_id, colabUrl: data.colab_url });
    } catch (err) {
      push({ tone: "danger", title: "Could not create run", detail: String(err) });
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="panel">
        <h2>Run created</h2>
        <ColabSteps runId={created.runId} colabUrl={created.colabUrl} />
        <div className="created-actions">
          <button onClick={() => onCreated(created.runId)} className="button primary">
            Watch live metrics →
          </button>
          <button onClick={() => setCreated(null)} className="button">
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>New training run</h2>
      <p className="muted">
        Create the run here, then let Colab do the GPU work. Keep this tab open so the dashboard can
        stream metrics back in real time.
      </p>

      <form onSubmit={submit} className="stack">
        <label>
          Model line
          <Hint text="Which model family this run trains. Each model line has its own class set + target hardware + artifact contract." />
          <select value={slug} onChange={(e) => { setSlug(e.target.value); clearError("modelLine"); }}>
            {modelLines.map((l) => (
              <option key={l.id} value={l.slug}>{l.display_name} ({l.slug})</option>
            ))}
          </select>
          {errors.modelLine && <span className="field-error">{errors.modelLine}</span>}
        </label>

        <label>
          Dataset (R2 key)
          <Hint text="R2 path to the dataset YAML, e.g. datasets/yolo11s-sack-hailo8l/2026-05-26T10-30-00/dataset.yaml. Upload the YAML separately via the upload-dataset edge function to get a key." />
          <input
            type="text"
            value={datasetKey}
            onChange={(e) => { setDatasetKey(e.target.value); clearError("dataset"); }}
            placeholder="datasets/yolo11s-sack-hailo8l/<stamp>/dataset.yaml"
          />
          {errors.dataset && <span className="field-error">{errors.dataset}</span>}
        </label>

        <label>
          Parse YAML to auto-fill classes
          <Hint text="Optional. Pick a local YOLO dataset YAML file — we'll extract the class list and dataset splits without uploading it." />
          <input type="file" accept=".yaml,.yml" onChange={onYamlFile} />
          {yamlParsed && (
            <span className="parsed-info">
              Parsed <code>{yamlParsed.filename}</code>
              {yamlParsed.train && <> · train=<code>{yamlParsed.train}</code></>}
              {yamlParsed.val && <> · val=<code>{yamlParsed.val}</code></>}
            </span>
          )}
        </label>

        <label>
          Classes
          <Hint text="Ordered class names matching the dataset's label indices. Auto-populated when you parse a YAML; comma-separated." />
          <input
            type="text"
            value={classText}
            onChange={(e) => { onClassTextChange(e.target.value); clearError("classes"); }}
            placeholder="sack, person, debris"
          />
          {classes.length > 0 && (
            <div className="chip-list">
              {classes.map((c, i) => (
                <span key={c + i} className="chip">{i}: {c}</span>
              ))}
            </div>
          )}
          {errors.classes && <span className="field-error">{errors.classes}</span>}
        </label>

        <label>
          Source weights
          <Hint text="Pretrained YOLO checkpoint to fine-tune. Larger variants improve capacity but increase training and HEF compile cost." />
          <select value={sourceWeights} onChange={(e) => { setSourceWeights(e.target.value); clearError("source_weights"); }}>
            {SOURCE_WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>{w.label} — {w.suffix}</option>
            ))}
          </select>
          {errors.source_weights && <span className="field-error">{errors.source_weights}</span>}
        </label>

        <div className="field-row">
          <label>
            Epochs
            <Hint text="100 is a sane default for fine-tuning from a pretrained checkpoint. More epochs = more learning but risk of overfitting." />
            <input type="number" min="1" value={hp.epochs} onChange={(e) => setHp({ ...hp, epochs: Number(e.target.value) })} />
          </label>
          <label>
            Image size
            <Hint text="640 is the YOLO default. Larger = better small-object recall but slower training and inference." />
            <input type="number" min="32" step="32" value={imgsz} onChange={(e) => setImgsz(Number(e.target.value))} />
          </label>
          <label>
            Hailo target
            <Hint text="The target SoC for HEF compile. Phase 1 is hailo8l (Raspberry Pi 5 + Hailo-8L)." />
            <select value={hailoTarget} onChange={(e) => setHailoTarget(e.target.value)}>
              <option value="hailo8l">hailo8l</option>
              <option value="hailo8">hailo8</option>
              <option value="hailo15">hailo15</option>
            </select>
          </label>
        </div>

        <details open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
          <summary><strong>Advanced hyperparameters</strong></summary>
          <div className="field-row">
            <label>
              Patience
              <Hint text="Epochs without improvement before early-stopping. Lower = faster but may stop too soon." />
              <input type="number" min="0" value={hp.patience} onChange={(e) => setHp({ ...hp, patience: Number(e.target.value) })} />
            </label>
            <label>
              LR0
              <Hint text="Initial learning rate. 0.001 is a good fine-tuning default; raise only if loss plateaus." />
              <input type="number" step="0.0001" value={hp.lr0} onChange={(e) => setHp({ ...hp, lr0: Number(e.target.value) })} />
            </label>
            <label>
              Batch
              <Hint text="'auto' lets ultralytics pick. Manual int for fixed batch size — limited by GPU VRAM." />
              <input type="text" value={hp.batch} onChange={(e) => setHp({ ...hp, batch: e.target.value })} />
            </label>
          </div>
        </details>

        <label>
          Note (optional)
          <Hint text="Free-form annotation about this run. Useful for tracking dataset changes / experiments." />
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Expanded dataset with 200 night-shift samples…"
          />
        </label>

        <button type="submit" disabled={loading} className="button primary">
          {loading ? "Creating run…" : "Create training run"}
        </button>
      </form>
    </div>
  );
}
