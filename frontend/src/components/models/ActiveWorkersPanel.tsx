import React, { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
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
  Typography,
} from '@mui/material'

import {
  useInferenceWorkers,
  useRealtimeInferenceMetrics,
  useRestartAllWorkers,
  useRestartWorker,
  useRuntimes,
  useStartWorker,
  useStopAllWorkers,
  useStopWorker,
  useStreams,
  useUpdateWorkerConfig,
  useWarmupWorker,
} from '../../hooks/useQueries'

const ActiveWorkersPanel: React.FC = () => {
  const { data: workers } = useInferenceWorkers()
  const { data: streams } = useStreams()
  const { data: metrics } = useRealtimeInferenceMetrics()
  const { data: runtimes } = useRuntimes()

  const startWorker = useStartWorker()
  const stopWorker = useStopWorker()
  const restartWorker = useRestartWorker()
  const updateWorkerConfig = useUpdateWorkerConfig()
  const warmupWorker = useWarmupWorker()
  const stopAllWorkers = useStopAllWorkers()
  const restartAllWorkers = useRestartAllWorkers()

  const [configDialogStreamId, setConfigDialogStreamId] = useState<number | null>(null)
  const [workerRuntime, setWorkerRuntime] = useState<string>('auto')
  const [workerDtype, setWorkerDtype] = useState<string>('auto')
  const [workerModel, setWorkerModel] = useState<string>('')

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

  return (
    <>
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
    </>
  )
}

export default ActiveWorkersPanel
