import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import { useInferenceRuntimeConfig, useRuntimes, useUpdateInferenceRuntimeConfig } from '../../hooks/useQueries'

const RuntimeDefaultsPanel: React.FC = () => {
  const { data: runtimeConfig } = useInferenceRuntimeConfig()
  const { data: runtimes } = useRuntimes()
  const updateRuntime = useUpdateInferenceRuntimeConfig()

  const [globalModelName, setGlobalModelName] = useState<string>('')
  const [globalTaskType, setGlobalTaskType] = useState<string>('detect')
  const [globalAccelerator, setGlobalAccelerator] = useState<string>('cpu')
  const [globalRuntime, setGlobalRuntime] = useState<string>('auto')
  const [globalDtype, setGlobalDtype] = useState<string>('auto')
  const [globalProviders, setGlobalProviders] = useState<string>('')

  useEffect(() => {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
    </Box>
  )
}

export default RuntimeDefaultsPanel
