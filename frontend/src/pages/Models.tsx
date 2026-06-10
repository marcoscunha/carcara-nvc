import React, { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  useInferenceRuntimeConfig,
  useInferenceWorkers,
  useRealtimeInferenceMetrics,
  useRestartAllWorkers,
  useRestartWorker,
  useRuntimes,
  useStartWorker,
  useStopAllWorkers,
  useStopWorker,
  useStreams,
  useUpdateInferenceRuntimeConfig,
  useUpdateWorkerConfig,
  useWarmupWorker,
} from '../hooks/useQueries'

const Models: React.FC = () => {
  const { data: runtimeConfig } = useInferenceRuntimeConfig()
  const { data: runtimes } = useRuntimes()
  const { data: workers } = useInferenceWorkers()
  const { data: streams } = useStreams()
  const { data: metrics } = useRealtimeInferenceMetrics()

  const updateRuntime = useUpdateInferenceRuntimeConfig()
  const startWorker = useStartWorker()
  const stopWorker = useStopWorker()
  const restartWorker = useRestartWorker()
  const updateWorkerConfig = useUpdateWorkerConfig()
  const warmupWorker = useWarmupWorker()
  const stopAllWorkers = useStopAllWorkers()
  const restartAllWorkers = useRestartAllWorkers()

  const [globalModelName, setGlobalModelName] = useState<string>('')
  const [globalTaskType, setGlobalTaskType] = useState<string>('detect')
  const [globalAccelerator, setGlobalAccelerator] = useState<string>('cpu')
  const [globalRuntime, setGlobalRuntime] = useState<string>('auto')
  const [globalDtype, setGlobalDtype] = useState<string>('auto')
  const [globalProviders, setGlobalProviders] = useState<string>('')

  const [configDialogStreamId, setConfigDialogStreamId] = useState<number | null>(null)
  const [workerRuntime, setWorkerRuntime] = useState<string>('auto')
  const [workerDtype, setWorkerDtype] = useState<string>('auto')
  const [workerModel, setWorkerModel] = useState<string>('')

  React.useEffect(() => {
    if (!runtimeConfig) {
      return
    }
    setGlobalModelName(runtimeConfig.model_name)
    setGlobalTaskType(runtimeConfig.task_type)
    setGlobalAccelerator(runtimeConfig.accelerator)
    setGlobalRuntime(runtimeConfig.runtime)
    setGlobalDtype(runtimeConfig.dtype)
    setGlobalProviders((runtimeConfig.providers || []).join(','))
  }, [runtimeConfig])

  const streamNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const stream of streams?.data || []) {
      map.set(stream.id, stream.stream_name)
    }
    return map
  }, [streams?.data])

  const openConfigDialog = (streamId: number) => {
    const worker = workers?.find((item) => item.stream_id === streamId)
    setConfigDialogStreamId(streamId)
    setWorkerRuntime(worker?.runtime || 'auto')
    setWorkerDtype(worker?.dtype || 'auto')
    setWorkerModel(worker?.model || '')
  }

  const applyGlobalRuntime = (applyToRunning: boolean) => {
    updateRuntime.mutate({
      model_name: globalModelName,
      task_type: globalTaskType,
      accelerator: globalAccelerator,
      runtime: globalRuntime,
      dtype: globalDtype,
      providers: globalProviders
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      apply_to_running: applyToRunning,
    })
  }

  return (
    <Box className="fade-in settings-page" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box className="page-header">
        <Box>
          <Typography variant="h4" className="page-header__title">
            Model Manager
          </Typography>
          <Typography variant="body2" color="text.secondary" className="page-header__subtitle">
            Manage runtimes, active workers and live model execution.
          </Typography>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6">Global Runtime Defaults</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These defaults are used by streams that do not define per-stream runtime overrides.
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Model</InputLabel>
              <Select
                value={globalModelName}
                label="Model"
                onChange={(event) => setGlobalModelName(event.target.value)}
              >
                {(runtimeConfig?.available_models || []).map((modelName) => (
                  <MenuItem key={modelName} value={modelName}>
                    {modelName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Task</InputLabel>
              <Select value={globalTaskType} label="Task" onChange={(event) => setGlobalTaskType(event.target.value)}>
                {(runtimeConfig?.available_task_types || []).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Accelerator</InputLabel>
              <Select
                value={globalAccelerator}
                label="Accelerator"
                onChange={(event) => setGlobalAccelerator(event.target.value)}
              >
                {(runtimeConfig?.available_accelerators || []).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Runtime</InputLabel>
              <Select value={globalRuntime} label="Runtime" onChange={(event) => setGlobalRuntime(event.target.value)}>
                <MenuItem value="auto">auto</MenuItem>
                {(runtimes?.options || []).map((item) => (
                  <MenuItem key={item.id} value={item.id} disabled={!item.available}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>DType</InputLabel>
              <Select value={globalDtype} label="DType" onChange={(event) => setGlobalDtype(event.target.value)}>
                <MenuItem value="auto">auto</MenuItem>
                <MenuItem value="fp32">fp32</MenuItem>
                <MenuItem value="fp16">fp16</MenuItem>
                <MenuItem value="int8">int8</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="ONNX Providers (comma-separated)"
              value={globalProviders}
              onChange={(event) => setGlobalProviders(event.target.value)}
              placeholder="CUDAExecutionProvider,CPUExecutionProvider"
            />
          </Stack>

          <Alert severity="info" sx={{ mb: 2 }}>
            {runtimeConfig?.affected_running_workers || 0} running workers currently inherit global defaults.
          </Alert>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => applyGlobalRuntime(false)} disabled={updateRuntime.isPending}>
              Save only
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                const shouldApply = window.confirm(
                  `Apply and restart ${runtimeConfig?.affected_running_workers || 0} running workers that inherit global defaults?`,
                )
                if (shouldApply) {
                  applyGlobalRuntime(true)
                }
              }}
              disabled={updateRuntime.isPending}
            >
              Save and restart now
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Runtimes and Hardware</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1.5}>
            {(runtimes?.options || []).map((item) => (
              <Box
                key={item.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1">{item.label}</Typography>
                  <Stack direction="row" spacing={1}>
                    {runtimes?.recommended_runtime === item.id && (
                      <Chip size="small" color="success" label="Recommended" />
                    )}
                    <Chip
                      size="small"
                      color={item.available ? 'success' : 'default'}
                      label={item.available ? 'Available' : 'Unavailable'}
                    />
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Devices: {item.supported_devices.join(', ') || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DTypes: {item.supported_dtypes.join(', ') || '-'}
                </Typography>
                {!item.available && item.reason && (
                  <Typography variant="caption" color="warning.main">
                    {item.reason}
                  </Typography>
                )}
                {item.variants.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    {item.variants.map((variant) => (
                      <Tooltip key={variant.id} title={variant.reason || ''}>
                        <Chip size="small" label={variant.label} color={variant.available ? 'success' : 'default'} />
                      </Tooltip>
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="h6">Active Workers</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                color="warning"
                variant="outlined"
                onClick={() => {
                  if (window.confirm('Stop all running workers?')) {
                    stopAllWorkers.mutate()
                  }
                }}
              >
                Stop all
              </Button>
              <Button
                color="primary"
                variant="contained"
                onClick={() => {
                  if (window.confirm('Restart all active workers?')) {
                    restartAllWorkers.mutate()
                  }
                }}
              >
                Restart all
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Stream</TableCell>
                <TableCell>Model</TableCell>
                <TableCell>Runtime</TableCell>
                <TableCell>Accelerator</TableCell>
                <TableCell>FPS</TableCell>
                <TableCell>Latency</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(workers || []).map((worker) => {
                const streamName = streamNameById.get(worker.stream_id) || `stream-${worker.stream_id}`
                const streamMetric = metrics?.per_stream?.[worker.stream_id]

                return (
                  <TableRow key={worker.stream_id}>
                    <TableCell>{streamName}</TableCell>
                    <TableCell>{worker.model}</TableCell>
                    <TableCell>{worker.runtime}</TableCell>
                    <TableCell>{worker.accelerator}</TableCell>
                    <TableCell>{streamMetric?.fps?.toFixed(1) || worker.fps.toFixed(1)}</TableCell>
                    <TableCell>
                      {streamMetric?.avg_inference_time_ms?.toFixed(1) || worker.avg_inference_ms.toFixed(1)} ms
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => startWorker.mutate(worker.stream_id)}>
                          Start
                        </Button>
                        <Button size="small" color="warning" onClick={() => stopWorker.mutate(worker.stream_id)}>
                          Stop
                        </Button>
                        <Button size="small" onClick={() => restartWorker.mutate(worker.stream_id)}>
                          Restart
                        </Button>
                        <Button size="small" onClick={() => openConfigDialog(worker.stream_id)}>
                          Configure
                        </Button>
                        <Button
                          size="small"
                          onClick={() => warmupWorker.mutate({ streamId: worker.stream_id, iterations: 3 })}
                        >
                          Warmup
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={configDialogStreamId !== null}
        onClose={() => setConfigDialogStreamId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Configure worker runtime</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Model"
              value={workerModel}
              onChange={(event) => setWorkerModel(event.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Runtime</InputLabel>
              <Select value={workerRuntime} label="Runtime" onChange={(event) => setWorkerRuntime(event.target.value)}>
                <MenuItem value="auto">auto</MenuItem>
                {(runtimes?.options || []).map((item) => (
                  <MenuItem key={item.id} value={item.id} disabled={!item.available}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>DType</InputLabel>
              <Select value={workerDtype} label="DType" onChange={(event) => setWorkerDtype(event.target.value)}>
                <MenuItem value="auto">auto</MenuItem>
                <MenuItem value="fp32">fp32</MenuItem>
                <MenuItem value="fp16">fp16</MenuItem>
                <MenuItem value="int8">int8</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogStreamId(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (configDialogStreamId === null) {
                return
              }
              updateWorkerConfig.mutate({
                streamId: configDialogStreamId,
                data: {
                  model_name: workerModel,
                  runtime: workerRuntime,
                  dtype: workerDtype,
                },
              })
              setConfigDialogStreamId(null)
            }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Models
