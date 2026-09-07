/**
 * The `@contracts` alias, exercised from inside the test runner.
 *
 * `contracts/param-schema.json` is read by three runtimes — this app via the
 * Vite alias (vite.config.ts:8-12), the `start-training` edge function via
 * `_shared/contract.ts`, and the Python pipeline. It is an alias rather than a
 * copy precisely so it cannot drift, so a test suite that could not resolve it
 * would be testing a fiction. The first case below fails loudly if the alias
 * ever stops resolving; the rest assert the browser's reader agrees with the
 * file it claims to read.
 */
import { describe, it, expect } from 'vitest'
import raw from '@contracts/param-schema.json'
import { schema, byKey, paramsFor, checkpointName, capabilityFor, validate } from './schema'

describe('@contracts alias', () => {
  it('resolves to the real param-schema.json, not an empty stub', () => {
    expect(Array.isArray(raw.params)).toBe(true)
    expect(raw.params.length).toBeGreaterThan(0)
    expect(Object.keys(raw)).toEqual(
      expect.arrayContaining(['toolchain', 'families', 'taskSuffix', 'capability', 'params']),
    )
  })

  it('is the same document schema.ts serves — one file, not two', () => {
    expect(schema.params.length).toBe(raw.params.length)
    expect(schema.taskSuffix).toEqual(raw.taskSuffix)
  })
})

describe('schema readers', () => {
  it('splits params by form so the two field grids cannot borrow each others keys', () => {
    const train = paramsFor('train')
    const compile = paramsFor('compile')
    expect(train.length).toBeGreaterThan(0)
    expect(compile.length).toBeGreaterThan(0)
    expect(train.length + compile.length).toBe(schema.params.length)
    expect(train.every((p) => p.form === 'train')).toBe(true)
  })

  it('derives the checkpoint name from the suffix table in the contract', () => {
    expect(checkpointName('yolo11', 's', 'detect')).toBe('yolo11s.pt')
    expect(checkpointName('yolo11', 'n', 'segment')).toBe('yolo11n-seg.pt')
    expect(checkpointName('yolo11', 'm', 'pose')).toBe('yolo11m-pose.pt')
  })

  it('always finds a capability rule — the last rule is the catch-all', () => {
    // capabilityFor non-null-asserts the lookup, so an unmatched pair would be a
    // TypeError in the form rather than a warning banner.
    const cap = capabilityFor('no-such-family', 'no-such-task')
    expect(cap.level).toBeDefined()
    expect(['ok', 'warn', 'blocked']).toContain(cap.level)
  })
})

describe('client-side validation mirrors the contract', () => {
  it('reads bounds from the contract rather than hardcoding them', () => {
    const epochs = byKey('epochs')!
    expect(epochs.max).toBeDefined()
    const tooMany = String(epochs.max! + 1)
    const issues = validate({ epochs: tooMany }, capabilityFor('yolo11', 'detect'))
    expect(issues.some((i) => i.key === 'epochs' && i.level === 'blocking')).toBe(true)
  })

  it('accepts the contract default for every field param', () => {
    // Whatever the form loads with must not light up red on first paint.
    const defaults: Record<string, string> = {}
    for (const p of paramsFor('train', 'field')) {
      if (p.default !== undefined) defaults[p.key] = String(p.default)
    }
    const blocking = validate(defaults, capabilityFor('yolo11', 'detect')).filter(
      (i) => i.level === 'blocking',
    )
    expect(blocking).toEqual([])
  })

  it('warns on a discouraged enum value instead of blocking it', () => {
    const optimizer = byKey('optimizer')!
    expect(optimizer.discouraged?.length).toBeGreaterThan(0)
    const issues = validate(
      { optimizer: optimizer.discouraged![0] },
      capabilityFor('yolo11', 'detect'),
    )
    expect(issues.some((i) => i.key === 'optimizer' && i.level === 'warning')).toBe(true)
  })

  it('blocks optimization level 2 with too few calibration images', () => {
    // Mirrors the server-side rule the edge function enforces
    // (contracts/verify-contract.mjs, "optimization_level 2 with too few...").
    const cap = capabilityFor('yolo11', 'detect')
    expect(
      validate({ optimization_level: '2', calib_n: '512' }, cap).some((i) => i.key === 'calib_n'),
    ).toBe(true)
    expect(
      validate({ optimization_level: '2', calib_n: '1024' }, cap).some((i) => i.key === 'calib_n'),
    ).toBe(false)
  })
})
