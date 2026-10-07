// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DatasetInput } from './DatasetInput';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
const snippet = 'from roboflow import Roboflow\nrf = Roboflow(api_key="sentinel-secret")\nproject = rf.workspace("workspace").project("sack")\nversion = project.version(2)\ndataset = version.download("yolov11")';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('selects only a reference locally, discards credentials and never requests dataset bytes', () => {
  const fetch = vi.fn().mockRejectedValue(new Error('network prohibited'));
  vi.stubGlobal('fetch', fetch);
  const onChange = vi.fn();
  render(<DatasetInput modelLineSlug="sack" onChange={onChange} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Paste Roboflow code' }));
  fireEvent.change(screen.getByLabelText('Roboflow Python download code'), { target: { value: snippet } });
  fireEvent.click(screen.getByRole('button', { name: /Import dataset|Use Roboflow reference/ }));
  expect(fetch).not.toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'roboflow', source: { kind: 'roboflow', workspace: 'workspace', project: 'sack', version: 2, format: 'yolov11' } });
  expect((screen.getByLabelText('Roboflow Python download code') as HTMLTextAreaElement).value).toBe('');
});
it('clears selection and snippet on mode switches, invalid code and cancellation', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const onChange = vi.fn();
  render(<DatasetInput modelLineSlug="sack" onChange={onChange} onBusyChange={vi.fn()} />);
  const paste = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Paste Roboflow code' }));
    fireEvent.change(screen.getByLabelText('Roboflow Python download code'), { target: { value: snippet } });
    fireEvent.click(screen.getByRole('button', { name: 'Use Roboflow reference' }));
  };
  paste();
  fireEvent.click(screen.getByRole('button', { name: 'Upload files' }));
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'files', yamlKey: null, bundleKey: null, yamlText: null });
  paste();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'roboflow', source: null });
  fireEvent.change(screen.getByLabelText('Roboflow Python download code'), { target: { value: snippet + '\nexec("sentinel-secret")' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use Roboflow reference' }));
  expect(screen.getByRole('alert').textContent).not.toContain('sentinel-secret');
  expect(onChange).toHaveBeenLastCalledWith({ kind: 'roboflow', source: null });
  expect((screen.getByLabelText('Roboflow Python download code') as HTMLTextAreaElement).value).toBe('');
  expect(fetch).not.toHaveBeenCalled(); expect(invoke).not.toHaveBeenCalled();
});
