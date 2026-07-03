import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { renderWithProviders, screen, userEvent } from '../../test/utils'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'

function renderDialog(overrides: Partial<ComponentProps<typeof ConfirmDeleteDialog>> = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  renderWithProviders(
    <ConfirmDeleteDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete model"
      itemName="yolov8n"
      {...overrides}
    />,
  )
  return { onClose, onConfirm }
}

describe('ConfirmDeleteDialog', () => {
  it('renders the title and item name', () => {
    // Arrange

    // Act
    renderDialog()

    // Assert
    expect(screen.getByText('Delete model')).toBeInTheDocument()
    expect(screen.getByText(/yolov8n/)).toBeInTheDocument()
  })

  it('disables the delete button until "delete" is typed', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()
    const deleteButton = screen.getByRole('button', { name: 'Delete' })

    // Act & Assert
    expect(deleteButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText("Type 'delete' to confirm"), 'delete')
    expect(deleteButton).toBeEnabled()

    await user.click(deleteButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not confirm when the wrong text is typed', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    // Act
    await user.type(screen.getByPlaceholderText("Type 'delete' to confirm"), 'nope')

    // Assert
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onClose when cancel is clicked', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a loading state and disables actions', () => {
    // Arrange

    // Act
    renderDialog({ isLoading: true })

    // Assert
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('renders an optional warning message', () => {
    // Arrange

    // Act
    renderDialog({ warningMessage: 'This cannot be undone.' })

    // Assert
    expect(screen.getByText(/This cannot be undone\./)).toBeInTheDocument()
  })
})
