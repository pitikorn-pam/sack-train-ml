/** Pure dataset boundary shared by the form and cloud validator. No IO or eval. */
export type RoboflowSource = {
  kind: 'roboflow'; workspace: string; project: string; version: number;
  format: 'yolov8' | 'yolov11';
};
export type DatasetRequest =
  | { dataset: string; dataset_bundle?: string; classes: string[]; dataset_source?: never }
  | { dataset_source: RoboflowSource; dataset?: never; dataset_bundle?: never; classes?: never };
const slug = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
export function parseRoboflowSource(value: unknown): RoboflowSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Roboflow reference.');
  const v = value as Record<string, unknown>;
  const keys = ['kind', 'workspace', 'project', 'version', 'format'];
  if (Object.keys(v).length !== keys.length || Object.keys(v).some(k => !keys.includes(k))
      || v.kind !== 'roboflow' || typeof v.workspace !== 'string' || !slug.test(v.workspace)
      || typeof v.project !== 'string' || !slug.test(v.project)
      || typeof v.version !== 'number' || !Number.isSafeInteger(v.version) || v.version < 1
      || (v.format !== 'yolov8' && v.format !== 'yolov11')) throw new Error('Invalid Roboflow reference.');
  return { kind: 'roboflow', workspace: v.workspace, project: v.project, version: v.version, format: v.format };
}
export function hasForbiddenCredentials(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) =>
    /^(api[_-]?key|roboflow[_-]?api[_-]?key|snippet|raw[_-]?snippet|token|password|secret|credentials)$/i.test(key)
    || hasForbiddenCredentials(item));
}
export function datasetIssues(config: Record<string, unknown>): { key: string; message: string }[] {
  const issues: { key: string; message: string }[] = [];
  if (hasForbiddenCredentials(config)) issues.push({ key: 'dataset_source', message: 'Credentials and snippets must not be stored in config.' });
  if ('dataset_source' in config) {
    try { parseRoboflowSource(config.dataset_source); }
    catch { issues.push({ key: 'dataset_source', message: 'Invalid Roboflow reference.' }); }
    if (['dataset', 'dataset_bundle', 'classes'].some(k => k in config))
      issues.push({ key: 'dataset_source', message: 'Roboflow requests must omit dataset, dataset_bundle and classes.' });
  } else {
    if (typeof config.dataset !== 'string' || !config.dataset.trim()) issues.push({ key: 'dataset', message: 'dataset must be a non-empty string.' });
    if ('dataset_bundle' in config && (typeof config.dataset_bundle !== 'string' || !config.dataset_bundle.trim())) issues.push({ key: 'dataset_bundle', message: 'dataset_bundle must be a non-empty string.' });
    if (!Array.isArray(config.classes) || !config.classes.length || !config.classes.every(c => typeof c === 'string' && c.trim())) issues.push({ key: 'classes', message: 'classes must be a non-empty list of names.' });
  }
  return issues;
}
export function datasetLabel(config: Record<string, unknown>): string {
  if ('dataset_source' in config) {
    try { const s = parseRoboflowSource(config.dataset_source); return `Roboflow ${s.workspace}/${s.project} v${s.version} (${s.format})`; }
    catch { return 'Invalid Roboflow reference'; }
  }
  return typeof config.dataset === 'string' ? config.dataset : '—';
}

/** Read only the standard generated snippet grammar. Tokens are never executed. */
export function parseRoboflowSnippet(input: string): RoboflowSource {
  const fail = () => { throw new Error('Use the standard Roboflow Python download code with literal workspace, project, version and YOLOv8/YOLOv11 format.'); };
  if (!input.trim() || input.length > 16384) return fail();
  const text = input.split('\n').filter(l => !['!pip install roboflow', '!pip install -q roboflow'].includes(l.trim())).join('\n');
  type Token = { kind: 'name' | 'string' | 'number' | 'punct'; value: string };
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    if (text[i] === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    const rest = text.slice(i);
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) { tokens.push({ kind: 'name', value: word[0] }); i += word[0].length; continue; }
    const num = /^\d+/.exec(rest);
    if (num) { tokens.push({ kind: 'number', value: num[0] }); i += num[0].length; continue; }
    if ('().='.includes(text[i])) { tokens.push({ kind: 'punct', value: text[i++] }); continue; }
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i++]; let value = '';
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\n' || text[i] === '\r') return fail();
        if (text[i] === '\\') { i++; if (text[i] !== quote && text[i] !== '\\') return fail(); }
        value += text[i++];
      }
      if (text[i++] !== quote) return fail();
      tokens.push({ kind: 'string', value }); continue;
    }
    return fail();
  }
  let at = 0;
  function take(kind: Token['kind'], value?: string): string {
    const t = tokens[at++];
    if (!t || t.kind !== kind || (value !== undefined && value !== t.value)) return fail();
    return t.value;
  }
  const p = (v: string) => take('punct', v);
  const n = (v: string) => take('name', v);
  if (tokens[at]?.value === 'from') { n('from'); n('roboflow'); n('import'); n('Roboflow'); }
  const rf = take('name'); p('='); n('Roboflow'); p('('); n('api_key'); p('='); const apiKey = take('string'); p(')');
  const projectVar = take('name'); p('='); n(rf); p('.'); n('workspace'); p('('); const workspace = take('string'); p(')'); p('.'); n('project'); p('('); const project = take('string'); p(')');
  const versionVar = take('name'); p('='); n(projectVar); p('.'); n('version'); p('('); const version = Number(take('number')); p(')');
  const datasetVar = take('name'); p('='); n(versionVar); p('.'); n('download'); p('('); const format = take('string'); p(')');
  if (at !== tokens.length || new Set([rf, projectVar, versionVar, datasetVar]).size !== 4) return fail();
  const source = parseRoboflowSource({ kind: 'roboflow', workspace, project, version, format });
  if (apiKey && Object.values(source).some(value => typeof value === 'string' && value.includes(apiKey))) return fail();
  return source;
}
