import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { supabase, type ModelLine } from "../lib/supabase";
import { parseYoloYaml } from "../lib/yaml";
import { Hint } from "./Hint";
import { ColabSteps } from "./ColabSteps";
import { DatasetUploader } from "./DatasetUploader";
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

export function NewRun({
  onCreated,
  initialConfig,
}: {
  onCreated: (id: string) => void;
  initialConfig?: Record<string, unknown> | null;
}) {
  const ic = (initialConfig ?? {}) as Record<string, any>;
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [slug, setSlug] = useState("yolo11s-sack-hailo8l");
  const [datasetKey, setDatasetKey] = useState<string>(ic.dataset ?? "");
  const [bundleKey, setBundleKey] = useState<string | null>(ic.dataset_bundle ?? null);
  const [classes, setClasses] = useState<string[]>(ic.classes ?? ["sack"]);
  const [classText, setClassText] = useState<string>((ic.classes ?? ["sack"]).join(", "));
  const [sourceWeights, setSourceWeights] = useState<string>(ic.source_weights ?? "yolo11s.pt");
  const [imgsz, setImgsz] = useState<number>(
    Array.isArray(ic.input_size) && typeof ic.input_size[0] === "number" ? ic.input_size[0] : 640,
  );
  const [hp, setHp] = useState<Hyperparams>(
    ic.hyperparameters ? { ...DEFAULT_HP, ...(ic.hyperparameters as Hyperparams) } : DEFAULT_HP,
  );
  const [hailoTarget, setHailoTarget] = useState<string>(
    ic.export_options?.hailo_target ?? "hailo8l",
  );
  // HEF compile (step 6b): compile an INT8 .hef in the same Colab run.
  const [compileHef, setCompileHef] = useState<boolean>(ic.compile_options?.compile_hef ?? false);
  const [optLevel, setOptLevel] = useState<number>(ic.compile_options?.opt_level ?? 0);
  const [calibN, setCalibN] = useState<number>(ic.compile_options?.calib_n ?? 512);
  const [wheelKey, setWheelKey] = useState<string>(
    ic.compile_options?.wheel_key ??
      "tools/hailo/hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl",
  );
  const [note, setNote] = useState<string>(ic.note ?? "");
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

  function onUploaderChange(state: { yamlKey: string | null; bundleKey: string | null; yamlText: string | null }) {
    if (state.yamlKey) {
      setDatasetKey(state.yamlKey);
      clearError("dataset");
    }
    if (state.bundleKey !== null) setBundleKey(state.bundleKey);
    if (state.yamlText) {
      try {
        const parsed = parseYoloYaml(state.yamlText);
        if (parsed.names.length > 0) {
          setClasses(parsed.names);
          setClassText(parsed.names.join(", "));
          clearError("classes");
        }
        setYamlParsed({
          filename: state.yamlKey?.split("/").pop() ?? "dataset.yaml",
          train: parsed.train,
          val: parsed.val,
        });
      } catch {
        // ignore — parsing is best-effort
      }
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
        ...(compileHef
          ? {
              compile_options: {
                compile_hef: true,
                opt_level: optLevel,
                calib_n: calibN,
                wheel_key: wheelKey,
              },
            }
          : {}),
        ...(bundleKey ? { dataset_bundle: bundleKey } : {}),
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
            Watch live metrics
            <ChevronRight size={14} strokeWidth={2.5} />
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

        <div>
          <label>
            Dataset
            <Hint text="Upload the YOLO dataset YAML (required) and an optional image bundle ZIP. Both go to R2 via the upload-dataset edge function — you'll get an R2 key auto-filled below. The YAML is also parsed locally to auto-populate the class list." />
          </label>
          <DatasetUploader modelLineSlug={slug} onChange={onUploaderChange} />
          {datasetKey && (
            <span className="parsed-info">
              YAML key: <code>{datasetKey}</code>
              {bundleKey && <> · ZIP key: <code>{bundleKey}</code></>}
            </span>
          )}
          {yamlParsed && (
            <span className="parsed-info">
              Parsed
              {yamlParsed.train && <> · train=<code>{yamlParsed.train}</code></>}
              {yamlParsed.val && <> · val=<code>{yamlParsed.val}</code></>}
            </span>
          )}
          {errors.dataset && <span className="field-error">{errors.dataset}</span>}
        </div>

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

        <div className="field-block">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={compileHef}
              onChange={(e) => setCompileHef(e.target.checked)}
            />
            <span>Compile HEF after training</span>
            <Hint text="When on, the same Colab run compiles an INT8 .hef for the Hailo target right after ONNX export (step 6b), so one run emits .pt + .onnx + .hef. Calibration images are sampled from the uploaded dataset. The compile is failure-safe — if it fails, .pt/.onnx are still published." />
          </label>
          {compileHef && (
            <div className="field-row">
              <label>
                Quant level
                <Hint text="0 = fast / basic quant (proven, dodges the DFC Layer-Noise-Analysis bug) — good for a pipeline/version proof. 2 = production quant (Simple LAT + bias correction), needs calib ≥ 1024 images." />
                <select value={optLevel} onChange={(e) => setOptLevel(Number(e.target.value))}>
                  <option value={0}>0 — fast / basic (proof)</option>
                  <option value={2}>2 — production (calib ≥ 1024)</option>
                </select>
              </label>
              <label>
                Calib images
                <Hint text="How many images to sample from the dataset for INT8 calibration. 256–512 for a proof; ≥1024 for production quant (opt_level 2)." />
                <input
                  type="number"
                  min="256"
                  step="64"
                  value={calibN}
                  onChange={(e) => setCalibN(Number(e.target.value))}
                />
              </label>
              <label>
                DFC wheel (R2)
                <Hint text="R2 key of the staged Hailo Dataflow Compiler wheel under the private tools/ prefix. The gated vendor wheel must be uploaded once before the first compile run." />
                <input
                  type="text"
                  value={wheelKey}
                  onChange={(e) => setWheelKey(e.target.value)}
                  placeholder="tools/hailo/hailo_dataflow_compiler-3.33.1-...whl"
                />
              </label>
            </div>
          )}
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
