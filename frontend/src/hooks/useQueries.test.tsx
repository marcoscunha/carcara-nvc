import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AppProviders, createTestQueryClient } from '../test/utils'
import { useModels } from './useQueries'
import { modelApi } from '../services/api'
import type { Model } from '../types'

vi.mock('../services/api', () => ({
  modelApi: {
    getAll: vi.fn(),
  },
}))

const mockedGetAll = vi.mocked(modelApi.getAll)

const sampleModels: Model[] = [
  {
    name: 'yolov8n',
    description: 'Nano detection model',
    is_available: true,
    is_downloaded: true,
    is_enabled: true,
    task_type: 'detect',
    confidence_threshold: 0.25,
  },
]

describe('useModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches models and exposes the data', async () => {
    // Arrange
    mockedGetAll.mockResolvedValue(sampleModels)
    const queryClient = createTestQueryClient()

    // Act
    const { result } = renderHook(() => useModels(), {
      wrapper: ({ children }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>,
    })

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(sampleModels)
    expect(mockedGetAll).toHaveBeenCalledWith(undefined)
  })

  it('passes the task_type filter through to the api', async () => {
    // Arrange
    mockedGetAll.mockResolvedValue(sampleModels)
    const queryClient = createTestQueryClient()

    // Act
    const { result } = renderHook(() => useModels('segment'), {
      wrapper: ({ children }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>,
    })

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedGetAll).toHaveBeenCalledWith('segment')
  })

  it('surfaces an error state when the request fails', async () => {
    // Arrange
    mockedGetAll.mockRejectedValue(new Error('boom'))
    const queryClient = createTestQueryClient()

    // Act
    const { result } = renderHook(() => useModels(), {
      wrapper: ({ children }) => <AppProviders queryClient={queryClient}>{children}</AppProviders>,
    })

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
