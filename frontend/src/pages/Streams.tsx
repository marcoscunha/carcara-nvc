import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { streamApi, cameraApi } from '../services/api';
import { Stream, Camera } from '../types';

const Streams: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [formData, setFormData] = useState({
    camera_id: 0,
    status: 'stopped',
    current_frame: 0,
    metadata: {},
  });

  const queryClient = useQueryClient();

  const { data: streams, isLoading: streamsLoading } = useQuery('streams', streamApi.getAll);
  const { data: cameras, isLoading: camerasLoading } = useQuery('cameras', cameraApi.getAll);

  const createMutation = useMutation(streamApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('streams');
      handleClose();
    },
  });

  const updateMutation = useMutation(
    (data: { id: number; stream: Partial<Stream> }) =>
      streamApi.update(data.id, data.stream),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('streams');
        handleClose();
      },
    }
  );

  const deleteMutation = useMutation(streamApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('streams');
    },
  });

  const handleOpen = (stream?: Stream) => {
    if (stream) {
      setSelectedStream(stream);
      setFormData({
        camera_id: stream.camera_id,
        status: stream.status,
        current_frame: stream.current_frame,
        metadata: stream.metadata,
      });
    } else {
      setSelectedStream(null);
      setFormData({
        camera_id: 0,
        status: 'stopped',
        current_frame: 0,
        metadata: {},
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedStream(null);
    setFormData({
      camera_id: 0,
      status: 'stopped',
      current_frame: 0,
      metadata: {},
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStream) {
      updateMutation.mutate({
        id: selectedStream.id,
        stream: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (streamsLoading || camerasLoading) {
    return <Typography>Loading...</Typography>;
  }

  const streamList = streams?.data || [];
  const cameraList = cameras?.data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Streams</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Stream
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {streamList.map((stream: Stream) => {
          const camera = cameraList.find((c: Camera) => c.id === stream.camera_id);
          return (
            <Box key={stream.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{camera?.name || 'Unknown Camera'}</Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Status: {stream.status}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    Frame: {stream.current_frame}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
                      color="primary"
                      onClick={() => handleOpen(stream)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => deleteMutation.mutate(stream.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {selectedStream ? 'Edit Stream' : 'Add Stream'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Camera</InputLabel>
              <Select
                value={formData.camera_id}
                label="Camera"
                onChange={(e) =>
                  setFormData({ ...formData, camera_id: Number(e.target.value) })
                }
              >
                {cameraList.map((camera: Camera) => (
                  <MenuItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedStream ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Streams;