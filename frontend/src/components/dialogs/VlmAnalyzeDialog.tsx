import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { AutoAwesome as AutoAwesomeIcon, Speed as SpeedIcon } from '@mui/icons-material'

import { vlmApi } from '../../services/api'
import { useVlmStatus } from '../../hooks/useQueries'
import type { Stream, VlmFrameEvent, VlmStreamStats } from '../../types'
import { isVlmDebugStagesEnabled, subscribeVlmDebugStages } from '../../utils/vlmDebugStages'

export interface VlmAnalyzeDialogProps {
  open: boolean
  onClose: () => void
  stream: Stream | null
  streamName?: string
}

const DEFAULT_PROMPT = 'Describe what is happening in this stream.'

const STAGE_LABELS: Record<string, string> = {
  processing: 'Processing image…',
  generating: 'Generating description…',
}

type DebugEvent = {
  label: string
  at: string
}

export const VlmAnalyzeDialog: React.FC<VlmAnalyzeDialogProps> = ({ open, onClose, stream, streamName }) => {
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT)
  const [isStreaming, setIsStreaming] = useState(false)
  const [frame, setFrame] = useState<VlmFrameEvent | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [stats, setStats] = useState<VlmStreamStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([])
  const [showDebugStages, setShowDebugStages] = useState(() => isVlmDebugStagesEnabled())
  const { data: status } = useVlmStatus()
  const abortRef = useRef<AbortController | null>(null)
  const sawFirstTokenRef = useRef(false)

  const addDebugEvent = (label: string) => {
    if (!showDebugStages) {
      return
    }
    const at = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })
    setDebugEvents((prev) => [...prev, { label, at }])
  }

  const resetOutput = () => {
    setFrame(null)
    setStage(null)
    setAnswer('')
    setStats(null)
    setError(null)
    setDebugEvents([])
    sawFirstTokenRef.current = false
  }

  useEffect(() => {
    if (open) {
      setPrompt(DEFAULT_PROMPT)
      resetOutput()
    } else {
      abortRef.current?.abort()
      abortRef.current = null
      setIsStreaming(false)
    }
  }, [open])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    return subscribeVlmDebugStages(() => setShowDebugStages(isVlmDebugStagesEnabled()))
  }, [])

  const handleAnalyze = async () => {
    if (!stream) {
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    resetOutput()
    setIsStreaming(true)
    addDebugEvent('request_sent')

    try {
      await vlmApi.analyzeStream(
        { stream_id: stream.id, prompt: prompt.trim() || undefined },
        {
          onFrame: (f) => {
            setFrame(f)
            addDebugEvent('frame_received')
          },
          onStage: (s) => {
            setStage(s)
            addDebugEvent(`stage:${s}`)
          },
          onToken: (text) => {
            if (!sawFirstTokenRef.current) {
              sawFirstTokenRef.current = true
              addDebugEvent('first_token')
            }
            setAnswer((prev) => prev + text)
          },
          onStats: (s) => {
            setStats(s)
            addDebugEvent(`stats:${s.tokens_per_second}tok/s`)
          },
          onDone: () => addDebugEvent('done'),
          onError: (detail) => {
            setError(detail)
            addDebugEvent(`error:${detail}`)
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
        addDebugEvent('error:request_failed')
      } else {
        addDebugEvent('aborted')
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setStage(null)
      setIsStreaming(false)
    }
  }

  const handleClose = () => {
    abortRef.current?.abort()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      PaperProps={{ sx: { mt: '8vh', maxHeight: '84vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon fontSize="small" />
        Analyze stream with VLM
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          {stream && (
            <Typography variant="body2" color="text.secondary">
              Grabbing the latest frame from{' '}
              <strong>{streamName || stream.stream_name || `stream ${stream.id}`}</strong> and streaming the response
              from the configured VLM.
            </Typography>
          )}

          {status && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`backend: ${status.backend}`} variant="outlined" />
              <Chip size="small" label={`model: ${status.model}`} variant="outlined" />
            </Box>
          )}

          <TextField
            label="Prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={isStreaming}
          />

          {frame && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Frame used for evaluation
              </Typography>
              <Box
                component="img"
                src={frame.image_base64}
                alt="Frame analyzed by the VLM"
                sx={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'black',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {frame.width} × {frame.height}
              </Typography>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {(isStreaming || answer) && !error && (
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, minHeight: 24 }}
              >
                <Typography variant="subtitle2">Result</Typography>
                {stats ? (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    icon={<SpeedIcon />}
                    label={`${stats.tokens_per_second} tok/s`}
                  />
                ) : (
                  isStreaming &&
                  stage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CircularProgress size={12} />
                      <Typography variant="caption" color="text.secondary">
                        {STAGE_LABELS[stage] ?? stage}
                      </Typography>
                    </Box>
                  )
                )}
              </Box>
              <Alert severity="success" icon={false} sx={{ whiteSpace: 'pre-wrap' }}>
                {answer || (isStreaming ? '…' : '')}
                {isStreaming && answer && <CircularProgress size={12} sx={{ ml: 1, verticalAlign: 'middle' }} />}
              </Alert>
              {stats && (
                <Typography variant="caption" color="text.secondary">
                  {stats.tokens} tokens in {stats.elapsed_s}s
                </Typography>
              )}
            </Box>
          )}

          {showDebugStages && debugEvents.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Debug trace
              </Typography>
              <Alert severity="info" icon={false} sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {debugEvents.map((event) => `${event.at}  ${event.label}`).join('\n')}
              </Alert>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        <Button
          variant="contained"
          onClick={handleAnalyze}
          disabled={!stream || isStreaming}
          startIcon={isStreaming ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          sx={{ minWidth: 140 }}
        >
          {isStreaming ? 'Analyzing...' : 'Analyze'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
