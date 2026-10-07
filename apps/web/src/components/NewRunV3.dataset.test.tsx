// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewRunV3 } from './NewRunV3';
const { invoke, loadDataAssets } = vi.hoisted(() => ({ invoke: vi.fn(), loadDataAssets: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => Promise.resolve({ data: [{ id: 'line' }] }) }), functions: { invoke },
} }));
vi.mock('./Toast', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../lib/profiles', () => ({ loadProfiles: async () => ({ ok: true, rows: [] }), loadDataAssets, slugify: (x: string) => x, registerDataset: vi.fn(), saveProfile: vi.fn() }));
const source = { kind: 'roboflow', workspace: 'workspace', project: 'sack', version: 2, format: 'yolov11' };
const snippet = 'rf = Roboflow(api_key="sentinel-secret")\nproject = rf.workspace("workspace").project("sack")\nversion = project.version(2)\ndataset = version.download("yolov11")';
beforeEach(() => {
  loadDataAssets.mockResolvedValue({ ok: true, rows: [] });
  invoke.mockResolvedValue({ data: { run_id: 'mock-run', colab_url: 'https://colab.example/mock' }, error: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('submits only reference, defers classes and clears stale YAML/bundle from a manual clone', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<NewRunV3 onCreated={vi.fn()} prefill={{ runId: 'manual', config: { dataset: 'old.yaml', dataset_bundle: 'old.zip', classes: ['old'] } }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Paste Roboflow code' }));
  fireEvent.change(screen.getByLabelText('Roboflow Python download code'), { target: { value: snippet } });
  fireEvent.click(screen.getByRole('button', { name: 'Use Roboflow reference' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create run & open Colab' }));
  await screen.findByRole('heading', { name: 'Run created' });
  const [name, args] = invoke.mock.calls[0];
  expect(name).toBe('start-training');
  expect(args.body.config.dataset_source).toEqual(source);
  for (const key of ['dataset', 'dataset_bundle', 'classes']) expect(args.body.config).not.toHaveProperty(key);
  expect(JSON.stringify(args)).not.toMatch(/sentinel-secret|api_key|snippet|old\.yaml|old\.zip/);
  expect(fetch).not.toHaveBeenCalled();
});
it('clones a Roboflow run without carrying resolved classes into a new request', async () => {
  render(<NewRunV3 onCreated={vi.fn()} prefill={{ runId: 'rf-old', config: { dataset_source: source, classes: ['resolved-old'] } }} />);
  expect(screen.getByText('Roboflow workspace/sack v2 (yolov11)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create run & open Colab' }));
  await screen.findByRole('heading', { name: 'Run created' });
  expect(invoke.mock.calls[0][1].body.config.dataset_source).toEqual(source);
  expect(invoke.mock.calls[0][1].body.config).not.toHaveProperty('classes');
});
const savedAssets = { ok: true, rows: [{ id: 'ds', display_name: 'Saved sacks', manifest_key: 'datasets/saved/data.yaml', bundle_key: 'datasets/saved/images.zip', stats: {} }] };
it.each(['accepted', 'editing'])('preserves the %s Roboflow editor and source-only config across deferred saved assets', async (stage) => {
  let release!: (value: typeof savedAssets) => void;
  loadDataAssets.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<NewRunV3 onCreated={vi.fn()} />);
  await waitFor(() => expect(loadDataAssets).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Paste Roboflow code' }));
  const editor = screen.getByLabelText('Roboflow Python download code');
  fireEvent.change(editor, { target: { value: snippet } });
  if (stage === 'accepted') fireEvent.click(screen.getByRole('button', { name: 'Use Roboflow reference' }));
  await act(async () => { release(savedAssets); });
  expect(screen.getByLabelText(/Choose a dataset/)).toBeTruthy();
  expect(screen.getByLabelText('Roboflow Python download code')).toBe(editor);
  expect((editor as HTMLTextAreaElement).value).toBe(stage === 'accepted' ? '' : snippet);
  if (stage === 'editing') fireEvent.click(screen.getByRole('button', { name: 'Use Roboflow reference' }));
  expect(screen.getByText('Roboflow workspace/sack v2 (yolov11)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create run & open Colab' }));
  await screen.findByRole('heading', { name: 'Run created' });
  const cfg = invoke.mock.calls.find(c => c[0] === 'start-training')?.[1].body.config;
  expect(cfg.dataset_source).toEqual(source);
  for (const key of ['dataset', 'dataset_bundle', 'classes']) expect(cfg).not.toHaveProperty(key);
  expect(JSON.stringify(cfg)).not.toMatch(/sentinel-secret|api_key|snippet/);
  expect(invoke.mock.calls.map(c => c[0])).toEqual(['start-training']);
  expect(fetch).not.toHaveBeenCalled();
});
it('does not open the new-dataset panel just because deferred saved assets arrive', async () => {
  let release!: (value: typeof savedAssets) => void;
  loadDataAssets.mockReturnValue(new Promise(resolve => { release = resolve; }));
  render(<NewRunV3 onCreated={vi.fn()} />);
  await waitFor(() => expect(loadDataAssets).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: 'Upload files' })).toBeTruthy();
  await act(async () => { release(savedAssets); });
  expect(screen.getByLabelText(/Choose a dataset/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Upload files' })).toBeNull();
});
it('preserves a manual upload and its YAML classes across deferred saved assets', async () => {
  let release!: (value: typeof savedAssets) => void;
  loadDataAssets.mockReturnValue(new Promise(resolve => { release = resolve; }));
  invoke.mockImplementation(async (name: string) => ({ data: name === 'upload-dataset'
    ? { upload_url: 'https://mock.invalid/upload', r2_key: 'datasets/manual/data.yaml' }
    : { run_id: 'mock-run', colab_url: 'https://colab.example/mock' }, error: null }));
  const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', fetch);
  const { container } = render(<NewRunV3 onCreated={vi.fn()} />);
  await waitFor(() => expect(loadDataAssets).toHaveBeenCalled());
  const file = new File(['names: [person, sack]'], 'data.yaml', { type: 'application/x-yaml' });
  Object.defineProperty(file, 'text', { value: async () => 'names: [person, sack]' });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await screen.findByText('uploaded');
  await act(async () => { release(savedAssets); });
  expect(screen.getByText('data.yaml')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Upload files' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Create run & open Colab' }));
  await screen.findByRole('heading', { name: 'Run created' });
  const cfg = invoke.mock.calls.find(c => c[0] === 'start-training')?.[1].body.config;
  expect(cfg.dataset).toBe('datasets/manual/data.yaml');
  expect(cfg.classes).toEqual(['person', 'sack']);
  expect(cfg).not.toHaveProperty('dataset_source');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1].method).toBe('PUT');
});
it('selects a saved manual dataset after Roboflow with YAML-derived classes and no stale reference', async () => {
  loadDataAssets.mockResolvedValue({ ok: true, rows: [{ id: 'ds', display_name: 'Saved sacks', manifest_key: 'datasets/saved/data.yaml', bundle_key: 'datasets/saved/images.zip', stats: {} }] });
  invoke.mockImplementation(async (name: string) => ({ data: name === 'download-dataset' ? { download_url: 'https://storage.example/data.yaml' } : { run_id: 'mock-run', colab_url: 'https://colab.example/mock' }, error: null }));
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'names: [person, sack]' }); vi.stubGlobal('fetch', fetch);
  render(<NewRunV3 onCreated={vi.fn()} prefill={{ runId: 'rf-old', config: { dataset_source: source } }} />);
  const chooser = await screen.findByLabelText(/Choose a dataset/);
  fireEvent.change(chooser, { target: { value: 'datasets/saved/data.yaml' } });
  await waitFor(() => expect((chooser as HTMLSelectElement).value).toBe('datasets/saved/data.yaml'));
  fireEvent.click(screen.getByRole('button', { name: 'Create run & open Colab' }));
  await screen.findByRole('heading', { name: 'Run created' });
  const cfg = invoke.mock.calls.find(c => c[0] === 'start-training')?.[1].body.config;
  expect(cfg.dataset).toBe('datasets/saved/data.yaml'); expect(cfg.dataset_bundle).toBe('datasets/saved/images.zip'); expect(cfg.classes).toEqual(['person', 'sack']); expect(cfg).not.toHaveProperty('dataset_source');
  expect(invoke.mock.calls.some(c => c[0] === 'upload-dataset')).toBe(false);
  expect(fetch.mock.calls.every(c => c[1]?.method !== 'PUT')).toBe(true);
});
