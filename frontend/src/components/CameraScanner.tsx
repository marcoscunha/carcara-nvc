import React, { useState } from 'react';
import { Button, List, ListItem, ListItemText, Typography, Box, CircularProgress } from '@mui/material';
import { cameraApi, CameraInfo } from '../services/api';

export const CameraScanner: React.FC = () => {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cameraApi.scan();
      setCameras(response.data);
    } catch (err) {
      setError('Failed to scan for cameras');
      console.error('Error scanning cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = async (camera: CameraInfo) => {
    try {
      await cameraApi.create({
        name: camera.name,
        device_id: camera.device_id,
        camera_type: 'local',
        is_active: true,
        resolution: camera.resolution,
        fps: camera.fps,
        is_available: camera.is_available,
      });
      // Refresh the camera list
      handleScan();
    } catch (err) {
      console.error('Error adding camera:', err);
    }
  };

  return (
    <Box>
      <Button
        variant="contained"
        onClick={handleScan}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? <CircularProgress size={24} /> : 'Scan for Cameras'}
      </Button>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {cameras.length > 0 && (
        <List>
          {cameras.map((camera) => (
            <ListItem
              key={camera.device_id}
              secondaryAction={
                <Button
                  variant="outlined"
                  onClick={() => handleAddCamera(camera)}
                >
                  Add Camera
                </Button>
              }
            >
              <ListItemText
                primary={camera.name || `Camera ${camera.device_id}`}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.primary">
                      Resolution: {camera.resolution[0]}x{camera.resolution[1]}
                    </Typography>
                    <br />
                    <Typography component="span" variant="body2" color="text.primary">
                      FPS: {camera.fps}
                    </Typography>
                    <br />
                    <Typography component="span" variant="body2" color="text.primary">
                      Physical Address: {camera.physical_address || 'N/A'}
                    </Typography>
                    <br />
                    <Typography component="span" variant="body2" color="text.primary">
                      USB ID: {camera.usb_id || 'N/A'}
                    </Typography>
                    <br />
                    <Typography component="span" variant="body2" color="text.primary">
                      Supported Resolutions: {camera.supported_resolutions.map(
                        ([width, height]) => `${width}x${height}`
                      ).join(', ')}
                    </Typography>
                    <br />
                    <Typography
                      component="span"
                      variant="body2"
                      color={camera.is_available ? 'success.main' : 'error.main'}
                    >
                      Status: {camera.is_available ? 'Available' : 'Not Available'}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};