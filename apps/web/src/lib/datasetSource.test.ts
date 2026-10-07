import { expect, it } from 'vitest';
import { parseRoboflowSnippet, parseRoboflowSource, datasetLabel } from '@contracts/dataset-source';
import { validateConfig } from '../../../../supabase/functions/_shared/contract';
import { prefillFromConfig } from './prefill';
const source = { kind: 'roboflow', workspace: 'workspace', project: 'sack', version: 2, format: 'yolov11' };
const common = { source_weights: 'yolo11s.pt' };
const snippet = 'from roboflow import Roboflow\nrf = Roboflow(api_key="sentinel-secret")\nproject = rf.workspace("workspace").project("sack")\nversion = project.version(2)\ndataset = version.download("yolov11")';
it('pure parser returns only the five validated reference fields for both quote styles and notebook installer', () => {
  for (const code of [snippet, '!pip install roboflow\n' + snippet, snippet.split('"').join("'"), snippet.split('rf').join('client')]) {
    expect(parseRoboflowSnippet(code)).toEqual(source);
    expect(JSON.stringify(parseRoboflowSnippet(code))).not.toContain('sentinel-secret');
  }
});
it.each([
  ['workspace', 'sentinel-secret'],
  ['workspace', 'prefix-sentinel-secret-suffix'],
  ['project', 'sentinel-secret'],
  ['project', 'prefix-sentinel-secret-suffix'],
])('rejects known snippet credentials in %s metadata: %s', (field, value) => {
  const code = snippet.replace(field === 'workspace' ? '"workspace"' : '"sack"', `"${value}"`);
  let error: unknown;
  try { parseRoboflowSnippet(code); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).not.toContain('sentinel-secret');
  expect(String(error)).not.toContain(value);
  expect(String(error)).not.toContain(code);
});
it.each(['', 'REDACTED', 'YOUR_API_KEY', '***'])('preserves literal placeholders without credentials in metadata: %s', key => {
  const parsed = parseRoboflowSnippet(snippet.replace('sentinel-secret', key));
  expect(parsed).toEqual(source);
  expect(Object.keys(parsed)).toHaveLength(5);
  expect(validateConfig({ ...common, dataset_source: parsed })).toEqual([]);
  expect(JSON.stringify(parsed)).not.toContain('api_key');
  if (key) expect(JSON.stringify(parsed)).not.toContain(key);
});
it.each(['', snippet + '\nmalicious()', snippet.replace('version(2)', 'version(1+1)'), snippet.replace('version(2)', 'version(True)'), snippet.replace('version(2)', 'version(0)'), snippet.replace('"yolov11"', '"coco"'), snippet.replace('"workspace"', '"../escape"'), snippet.replace('"sentinel-secret"', 'get_key()'), 'x'.repeat(16385)])('rejects unsupported snippet grammar without input in errors', code => {
  try { parseRoboflowSnippet(code); throw new Error('accepted'); }
  catch (error) { expect(String(error)).not.toContain('sentinel-secret'); expect(String(error)).not.toContain('accepted'); }
});
it('cloud accepts both mutually exclusive source forms with deferred classes only for Roboflow', () => {
  expect(validateConfig({ ...common, dataset_source: source })).toEqual([]);
  expect(validateConfig({ ...common, dataset: 'datasets/a/data.yaml', dataset_bundle: 'datasets/a/data.zip', classes: ['sack'] })).toEqual([]);
  for (const extra of [{ classes: [] }, { classes: ['sack'] }, { dataset: 'old.yaml' }, { dataset_bundle: 'old.zip' }]) {
    expect(validateConfig({ ...common, dataset_source: source, ...extra }).length).toBeGreaterThan(0);
  }
  for (const bad of [{}, { dataset: {} }, { dataset: 'a' }, { dataset: 'a', classes: [] }, { dataset: 'a', classes: [1] }]) expect(validateConfig({ ...common, ...bad }).length).toBeGreaterThan(0);
});
it.each([null, {}, { ...source, version: true }, { ...source, version: 1.2 }, { ...source, version: 0 }, { ...source, format: 'coco' }, { ...source, workspace: '../escape' }, { ...source, api_key: 'sentinel-secret' }])('rejects malformed/credential-bearing references', bad => {
  expect(() => parseRoboflowSource(bad)).toThrow();
  const issues = validateConfig({ ...common, dataset_source: bad });
  expect(issues.length).toBeGreaterThan(0);
  expect(JSON.stringify(issues)).not.toContain('sentinel-secret');
});
it.each(['api_key', 'ROBOFLOW_API_KEY', 'snippet', 'credentials', 'token'])('rejects forbidden credentials recursively and safely: %s', key => {
  const issues = validateConfig({ ...common, dataset_source: source, hyperparameters: { [key]: 'sentinel-secret' } });
  expect(issues.length).toBeGreaterThan(0);
  expect(JSON.stringify(issues)).not.toContain('sentinel-secret');
});
it('clones resolved or pending Roboflow runs as references with deferred classes and renders a scalar label', () => {
  for (const config of [{ dataset_source: source }, { dataset_source: source, classes: ['person', 'sack'] }]) {
    const p = prefillFromConfig(config);
    expect(p.datasetSource).toEqual(source); expect(p.datasetKey).toBe(''); expect(p.bundleKey).toBeNull(); expect(p.classes).toEqual([]);
    expect(datasetLabel(config)).toBe('Roboflow workspace/sack v2 (yolov11)');
  }
});
it.each([null, undefined, [], 'bad', 1])('rejects non-object cloud config safely', config => {
  expect(validateConfig(config)).toEqual([{ key: 'config', message: 'config must be an object.' }]);
});
