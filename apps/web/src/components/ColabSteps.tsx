/**
 * ColabSteps — post-create disclosure showing the 6-step Colab checklist.
 * Includes a copyable run ID card.
 */
import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";

interface Props {
  runId: string;
  colabUrl: string;
}

const STEPS = [
  {
    title: "Open the notebook",
    body: "Click \"Open in Colab\". The URL already includes ?run_id=… so the notebook picks it up.",
  },
  {
    title: "Run all cells",
    body: "Runtime → Run all (Cmd/Ctrl+F9). Colab does not auto-run notebooks when opened from a button.",
  },
  {
    title: "Paste secrets",
    body: "When prompted, paste your SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TRAINING_CALLBACK_SECRET.",
  },
  {
    title: "Confirm dataset",
    body: "The notebook auto-downloads the dataset YAML from R2. If you uploaded an image ZIP, it unzips it too.",
  },
  {
    title: "Watch metrics stream here",
    body: "Once training starts, this dashboard streams every epoch's metrics live. No need to refresh Colab.",
  },
  {
    title: "Pickup the release bundle",
    body: "On success, a new version row appears under Models. Artifacts (.pt, .onnx, .hef) are on R2.",
  },
];

export function ColabSteps({ runId, colabUrl }: Props) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(runId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <div className="colab-steps">
      <div className="colab-actions">
        <a href={colabUrl} target="_blank" rel="noopener" className="button primary">
          <ExternalLink size={14} strokeWidth={2.5} />
          Open in Colab
        </a>
        <div className="run-id-card">
          <span className="muted">Run ID</span>
          <code>{runId}</code>
          <button onClick={copyId} className="link-button" type="button" aria-label="Copy run id">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <details open>
        <summary><strong>How to run in Colab (6 steps)</strong></summary>
        <ol className="step-list">
          {STEPS.map((s, i) => (
            <li key={i}>
              <strong>{i + 1}. {s.title}</strong>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </details>

      <p className="info-note">
        Waiting for Colab to start streaming. If you haven't clicked <em>Runtime → Run all</em> yet,
        this run stays at the bootstrap step.
      </p>
    </div>
  );
}
