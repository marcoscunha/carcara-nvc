const VLM_DEBUG_STAGES_STORAGE_KEY = 'carcara.vlm.debugStages'
const VLM_DEBUG_STAGES_EVENT = 'carcara:vlm-debug-stages-changed'

const parseBool = (value: string | undefined | null): boolean | null => {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return null
}

const envDefault = parseBool(import.meta.env.VITE_VLM_DEBUG_STAGES) ?? false

export const isVlmDebugStagesEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return envDefault
  }

  const stored = parseBool(window.localStorage.getItem(VLM_DEBUG_STAGES_STORAGE_KEY))
  return stored ?? envDefault
}

export const setVlmDebugStagesEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(VLM_DEBUG_STAGES_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new CustomEvent(VLM_DEBUG_STAGES_EVENT, { detail: enabled }))
}

export const subscribeVlmDebugStages = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === VLM_DEBUG_STAGES_STORAGE_KEY) {
      onChange()
    }
  }
  const handleCustom = () => onChange()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(VLM_DEBUG_STAGES_EVENT, handleCustom)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(VLM_DEBUG_STAGES_EVENT, handleCustom)
  }
}
