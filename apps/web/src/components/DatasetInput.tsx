import { useState } from 'react';
import { Check, Code, Upload } from 'lucide-react';
import { DatasetUploader } from './DatasetUploader';
import { type DatasetSelection } from '../lib/datasetUpload';
import { parseRoboflowSnippet, type RoboflowSource } from '@contracts/dataset-source';

export type DatasetInputSelection =
  | ({ kind: 'files' } & DatasetSelection)
  | { kind: 'roboflow'; source: RoboflowSource | null };
interface Props {
  modelLineSlug: string;
  initialSource?: RoboflowSource | null;
  onChange: (selection: DatasetInputSelection) => void;
  onBusyChange: (busy: boolean) => void;
}
export function DatasetInput({ initialSource, ...props }: Props) {
  const [mode, setMode] = useState<'files' | 'roboflow'>(initialSource ? 'roboflow' : 'files');
  const [busy, setBusy] = useState(false);
  const [snippet, setSnippet] = useState('');
  const [source, setSource] = useState<RoboflowSource | null>(initialSource ?? null);
  const [error, setError] = useState('');
  function clear() { setSnippet(''); setSource(null); setError(''); }
  function choose(value: typeof mode) {
    if (busy || value === mode) return;
    clear(); setMode(value);
    props.onChange(value === 'files' ? { kind: 'files', yamlKey: null, bundleKey: null, yamlText: null } : { kind: 'roboflow', source: null });
  }
  function parse() {
    try {
      const selected = parseRoboflowSnippet(snippet);
      setSource(selected); setError(''); props.onChange({ kind: 'roboflow', source: selected });
    } catch {
      setSource(null); setError('Could not read this snippet. Use the standard Roboflow Python download code.');
      props.onChange({ kind: 'roboflow', source: null });
    } finally { setSnippet(''); }
  }
  return <div className="dataset-input">
    <div className="dataset-source" role="group" aria-label="Dataset source">
      <button type="button" className={`chip ${mode === 'files' ? 'on' : ''}`} aria-pressed={mode === 'files'} disabled={busy} onClick={() => choose('files')}><Upload size={14} /> Upload files</button>
      <button type="button" className={`chip ${mode === 'roboflow' ? 'on' : ''}`} aria-pressed={mode === 'roboflow'} disabled={busy} onClick={() => choose('roboflow')}><Code size={14} /> Paste Roboflow code</button>
    </div>
    {mode === 'files' ? <DatasetUploader modelLineSlug={props.modelLineSlug} onChange={s => props.onChange({ kind: 'files', ...s })} onBusyChange={v => { setBusy(v); props.onBusyChange(v); }} /> : <div className="roboflow-import">
      <label className="pv3-field" htmlFor="roboflow-snippet">
        <span className="pv3-label" id="roboflow-snippet-label">Roboflow Python download code</span>
        <span className="muted">Choose Download Dataset → YOLOv8 or YOLOv11 → Show download code.</span>
        <textarea id="roboflow-snippet" aria-labelledby="roboflow-snippet-label" rows={7} value={snippet} autoComplete="off" spellCheck={false} onChange={e => { setSnippet(e.target.value); setSource(null); setError(''); props.onChange({ kind: 'roboflow', source: null }); }} />
      </label>
      <p className="pv3-hint">Code is read locally, never executed. Its API key is discarded. Colab downloads directly from Roboflow using Colab Secrets ROBOFLOW_API_KEY or hidden input. Classes are read from the downloaded YAML on Colab.</p>
      <button type="button" className="button" disabled={!snippet.trim()} onClick={parse}>Use Roboflow reference</button>
      <button type="button" className="link-button" onClick={() => { clear(); props.onChange({ kind: 'roboflow', source: null }); }}>Cancel</button>
      <div aria-live="polite">
        {source && <p className="uploader-status ok"><Check size={14} /> {source.workspace}/{source.project} v{source.version} ({source.format}) · Classes resolved on Colab</p>}
        {error && <p className="uploader-status err" role="alert">{error}</p>}
      </div>
    </div>}
  </div>;
}
