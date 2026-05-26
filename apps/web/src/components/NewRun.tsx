import { useState } from "react";
import { supabase } from "../lib/supabase";

const DEFAULT_CONFIG = {
  source_weights: "yolo11s.pt",
  dataset: "datasets/yolo11s-sack-hailo8l/<stamp>/dataset.yaml",
  classes: ["sack"],
  input_size: [640, 640, 3],
  task: "detection",
  output_kind: "detection-boxes",
  hyperparameters: { epochs: 100, imgsz: 640, batch: "auto", patience: 20, lr0: 0.001 },
  export_options: { hailo_target: "hailo8l" },
};

export function NewRun({ onCreated }: { onCreated: (id: string) => void }) {
  const [slug, setSlug] = useState("yolo11s-sack-hailo8l");
  const [configText, setConfigText] = useState(JSON.stringify(DEFAULT_CONFIG, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const config = JSON.parse(configText);
      const { data, error } = await supabase.functions.invoke("start-training", {
        body: { model_line_slug: slug, config },
      });
      if (error) throw error;
      if (!data?.run_id) throw new Error("no run_id in response");
      if (data.colab_url) {
        window.open(data.colab_url, "_blank", "noopener");
      }
      onCreated(data.run_id);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>New run</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Model line slug
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label>
          Config (JSON)
          <textarea
            rows={14}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create run + open Colab"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
