/**
 * parseYoloYaml — the class names shown in the new-run form come from here, and
 * they are what the operator eyeballs before committing a 20-minute Colab run.
 * A parser that silently returns [] for one of the four shapes YOLO datasets use
 * in the wild is a wrong-looking form, not a crash, so each shape is pinned.
 */
import { describe, it, expect } from 'vitest'
import { parseYoloYaml } from './yaml'

describe('parseYoloYaml', () => {
  it('reads the flow-list form', () => {
    expect(parseYoloYaml("names: ['person', 'sack']").names).toEqual(['person', 'sack'])
  })

  it('reads the flow-map form', () => {
    expect(parseYoloYaml('names: {0: person, 1: sack}').names).toEqual(['person', 'sack'])
  })

  it('reads the block-list form', () => {
    const yaml = ['names:', '  - person', '  - sack'].join('\n')
    expect(parseYoloYaml(yaml).names).toEqual(['person', 'sack'])
  })

  it('reads the block-map form and orders by index, not by file order', () => {
    const yaml = ['names:', '  1: sack', '  0: person'].join('\n')
    expect(parseYoloYaml(yaml).names).toEqual(['person', 'sack'])
  })

  it('fills a gap in a block map rather than shifting later classes down', () => {
    // A hole would otherwise renumber every class after it, which mislabels the
    // whole dataset instead of failing loudly.
    const yaml = ['names:', '  0: person', '  2: sack'].join('\n')
    expect(parseYoloYaml(yaml).names).toEqual(['person', 'class_1', 'sack'])
  })

  it('picks up the split paths alongside the names', () => {
    const yaml = [
      'path: ../datasets/sack',
      'train: images/train',
      'val: images/val',
      "names: ['sack']",
    ].join('\n')
    expect(parseYoloYaml(yaml)).toEqual({
      path: '../datasets/sack',
      train: 'images/train',
      val: 'images/val',
      names: ['sack'],
    })
  })

  it('ignores comments and blank lines', () => {
    const yaml = ['# dataset for BSCP', '', "names: ['sack']  # one class", ''].join('\n')
    expect(parseYoloYaml(yaml).names).toEqual(['sack'])
  })

  it('returns no names rather than throwing on an empty document', () => {
    expect(parseYoloYaml('').names).toEqual([])
  })
})
