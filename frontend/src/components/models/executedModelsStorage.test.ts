import { afterEach, describe, expect, it } from 'vitest'
import { EXECUTED_MODELS_STORAGE_KEY } from './constants'
import { clearExecutedModelNames, loadExecutedModelNames, saveExecutedModelNames } from './executedModelsStorage'

describe('executedModelsStorage', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns an empty set when nothing is stored', () => {
    // Arrange

    // Act

    // Assert
    expect(loadExecutedModelNames().size).toBe(0)
  })

  it('persists and loads model names round-trip', () => {
    // Arrange

    // Act

    // Assert
    saveExecutedModelNames(new Set(['yolov8n', 'yolo11m']))
    const loaded = loadExecutedModelNames()
    expect(loaded.has('yolov8n')).toBe(true)
    expect(loaded.has('yolo11m')).toBe(true)
    expect(loaded.size).toBe(2)
  })

  it('ignores malformed JSON and returns an empty set', () => {
    // Arrange

    // Act

    // Assert
    window.localStorage.setItem(EXECUTED_MODELS_STORAGE_KEY, '{not json')
    expect(loadExecutedModelNames().size).toBe(0)
  })

  it('filters out non-string and empty entries', () => {
    // Arrange

    // Act

    // Assert
    window.localStorage.setItem(EXECUTED_MODELS_STORAGE_KEY, JSON.stringify(['ok', '', 1, null, 'fine']))
    const loaded = loadExecutedModelNames()
    expect([...loaded].sort()).toEqual(['fine', 'ok'])
  })

  it('clears stored names', () => {
    // Arrange

    // Act

    // Assert
    saveExecutedModelNames(new Set(['a']))
    clearExecutedModelNames()
    expect(window.localStorage.getItem(EXECUTED_MODELS_STORAGE_KEY)).toBeNull()
    expect(loadExecutedModelNames().size).toBe(0)
  })
})
