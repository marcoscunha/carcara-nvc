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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { alarmApi, cameraApi, modelApi } from '../services/api';
import { Alarm } from '../types';

const Alarms: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    camera_id: 0,
    class_name: '',
    confidence_threshold: 0.5,
    region_of_interest: [0, 0, 100, 100],
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: alarms, isLoading: alarmsLoading } = useQuery(
    'alarms',
    alarmApi.getAll
  );
  const { data: cameras, isLoading: camerasLoading } = useQuery(
    'cameras',
    cameraApi.getAll
  );
  const { data: models, isLoading: modelsLoading } = useQuery(
    'models',
    modelApi.getAll
  );

  const createMutation = useMutation(alarmApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('alarms');
      handleClose();
    },
  });

  const updateMutation = useMutation(
    (data: { id: number; alarm: Partial<Alarm> }) =>
      alarmApi.update(data.id, data.alarm),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('alarms');
        handleClose();
      },
    }
  );

  const deleteMutation = useMutation(alarmApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('alarms');
    },
  });

  const handleOpen = (alarm?: Alarm) => {
    if (alarm) {
      setSelectedAlarm(alarm);
      setFormData({
        name: alarm.name,
        camera_id: alarm.camera_id,
        class_name: alarm.class_name,
        confidence_threshold: alarm.confidence_threshold,
        region_of_interest: alarm.region_of_interest,
        is_active: alarm.is_active,
      });
    } else {
      setSelectedAlarm(null);
      setFormData({
        name: '',
        camera_id: 0,
        class_name: '',
        confidence_threshold: 0.5,
        region_of_interest: [0, 0, 100, 100],
        is_active: true,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedAlarm(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAlarm) {
      updateMutation.mutate({
        id: selectedAlarm.id,
        alarm: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (alarmsLoading || camerasLoading || modelsLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Alarms</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Alarm
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {alarms?.data.map((alarm) => (
          <Box key={alarm.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{alarm.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  Camera: {cameras?.data.find(c => c.id === alarm.camera_id)?.name}
                </Typography>
                <Typography>
                  Class: {alarm.class_name}
                </Typography>
                <Typography>
                  Confidence: {alarm.confidence_threshold}
                </Typography>
                <Typography
                  color={alarm.is_active ? 'success.main' : 'error.main'}
                >
                  {alarm.is_active ? 'Active' : 'Inactive'}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton
                    color="primary"
                    onClick={() => handleOpen(alarm)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => deleteMutation.mutate(alarm.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAlarm ? 'Edit Alarm' : 'Add Alarm'}
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
            <FormControl fullWidth margin="dense">
              <InputLabel>Camera</InputLabel>
              <Select
                value={formData.camera_id}
                onChange={(e) =>
                  setFormData({ ...formData, camera_id: Number(e.target.value) })
                }
              >
                {cameras?.data.map((camera) => (
                  <MenuItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel>Object Class</InputLabel>
              <Select
                value={formData.class_name}
                onChange={(e) =>
                  setFormData({ ...formData, class_name: e.target.value })
                }
              >
                {models?.data.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ mt: 2 }}>
              <Typography gutterBottom>Confidence Threshold</Typography>
              <Slider
                value={formData.confidence_threshold}
                onChange={(_, value) =>
                  setFormData({ ...formData, confidence_threshold: value as number })
                }
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedAlarm ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Alarms;