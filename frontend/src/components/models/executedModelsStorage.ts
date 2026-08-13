import { EXECUTED_MODELS_STORAGE_KEY } from './constants'

export const loadExecutedModelNames = (): Set<string> => {
  if (typeof window === 'undefined') {
    return new Set<string>()
  }

  try {
    const raw = window.localStorage.getItem(EXECUTED_MODELS_STORAGE_KEY)
    if (!raw) {
      return new Set<string>()
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return new Set<string>()
    }

    return new Set<string>(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0))
  } catch {
    return new Set<string>()
  }
}

export const saveExecutedModelNames = (names: Set<string>): void => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(EXECUTED_MODELS_STORAGE_KEY, JSON.stringify(Array.from(names)))
}

export const clearExecutedModelNames = (): void => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(EXECUTED_MODELS_STORAGE_KEY)
}
