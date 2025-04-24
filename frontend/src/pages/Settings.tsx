import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  SelectChangeEvent,
} from '@mui/material';
import { useQuery } from 'react-query';
import { modelApi } from '../services/api';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    defaultModel: 'yolov8n.pt',
    confidenceThreshold: 0.5,
    useGpu: false,
    cudaDevice: '0',
  });

  const { data: models, isLoading } = useQuery('models', modelApi.getAll);

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    setSettings({ ...settings, defaultModel: event.target.value });
  };

  const handleConfidenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      confidenceThreshold: parseFloat(event.target.value),
    });
  };

  const handleGpuChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, useGpu: event.target.checked });
  };

  const handleCudaDeviceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, cudaDevice: event.target.value });
  };

  const handleSave = () => {
    // TODO: Implement settings save
    console.log('Saving settings:', settings);
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Object Detection Settings
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Default Model</InputLabel>
                <Select
                  value={settings.defaultModel}
                  onChange={handleModelChange}
                >
                  {models?.data.map((model) => (
                    <MenuItem key={model.name} value={model.name}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                margin="normal"
                label="Confidence Threshold"
                type="number"
                value={settings.confidenceThreshold}
                onChange={handleConfidenceChange}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
              />
            </CardContent>
          </Card>
        </Box>

        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hardware Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.useGpu}
                    onChange={handleGpuChange}
                  />
                }
                label="Use GPU"
              />
              {settings.useGpu && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="CUDA Device"
                  value={settings.cudaDevice}
                  onChange={handleCudaDeviceChange}
                  helperText="Enter the CUDA device ID (e.g., 0, 1, 2)"
                />
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={handleSave}>
          Save Settings
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;