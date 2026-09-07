/**
 * NewRunV3 — the New-run form under the parameter contract.
 *
 * Every control is generated from `lib/paramSchema.json`, so the form cannot
 * disagree with what the pipeline runs, and a value's help text is written once.
 * Four categories are rendered differently: fields are editable, advanced lives
 * behind a JSON escape hatch, derived values are shown but never editable, and
 * refused values are rejected before submit.
 *
 * The right panel resolves the effective config live and marks where every value
 * came from — the answer to "no silent default", and the thing that would have
 * shown `optimizer: AdamW` before the Muon crash cost a Colab session.
 *
 * Decisions: .scratch/train-param-contract/map.md
 */
import { useMemo, useState } from "react";
import { supabase, type ModelLine } from "../lib/supabase";
import { useEffect } from "react";
import { Hint } from "./Hint";
import { DatasetUploader } from "./DatasetUploader";
import { ColabSteps } from "./ColabSteps";
import { useToast } from "./Toast";
import { parseYoloYaml } from "../lib/yaml";
import {
  loadProfiles, loadDataAssets, saveProfile, registerDataset, slugify,
  type RunProfile, type DataAsset,
} from "../lib/profiles";
import {
  SIZES, schema, paramsFor, capabilityFor, checkpointName, resolveEffective, validate,
  type Param, type Source,
} from "../lib/schema";
import { prefillFromConfig } from "../lib/prefill";

const SOURCE_LABEL: Record<Source, string> = {
  set: "you set it",
  default: "default — nobody typed this",
  derived: "derived",
};

function Field({ p, value, onChange }: { p: Param; value: string; onChange: (v: string) => void }) {
  const isDefault = value === String(p.default ?? "");
  return (
    <label className="pv3-field">
      <span className="pv3-label">
        {p.label} <Hint text={p.help} />
        {isDefault && <span className="pv3-tag default">default</span>}
      </span>
      {p.enum ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {p.enum.map((o) => (
            <option key={o} value={o}>
              {o}
              {p.discouraged?.includes(o) ? "  — not recommended" : ""}
            </option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={p.type === "text" ? "text" : "decimal"} />
      )}
    </label>
  );
}

/** A control the contract refuses. Shown, disabled, with the reason — never silently
 *  dropped: a compile knob that looks live and reaches no consumer is how four of
 *  these came to do nothing at all. */
function Refused({ p }: { p: Param }) {
  return (
    <label className="pv3-field">
      <span className="pv3-label">
        {p.label} <Hint text={p.help} />
        <span className="pv3-tag derived">refused</span>
      </span>
      <input value="not sent — no consumer" readOnly disabled className="pv3-ro" />
      <span className="pv3-hint">{p.help}</span>
    </label>
  );
}

function Derived({ p, value }: { p: Param; value: string }) {
  return (
    <label className="pv3-field">
      <span className="pv3-label">
        {p.label} <Hint text={p.help} />
        <span className="pv3-tag derived">derived</span>
      </span>
      <input value={value} readOnly disabled className="pv3-ro" />
      <span className="pv3-hint">from {p.derivedFrom}</span>
    </label>
  );
}

export function NewRunV3({
  onCreated,
  prefill,
}: {
  onCreated: (id: string) => void;
  /** A previous run's stored config, when the operator asked to re-create it. */
  prefill?: { runId: string; config: Record<string, unknown> } | null;
}) {
  const { push } = useToast();
  // Resolved once. Re-deriving on every render would fight the operator's own edits.
  const [seed] = useState(() => prefillFromConfig(prefill?.config));
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [slug] = useState("yolo11s-sack-hailo8l");

  const [family, setFamily] = useState(seed.family);
  const [task, setTask] = useState(seed.task);
  const [size, setSize] = useState(seed.size);
  const [runName, setRunName] = useState(seed.runName);

  const [datasetKey, setDatasetKey] = useState(seed.datasetKey);
  const [bundleKey, setBundleKey] = useState<string | null>(seed.bundleKey);
  const [classes, setClasses] = useState<string[]>(seed.classes);

  const [values, setValues] = useState<Record<string, string>>(() => seed.values);
  const [advanced, setAdvanced] = useState(seed.advanced);
  const [compile, setCompile] = useState(seed.compile);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tab, setTab] = useState<"summary" | "yaml">("summary");
  const [profiles, setProfiles] = useState<RunProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<RunProfile | null>(null);
  const [datasets, setDatasets] = useState<DataAsset[]>([]);
  const [uploadNew, setUploadNew] = useState(false);
  const [assetsReady, setAssetsReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ runId: string; colabUrl: string } | null>(null);

  useEffect(() => {
    supabase.from("model_lines").select("*").then(({ data }) => setModelLines((data ?? []) as ModelLine[]));
  }, []);

  const modelLineId = modelLines[0]?.id ?? null;
  useEffect(() => {
    if (!modelLineId) return;
    let live = true;
    Promise.all([loadProfiles(modelLineId, "train"), loadDataAssets(modelLineId, "dataset")]).then(
      ([ps, ds]) => {
        if (!live) return;
        setProfiles(ps.rows);
        setDatasets(ds.rows);
        // A missing table is not the same as an empty one.
        setAssetsReady(ps.ok && ds.ok);
      },
    );
    return () => { live = false; };
  }, [modelLineId]);

  function applyProfile(p: RunProfile) {
    setActiveProfile(p);
    setValues((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(p.values)) next[k] = v === null ? "none" : String(v);
      return next;
    });
  }

  async function saveAsProfile() {
    if (!modelLineId) return;
    const name = window.prompt("Name this profile", activeProfile?.display_name ?? "");
    if (!name) return;
    try {
      const version = await saveProfile({
        modelLineId, slug: slugify(name), displayName: name, form: "train",
        values: Object.fromEntries(paramsFor("train", "field").map((p) => [p.key, coerce(p, values[p.key])])),
      });
      push({ tone: "success", title: `Saved ${name} v${version}`, detail: "Editing a profile adds a version — earlier runs keep their meaning." });
      setProfiles((await loadProfiles(modelLineId, "train")).rows);
    } catch (e) {
      push({ tone: "danger", title: "Could not save profile", detail: (e as Error).message });
    }
  }

  const fam = schema.families[family];
  const capability = capabilityFor(family, task);
  const checkpoint = checkpointName(family, size, task);
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const derived: Record<string, string> = {
    classes: classes.join(", "),
    input_shape: `${values.imgsz} × ${values.imgsz} × 3`,
    regression_length: family === "yolo11" && task === "detect" ? "16" : "—",
    compiler_profile: capability.profile,
    compression_level: "0",
    dfc_wheel: `Dataflow Compiler ${schema.toolchain.dfc} (pinned)`,
  };

  const advancedIssue = useMemo(() => {
    try {
      const parsed = JSON.parse(advanced || "{}");
      const refused = paramsFor("train", "refused").map((p) => p.key);
      const hit = Object.keys(parsed).find((k) => refused.includes(k));
      return hit ? `${hit} is refused: ${paramsFor("train", "refused").find((p) => p.key === hit)!.help}` : null;
    } catch {
      return "Advanced parameters are not valid JSON.";
    }
  }, [advanced]);

  const issues = validate(values, capability);
  if (advancedIssue) issues.push({ key: "advanced", level: "blocking", message: advancedIssue });
  if (!datasetKey) issues.push({ key: "dataset", level: "blocking", message: "A dataset is required." });
  const blocking = issues.filter((i) => i.level === "blocking");
  const warnings = issues.filter((i) => i.level === "warning");

  const effective = [
    ...resolveEffective("train", values, derived),
    ...(compile ? resolveEffective("compile", values, derived) : []),
  ];

  const yaml = [
    "# effective config — resolved here; ultralytics fills the rest inside the run",
    `${"model:".padEnd(24)}${checkpoint}`,
    `${"task:".padEnd(24)}${task}`,
    `${"data:".padEnd(24)}${datasetKey || "—"}`,
    ...effective.map(
      (e) => `${(e.key + ":").padEnd(24)}${e.value.padEnd(22)}# ${SOURCE_LABEL[e.source]}`,
    ),
    `${"ultralytics:".padEnd(24)}${schema.toolchain.ultralytics.padEnd(22)}# pinned`,
  ].join("\n");

  async function submit() {
    if (blocking.length) return;
    setBusy(true);
    try {
      const config = {
        source_weights: checkpoint,
        dataset: datasetKey,
        classes,
        input_size: [Number(values.imgsz), Number(values.imgsz), 3],
        task: task === "detect" ? "detection" : task,
        // Required by RunConfig and by the version's compat signature — a config
        // without it fails to load before training starts.
        output_kind: task === "segment" ? "segmentation-masks" : "detection-boxes",
        hyperparameters: {
          ...Object.fromEntries(paramsFor("train", "field").map((p) => [p.key, coerce(p, values[p.key])])),
          ...JSON.parse(advanced || "{}"),
        },
        export_options: { hailo_target: "hailo8l" },
        ...(compile
          ? {
              compile_options: Object.fromEntries([
                ["compile_hef", true],
                ...paramsFor("compile", "field").map((p) => [p.key, coerce(p, values[p.key])]),
              ]),
            }
          : {}),
        ...(bundleKey ? { dataset_bundle: bundleKey } : {}),
        run_name: runName,
      };
      const { data, error } = await supabase.functions.invoke("start-training", {
        body: { model_line_slug: slug, config },
      });
      if (error) throw error;
      if (!data?.run_id) throw new Error("no run_id in response");
      push({ tone: "success", title: "Run created", detail: runName });
      setCreated({ runId: data.run_id, colabUrl: data.colab_url });
    } catch (e) {
      push({ tone: "danger", title: "Could not create run", detail: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (created)
    return (
      <div className="panel">
        <h2>Run created</h2>
        <ColabSteps colabUrl={created.colabUrl} runId={created.runId} />
        <button className="button" onClick={() => onCreated(created.runId)}>
          Watch it live
        </button>
      </div>
    );

  return (
    <div className="pv3">
      <div className="pv3-main">
        {prefill && (
          /* A pre-filled form that does not say so looks like a blank one that
             happens to disagree with the defaults. Say where the values came from,
             and say plainly what could not be brought across. */
          <div className="pv3-issue warning" role="status">
            <strong>Pre-filled from run {prefill.runId.slice(0, 8)}.</strong>{" "}
            Every value below came from that run unless noted. Edit anything before launching.
            {seed.notRestored.length > 0 && (
              <ul className="pv3-notrestored">
                {seed.notRestored.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 1 — model & dataset */}
        <section className="panel">
          <header className="pv3-sec">
            <span className="pv3-num">1</span>
            <div>
              <h2>Model &amp; dataset</h2>
              <p className="muted">Pick an official Ultralytics checkpoint, then bind it to a validated dataset.</p>
            </div>
            <a className="pv3-docs" href={fam.docs} target="_blank" rel="noopener">
              specs from the official docs ↗
            </a>
          </header>

          <div className="field-row">
            <label className="pv3-field">
              <span className="pv3-label">Run name</span>
              <input value={runName} onChange={(e) => setRunName(e.target.value)} />
            </label>
            <label className="pv3-field">
              <span className="pv3-label">Model line</span>
              <input value={modelLines[0]?.display_name ?? slug} readOnly disabled className="pv3-ro" />
            </label>
          </div>

          <div className="pv3-group">Model family</div>
          <div className="pv3-seg">
            {Object.entries(schema.families).map(([k, f]) => (
              <button key={k} className={k === family ? "on" : ""} onClick={() => {
                setFamily(k);
                if (!schema.families[k].tasks.includes(task)) setTask("detect");
              }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="pv3-group">Task</div>
          <div className="chip-list">
            {fam.tasks.map((t) => (
              <button key={t} className={`chip ${t === task ? "on" : ""}`} onClick={() => setTask(t)}>
                {schema.taskLabels[t]}
              </button>
            ))}
          </div>

          <div className="pv3-group">Model size</div>
          <div className="pv3-sizes">
            {SIZES.map((z) => {
              const m = fam.metrics[task]?.[z];
              return (
                <button key={z} className={`pv3-size ${z === size ? "on" : ""}`} onClick={() => setSize(z)}>
                  <b>{z.toUpperCase()}</b>
                  <span className="pv3-size-name">{schema.sizeLabels[z]}</span>
                  <span className="muted">
                    {m ? (
                      <>
                        {m.params} params
                        <br />
                        COCO mAP {m.map}
                        {m.e2e && <> · {m.e2e} e2e</>}
                        <br />
                        {m.flops} GFLOPs
                      </>
                    ) : (
                      "no published table"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pv3-ckpt">
            Selected checkpoint <code>{checkpoint}</code>
          </div>

          <div className={`pv3-compat ${capability.level}`}>
            <b>{capability.title}</b>
            <span>{capability.text}</span>
          </div>

          <div className="pv3-group">Dataset</div>
          {datasets.length > 0 && (
            <label className="pv3-field">
              <span className="pv3-label">
                Choose a dataset <Hint text="Datasets are uploaded once and reused. Picking one here binds this run to that exact upload, by key rather than by path." />
              </span>
              <select
                value={datasetKey}
                onChange={(e) => {
                  const d = datasets.find((x) => x.manifest_key === e.target.value);
                  setDatasetKey(e.target.value);
                  setBundleKey(d?.bundle_key ?? null);
                }}
              >
                <option value="">— pick a dataset —</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.manifest_key ?? ""}>
                    {d.display_name}
                    {d.stats.total ? `  ·  ${d.stats.total} images` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button className="pv3-disclose" onClick={() => setUploadNew((u) => !u)}>
            {uploadNew ? "▾" : "▸"} {datasets.length > 0 ? "Upload a new dataset instead" : "Upload a dataset"}
          </button>

          {(uploadNew || datasets.length === 0) && (
            <DatasetUploader
              modelLineSlug={slug}
              onChange={(s: { yamlKey: string | null; bundleKey: string | null; yamlText: string | null }) => {
                if (s.yamlKey) setDatasetKey(s.yamlKey);
                if (s.bundleKey !== null) setBundleKey(s.bundleKey);
                if (s.yamlText) {
                  try {
                    const parsed = parseYoloYaml(s.yamlText);
                    if (parsed.names.length) setClasses(parsed.names);
                  } catch { /* best effort */ }
                }
              }}
            />
          )}

          {uploadNew && datasetKey && modelLineId && (
            <button
              className="button"
              onClick={async () => {
                const name = window.prompt("Name this dataset so it can be reused", "");
                if (!name) return;
                try {
                  await registerDataset({
                    modelLineId, slug: slugify(name), displayName: name,
                    manifestKey: datasetKey, bundleKey,
                    stats: { classes: classes.length },
                  });
                  setDatasets((await loadDataAssets(modelLineId, "dataset")).rows);
                  setUploadNew(false);
                  push({ tone: "success", title: `Registered ${name}`, detail: "It can now be picked by any future run." });
                } catch (e) {
                  push({ tone: "danger", title: "Could not register dataset", detail: (e as Error).message });
                }
              }}
            >
              Save this upload for reuse
            </button>
          )}

          <Derived p={schema.params.find((p) => p.key === "classes")!} value={derived.classes} />
        </section>

        {/* 2 — training */}
        <section className="panel">
          <header className="pv3-sec">
            <span className="pv3-num">2</span>
            <div>
              <h2>Training</h2>
              <p className="muted">Every control, its default and its explanation come from the shared schema.</p>
            </div>
          </header>
          <div className="pv3-group">Profile</div>
          <div className="pv3-profiles">
            {profiles.map((p) => (
              <button
                key={p.id}
                className={`chip ${activeProfile?.id === p.id ? "on" : ""}`}
                title={p.description ?? undefined}
                onClick={() => applyProfile(p)}
              >
                {p.display_name}
                {p.version > 1 && <span className="pv3-ver"> v{p.version}</span>}
              </button>
            ))}
            <button className="chip ghost" onClick={saveAsProfile}>+ Save current as profile</button>
            {!assetsReady && (
              <span className="pv3-hint">
                Profiles and saved datasets need migration 08 — run <code>supabase db push</code>.
              </span>
            )}
          </div>

          <div className="pv3-grid">
            {paramsFor("train", "field").map((p) => (
              <Field key={p.key} p={p} value={values[p.key]} onChange={(v) => set(p.key, v)} />
            ))}
          </div>

          <button className="pv3-disclose" onClick={() => setShowAdvanced((s) => !s)}>
            {/* The browser has no ultralytics to validate against; it checks JSON validity
                and the contract's refused keys, and ultralytics itself rejects an unknown
                argument at train start. Say that, rather than promising a check nobody runs. */}
            {showAdvanced ? "▾" : "▸"} Advanced parameters — JSON, checked against the contract's refused keys here; names checked against the installed ultralytics when the run starts
          </button>
          {showAdvanced && (
            <>
              <textarea className="pv3-json" rows={5} value={advanced} onChange={(e) => setAdvanced(e.target.value)} />
              {advancedIssue && <div className="field-error">{advancedIssue}</div>}
            </>
          )}
        </section>

        {/* 3 — compile */}
        <section className="panel">
          <header className="pv3-sec">
            <span className="pv3-num">3</span>
            <div>
              <h2>Compile &amp; deploy</h2>
              <p className="muted">Tracked as its own downstream run, created only after training succeeds.</p>
            </div>
          </header>
          <label className="pv3-check">
            <input type="checkbox" checked={compile} onChange={(e) => setCompile(e.target.checked)} />
            <span>Compile automatically after training</span>
          </label>
          {compile && (
            <div className="pv3-grid">
              {paramsFor("compile", "field").map((p) => (
                <Field key={p.key} p={p} value={values[p.key]} onChange={(v) => set(p.key, v)} />
              ))}
              {paramsFor("compile", "derived").map((p) => (
                <Derived key={p.key} p={p} value={derived[p.key] ?? "—"} />
              ))}
              {paramsFor("compile", "refused").map((p) => (
                <Refused key={p.key} p={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* right — the truth */}
      <aside className="pv3-aside">
        <div className="panel">
          <h2>Run summary</h2>
          <p className="muted">Resolved live from the form.</p>
          <dl className="pv3-sum">
            <dt>Run</dt><dd>{runName}</dd>
            <dt>Model</dt><dd>{fam.label} · {schema.taskLabels[task]}</dd>
            <dt>Checkpoint</dt><dd><code>{checkpoint}</code></dd>
            <dt>Dataset</dt><dd>{datasetKey || <span className="muted">not chosen</span>}</dd>
            <dt>Classes</dt><dd>{derived.classes}</dd>
            <dt>Compile</dt><dd>{compile ? "Hailo-8L · enabled" : "disabled"}</dd>
          </dl>
          <div className={`pv3-status ${capability.level}`}>{capability.status}</div>
        </div>

        <div className="panel pv3-cfg">
          <div className="pv3-tabs">
            <button className={tab === "summary" ? "on" : ""} onClick={() => setTab("summary")}>Summary</button>
            <button className={tab === "yaml" ? "on" : ""} onClick={() => setTab("yaml")}>YAML</button>
          </div>
          <div className="pv3-legend">
            <span><i className="pv3-dot set" />you set it</span>
            <span><i className="pv3-dot default" />filled from default</span>
            <span><i className="pv3-dot derived" />derived</span>
          </div>

          {blocking.map((i) => (
            <div key={i.key + i.message} className="pv3-issue blocking">⛔ {i.message}</div>
          ))}
          {warnings.map((i) => (
            <div key={i.key + i.message} className="pv3-issue warning">⚠ {i.message}</div>
          ))}

          {tab === "summary" ? (
            <dl className="pv3-sum">
              {effective.map((e) => (
                <div key={e.key} className="pv3-row">
                  <dt><i className={`pv3-dot ${e.source}`} />{e.key}</dt>
                  <dd>{e.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <pre className="pv3-yaml">{yaml}</pre>
          )}

          <button className="button primary" disabled={!!blocking.length || busy} onClick={submit}>
            {blocking.length ? `Fix ${blocking.length} blocking issue${blocking.length > 1 ? "s" : ""}` : busy ? "Creating…" : "Create run & open Colab"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function coerce(p: Param, v: string): unknown {
  if (v === undefined) return p.default;
  if (p.type === "int") return Number.parseInt(v, 10);
  if (p.type === "float") return Number.parseFloat(v);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "none") return null;
  return v;
}
