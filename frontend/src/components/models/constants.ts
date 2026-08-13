// Task type labels for AI model display.
export const TASK_LABELS: Record<string, string> = {
  detect: 'Detection',
  segment: 'Segmentation',
  pose: 'Pose',
}

// localStorage key used to persist the set of model names that have already
// been executed on this hardware. Kept identical to the legacy value so users
// do not lose their "executed before" indicators when the catalog UI moves
// from the Settings page to the Models page.
export const EXECUTED_MODELS_STORAGE_KEY = 'carcara.executedModelsHistory'
