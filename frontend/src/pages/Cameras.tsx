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
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { cameraApi } from '../services/api';
import { Camera } from '../types';

const Cameras: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rtsp_url: '',
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: cameras, isLoading } = useQuery('cameras', cameraApi.getAll);

  const createMutation = useMutation(cameraApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('cameras');
      handleClose();
    },
  });

  const updateMutation = useMutation(
    (data: { id: number; camera: Partial<Camera> }) =>
      cameraApi.update(data.id, data.camera),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('cameras');
        handleClose();
      },
    }
  );

  const deleteMutation = useMutation(cameraApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('cameras');
    },
  });

  const handleOpen = (camera?: Camera) => {
    if (camera) {
      setSelectedCamera(camera);
      setFormData({
        name: camera.name,
        rtsp_url: camera.rtsp_url,
        is_active: camera.is_active,
      });
    } else {
      setSelectedCamera(null);
      setFormData({
        name: '',
        rtsp_url: '',
        is_active: true,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedCamera(null);
    setFormData({
      name: '',
      rtsp_url: '',
      is_active: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCamera) {
      updateMutation.mutate({
        id: selectedCamera.id,
        camera: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Cameras</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Camera
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {cameras?.data.map((camera) => (
          <Box key={camera.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{camera.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  {camera.rtsp_url}
                </Typography>
                <Typography
                  color={camera.is_active ? 'success.main' : 'error.main'}
                >
                  {camera.is_active ? 'Active' : 'Inactive'}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton
                    color="primary"
                    onClick={() => handleOpen(camera)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => deleteMutation.mutate(camera.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {selectedCamera ? 'Edit Camera' : 'Add Camera'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <TextField
              margin="dense"
              label="RTSP URL"
              fullWidth
              value={formData.rtsp_url}
              onChange={(e) =>
                setFormData({ ...formData, rtsp_url: e.target.value })
              }
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedCamera ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Cameras;