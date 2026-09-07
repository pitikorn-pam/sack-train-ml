/**
 * ConfirmModal is the last gate in front of every destructive action in the app
 * (delete a run, delete a version, undeploy). The cases that matter are the ones
 * where a mis-wired dismissal reads as a confirmation, so both dismissal paths
 * and the "clicking inside must not cancel" case are pinned here.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConfirmModal } from './ConfirmModal'

// Auto-cleanup only registers itself when the runner exposes globals; this suite
// runs without `globals: true`, so unmounting is explicit.
afterEach(cleanup)

const props = {
  open: true,
  title: 'Delete run',
  message: 'This removes the run and its metrics.',
  onConfirm: () => {},
  onCancel: () => {},
}

describe('ConfirmModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<ConfirmModal {...props} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the title and message when open', () => {
    render(<ConfirmModal {...props} />)
    expect(screen.getByText('Delete run')).toBeTruthy()
    expect(screen.getByText('This removes the run and its metrics.')).toBeTruthy()
  })

  it('uses the default button labels and overrides them when asked', () => {
    const { unmount } = render(<ConfirmModal {...props} />)
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
    unmount()

    render(<ConfirmModal {...props} confirmLabel="Delete" cancelLabel="Keep" />)
    expect(screen.getByText('Delete')).toBeTruthy()
    expect(screen.getByText('Keep')).toBeTruthy()
  })

  it('calls onConfirm only from the confirm button', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmModal {...props} onConfirm={onConfirm} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels on Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...props} onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not listen for Escape while closed', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...props} open={false} onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels on a backdrop click but not on a click inside the dialog', () => {
    const onCancel = vi.fn()
    const { container } = render(<ConfirmModal {...props} onCancel={onCancel} />)

    // The dialog stops propagation; without that, every click in the body of the
    // modal would dismiss it.
    fireEvent.click(container.querySelector('.modal')!)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(container.querySelector('.modal-backdrop')!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('marks the confirm button as dangerous only when asked', () => {
    const { container, unmount } = render(<ConfirmModal {...props} />)
    expect(container.querySelector('.modal-confirm.danger')).toBeNull()
    unmount()

    const danger = render(<ConfirmModal {...props} danger />)
    expect(danger.container.querySelector('.modal-confirm.danger')).not.toBeNull()
  })
})
