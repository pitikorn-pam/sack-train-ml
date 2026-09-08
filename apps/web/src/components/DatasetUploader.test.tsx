/**
 * The uploader's "change" button shipped inert: it called `handleSelect(kind, null)`,
 * and `handleSelect` opens with `if (!file) return` for the file picker's own cancel
 * case, so the one control offered after a failed upload did nothing at all. A dead
 * control is worse than a missing one — it reads as an escape hatch — so the reset
 * path is pinned here, including the part that is easy to get wrong: telling the
 * parent the key is gone. Leaving a successful upload's r2_key behind a removed file
 * would launch a run against a dataset the operator thought they had taken away.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DatasetUploader, safeHost } from './DatasetUploader'

afterEach(cleanup)

// The component reaches for the edge function on select; these tests never get that
// far (they select a file, then reset), but the module-level client still has to load.
vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: new Error('not used') })) } },
}))

function yamlFile() {
  return new File(['names: [person, sack]\n'], 'data.yaml', { type: 'application/x-yaml' })
}

/** The YAML slot's file input — the first one; the ZIP slot's is the second. */
function inputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[]
}

describe('DatasetUploader — the change button', () => {
  it('clears the chosen file so a different one can be picked', async () => {
    const onChange = vi.fn()
    const { container } = render(<DatasetUploader modelLineSlug="sack" onChange={onChange} />)

    fireEvent.change(inputs(container)[0], { target: { files: [yamlFile()] } })
    expect(await screen.findByText('data.yaml')).toBeTruthy()

    fireEvent.click(await screen.findByText('change'))

    // The file name is gone and the picker is back — this is the assertion that
    // failed before the fix, because the button's handler returned immediately.
    expect(screen.queryByText('data.yaml')).toBeNull()
    expect(screen.getAllByText('Choose file').length).toBe(2)
  })

  it('tells the parent the yaml key is gone, not just the local slot', async () => {
    const onChange = vi.fn()
    const { container } = render(<DatasetUploader modelLineSlug="sack" onChange={onChange} />)

    fireEvent.change(inputs(container)[0], { target: { files: [yamlFile()] } })
    fireEvent.click(await screen.findByText('change'))

    const calls = onChange.mock.calls
    const last = calls[calls.length - 1]?.[0]
    expect(last).toBeTruthy()
    expect(last.yamlKey).toBeNull()
    expect(last.yamlText).toBeNull()
  })

  it('resets each slot independently', async () => {
    const onChange = vi.fn()
    const { container } = render(<DatasetUploader modelLineSlug="sack" onChange={onChange} />)

    const zip = new File(['PK'], 'images.zip', { type: 'application/zip' })
    fireEvent.change(inputs(container)[0], { target: { files: [yamlFile()] } })
    // A slot that holds a file stops rendering its input, so the ZIP slot's input is
    // now the only one left — re-query rather than reusing the earlier index.
    fireEvent.change(inputs(container)[0], { target: { files: [zip] } })

    // Reset the ZIP slot only; the YAML choice must survive it.
    const changes = await screen.findAllByText('change')
    fireEvent.click(changes[changes.length - 1])

    expect(screen.queryByText('images.zip')).toBeNull()
    expect(screen.queryByText('data.yaml')).toBeTruthy()
  })
})

describe('safeHost', () => {
  it('keeps the host and drops the signature a presigned URL carries', () => {
    const url = 'https://acct123.r2.cloudflarestorage.com/bucket/k.yaml?X-Amz-Signature=deadbeef'
    expect(safeHost(url)).toBe('acct123.r2.cloudflarestorage.com')
    expect(safeHost(url)).not.toContain('deadbeef')
  })

  it('degrades to a phrase rather than throwing on a malformed URL', () => {
    expect(safeHost('not a url')).toBe('the storage host')
  })
})
