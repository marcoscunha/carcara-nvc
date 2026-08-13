import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Memory as MemoryIcon,
  CheckCircle as CheckCircleIcon,
  CloudDownload as CloudDownloadIcon,
  CloudDone as CloudDoneIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  DeleteOutline as DeleteOutlineIcon,
  History as HistoryIcon,
  PlayCircleFilled as PlayCircleFilledIcon,
  ToggleOn as ToggleOnIcon,
  TuneOutlined as TuneOutlinedIcon,
} from '@mui/icons-material'

import {
  useBenchmarkHistory,
  useDeleteModel,
  useEnsureModel,
  useInferenceRuntimeConfig,
  useModels,
  useRealtimeInferenceMetrics,
  useRegisterModel,
  useUpdateInferenceRuntimeConfig,
  useUpdateModel,
} from '../../hooks/useQueries'
import type { Model } from '../../types'
import { ConfirmDeleteDialog } from '../dialogs'

import { TASK_LABELS } from './constants'
import { clearExecutedModelNames, loadExecutedModelNames, saveExecutedModelNames } from './executedModelsStorage'

interface ModelCatalogPanelProps {
  /** Optional callback so the parent (Models page) can switch to the Runtime tab. */
  onOpenRuntimeTab?: () => void
}

// Custom model registration is disabled by default for the release. Enable by
// setting VITE_ALLOW_CUSTOM_MODELS=true (mirrors the backend ALLOW_CUSTOM_MODELS flag).
const ALLOW_CUSTOM_MODELS = String(import.meta.env.VITE_ALLOW_CUSTOM_MODELS).toLowerCase() === 'true'

const ModelCatalogPanel: React.FC<ModelCatalogPanelProps> = ({ onOpenRuntimeTab }) => {
  const [taskTab, setTaskTab] = useState<string>('detect')
  const [newModelName, setNewModelName] = useState<string>('')
  const [newModelDescription, setNewModelDescription] = useState<string>('')
  const [newModelTaskType, setNewModelTaskType] = useState<string>('detect')
  const [downloadingModels, setDownloadingModels] = useState<string[]>([])
  const [modelPendingDelete, setModelPendingDelete] = useState<string | null>(null)

  const { data: allModels, isLoading, refetch: refetchModels } = useModels()
  const { data: benchmarkHistory, isLoading: isBenchmarkHistoryLoading } = useBenchmarkHistory(10)
  const { data: runtimeConfig } = useInferenceRuntimeConfig()
  const { data: realtimeMetrics } = useRealtimeInferenceMetrics()
  const updateRuntimeMutation = useUpdateInferenceRuntimeConfig()
  const updateModelMutation = useUpdateModel()
  const ensureModelMutation = useEnsureModel()
  const deleteModelMutation = useDeleteModel()
  const registerModelMutation = useRegisterModel()

  const allModelsList: Model[] = useMemo(() => allModels || [], [allModels])
  const [persistedExecutedModelNames, setPersistedExecutedModelNames] = useState<Set<string>>(() =>
    loadExecutedModelNames(),
  )

  const liveExecutedModelNames = useMemo(() => {
    const names = new Set<string>()
    const perStream = realtimeMetrics?.per_stream || {}

    for (const streamMetrics of Object.values(perStream)) {
      if (streamMetrics.model_name && streamMetrics.samples > 0) {
        names.add(streamMetrics.model_name)
      }
    }

    return names
  }, [realtimeMetrics?.per_stream])

  const displayedExecutedModelNames = useMemo(() => {
    const names = new Set<string>(persistedExecutedModelNames)
    for (const name of liveExecutedModelNames) {
      names.add(name)
    }
    return names
  }, [persistedExecutedModelNames, liveExecutedModelNames])

  useEffect(() => {
    setPersistedExecutedModelNames((previous) => {
      const next = new Set(previous)
      let changed = false

      const benchmarkItems = benchmarkHistory?.items || []
      for (const item of benchmarkItems) {
        if (item.model_name && !next.has(item.model_name)) {
          next.add(item.model_name)
          changed = true
        }
      }

      const perStream = realtimeMetrics?.per_stream || {}
      for (const streamMetrics of Object.values(perStream)) {
        if (streamMetrics.model_name && streamMetrics.samples > 0 && !next.has(streamMetrics.model_name)) {
          next.add(streamMetrics.model_name)
          changed = true
        }
      }

      if (!changed) {
        return previous
      }

      saveExecutedModelNames(next)
      return next
    })
  }, [benchmarkHistory?.items, realtimeMetrics?.per_stream])

  const runningModelNames = liveExecutedModelNames

  const modelList: Model[] = allModelsList.filter((m: Model) => m.task_type === taskTab)
  const downloadedModelsCount = allModelsList.filter((m: Model) => m.is_downloaded).length
  const storageRoots = Array.from(
    new Set(allModelsList.map((m: Model) => m.storage_root).filter((v): v is string => Boolean(v))),
  )

  const selectedModel = runtimeConfig?.model_name ?? ''
  const selectedTaskType = runtimeConfig?.task_type ?? 'detect'

  useEffect(() => {
    if (downloadingModels.length === 0) {
      return
    }

    const timer = window.setInterval(() => {
      void refetchModels()
    }, 1500)

    return () => {
      window.clearInterval(timer)
    }
  }, [downloadingModels.length, refetchModels])

  useEffect(() => {
    if (downloadingModels.length === 0) {
      return
    }

    setDownloadingModels((current) =>
      current.filter((name) => {
        const model = allModelsList.find((item) => item.name === name)
        return !model?.is_downloaded
      }),
    )
  }, [allModelsList, downloadingModels.length])

  const handleSelectModel = (modelName: string) => {
    updateRuntimeMutation.mutate({ model_name: modelName, task_type: taskTab })
  }

  const handleEnsureModel = (name: string) => {
    setDownloadingModels((current) => (current.includes(name) ? current : [...current, name]))
    ensureModelMutation.mutate(name, {
      onError: () => {
        setDownloadingModels((current) => current.filter((item) => item !== name))
      },
    })
  }

  const handleToggleModelActive = (model: Model) => {
    updateModelMutation.mutate({
      name: model.name,
      data: { is_enabled: !model.is_enabled },
    })
  }

  const handleRequestDeleteModel = (name: string) => {
    setModelPendingDelete(name)
  }

  const handleConfirmDeleteModel = () => {
    if (!modelPendingDelete) {
      return
    }

    const modelToDelete = modelPendingDelete
    deleteModelMutation.mutate(modelToDelete, {
      onSuccess: () => {
        setDownloadingModels((current) => current.filter((item) => item !== modelToDelete))
        setModelPendingDelete(null)
      },
    })
  }

  const handleClearModelHistory = () => {
    setPersistedExecutedModelNames(new Set<string>())
    clearExecutedModelNames()
  }

  const handleRegisterModel = () => {
    const name = newModelName.trim()
    if (!name) {
      return
    }

    registerModelMutation.mutate(
      {
        name,
        task_type: newModelTaskType,
        description: newModelDescription.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewModelName('')
          setNewModelDescription('')
        },
      },
    )
  }

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={120} height={40} className="loading-skeleton" />
        <Skeleton variant="rounded" height={300} />
      </Box>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="settings-card__content">
          <Box className="settings-card__header">
            <Box className="settings-card__icon settings-card__icon--primary">
              <MemoryIcon color="primary" />
            </Box>
            <Box>
              <Typography variant="h6" className="settings-card__title">
                AI Models
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Download, enable and register YOLO models for detection, pose and segmentation
              </Typography>
            </Box>
          </Box>

          <Divider className="settings-card__divider" />

          {/* Task Type Tabs */}
          <Tabs value={taskTab} onChange={(_, v) => setTaskTab(v)} sx={{ mb: 2 }}>
            <Tab value="detect" label={TASK_LABELS.detect} />
            <Tab value="segment" label={TASK_LABELS.segment} />
            <Tab value="pose" label={TASK_LABELS.pose} />
          </Tabs>

          {/* Global default model indicator + link to Runtime tab */}
          {selectedModel && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                onOpenRuntimeTab ? (
                  <Button color="inherit" size="small" onClick={onOpenRuntimeTab} startIcon={<TuneOutlinedIcon />}>
                    Configure runtime
                  </Button>
                ) : undefined
              }
            >
              <Tooltip title="Fallback model used by streams without an explicit model.">
                <span>
                  Global default: <strong>{selectedModel}</strong> ({TASK_LABELS[selectedTaskType] ?? selectedTaskType})
                </span>
              </Tooltip>
            </Alert>
          )}

          <Alert severity="success" sx={{ mb: 2 }}>
            <Tooltip title="Models with local weights on this device across all task types.">
              <span>
                Downloaded models: <strong>{downloadedModelsCount}</strong> / {allModelsList.length}
              </span>
            </Tooltip>
          </Alert>

          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title="Clear executed model history icons.">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={handleClearModelHistory}
                  disabled={persistedExecutedModelNames.size === 0}
                >
                  Clear model history
                </Button>
              </span>
            </Tooltip>
          </Box>

          {storageRoots.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Model storage location
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {storageRoots.map((root) => (
                  <Chip key={root} label={root} size="small" variant="outlined" sx={{ maxWidth: '100%' }} />
                ))}
              </Box>
            </Box>
          )}

          {/* Model list for active tab */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {modelList.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No models found for {TASK_LABELS[taskTab]}
              </Typography>
            ) : (
              modelList.map((model: Model) => {
                const isDownloading = downloadingModels.includes(model.name)
                const isDeleting = deleteModelMutation.isPending && deleteModelMutation.variables === model.name
                const hasExecutedOnHardware = displayedExecutedModelNames.has(model.name)
                const isRunningOnAnyStream = runningModelNames.has(model.name)

                return (
                  <Box
                    key={model.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: model.name === selectedModel ? 'primary.main' : 'divider',
                      bgcolor: model.name === selectedModel ? 'primary.50' : 'transparent',
                      gap: 1,
                    }}
                  >
                    {/* Model info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {model.name}
                        </Typography>
                        {model.name === selectedModel && (
                          <Tooltip title="Current global default model.">
                            <CheckCircleIcon fontSize="small" color="primary" />
                          </Tooltip>
                        )}
                        {(isDownloading || model.is_downloaded) && (
                          <Tooltip
                            title={
                              isDownloading
                                ? 'Model download is in progress.'
                                : 'Model weights are downloaded on this device.'
                            }
                          >
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                              {isDownloading ? (
                                <CircularProgress size={16} />
                              ) : (
                                <CloudDoneIcon fontSize="small" color="success" />
                              )}
                            </Box>
                          </Tooltip>
                        )}
                        {model.is_downloaded && model.is_enabled && (
                          <Tooltip title="Model is active and selectable in stream model fields.">
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                              <ToggleOnIcon fontSize="small" color="success" />
                            </Box>
                          </Tooltip>
                        )}
                        {hasExecutedOnHardware && (
                          <Tooltip title="This model has run on this hardware before.">
                            <HistoryIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                        {isRunningOnAnyStream && (
                          <Tooltip title="This model is running on at least one stream now.">
                            <PlayCircleFilledIcon fontSize="small" color="success" />
                          </Tooltip>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {model.description || model.task_type}
                      </Typography>
                      {model.storage_path && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.25, wordBreak: 'break-all' }}
                        >
                          Stored at: {model.storage_path}
                        </Typography>
                      )}
                      {isDownloading && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress />
                          <Typography variant="caption" color="text.secondary">
                            Download in progress...
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {!model.is_downloaded && (
                        <Tooltip title="Download weights to this device.">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={isDownloading ? <CircularProgress size={14} /> : <CloudDownloadIcon />}
                              onClick={() => handleEnsureModel(model.name)}
                              disabled={isDownloading}
                            >
                              Download model
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {model.is_downloaded && model.name !== selectedModel && (
                        <Tooltip title="Set as the global default model.">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleSelectModel(model.name)}
                              disabled={updateRuntimeMutation.isPending || isDeleting || isDownloading}
                            >
                              Set as default
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {model.is_downloaded && (
                        <Tooltip
                          title={
                            model.is_enabled
                              ? 'Disable this model in stream model selectors.'
                              : 'Enable this model in stream model selectors.'
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant={model.is_enabled ? 'outlined' : 'contained'}
                              color={model.is_enabled ? 'warning' : 'success'}
                              onClick={() => handleToggleModelActive(model)}
                              disabled={updateModelMutation.isPending || isDeleting || isDownloading}
                            >
                              {model.is_enabled ? 'Disable model' : 'Enable model'}
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {model.is_downloaded && (
                        <Tooltip
                          title={
                            model.name === selectedModel
                              ? 'Cannot delete the current default model.'
                              : 'Delete local weights for this model.'
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={isDeleting ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
                              onClick={() => handleRequestDeleteModel(model.name)}
                              disabled={model.name === selectedModel || isDeleting || isDownloading}
                            >
                              Delete model
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {ALLOW_CUSTOM_MODELS && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Add New Model
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  label="Model Name"
                  placeholder="my-yolo-model"
                  value={newModelName}
                  onChange={(event) => setNewModelName(event.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Task Type"
                  select
                  value={newModelTaskType}
                  onChange={(event) => setNewModelTaskType(event.target.value)}
                  fullWidth
                >
                  {Object.entries(TASK_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Description"
                  placeholder="Optional"
                  value={newModelDescription}
                  onChange={(event) => setNewModelDescription(event.target.value)}
                  fullWidth
                  sx={{ gridColumn: { xs: '1', sm: '1 / span 2' } }}
                />
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleRegisterModel}
                disabled={registerModelMutation.isPending || !newModelName.trim()}
              >
                {registerModelMutation.isPending ? 'Adding model...' : 'Add model to catalog'}
              </Button>
              {registerModelMutation.isError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  Failed to add model. Please check the model name and try again.
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />
            </>
          )}

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Previous Benchmark Reports
          </Typography>
          {isBenchmarkHistoryLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading benchmark history...
            </Typography>
          ) : benchmarkHistory && benchmarkHistory.items.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {benchmarkHistory.items.slice(0, 5).map((item) => (
                <Box
                  key={item.run_id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {item.scenario_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Run: {item.run_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Model: {item.model_name || 'n/a'} • Streams: {item.streams_count}
                  </Typography>
                  {item.created_at && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Created: {new Date(item.created_at).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">
                Reports folder: {benchmarkHistory.reports_dir}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No benchmark reports found yet.
            </Typography>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={Boolean(modelPendingDelete)}
        onClose={() => setModelPendingDelete(null)}
        onConfirm={handleConfirmDeleteModel}
        title="Delete Model"
        itemName={modelPendingDelete || ''}
        warningMessage="This removes local model files from this hardware. You can download the model again later."
        isLoading={deleteModelMutation.isPending}
      />
    </>
  )
}

export default ModelCatalogPanel
