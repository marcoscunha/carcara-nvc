import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import ReactPlayer from 'react-player';
import { streamApi, cameraApi } from '../services/api';

const Streams: React.FC = () => {
  const [fullscreenStream, setFullscreenStream] = useState<number | null>(null);

  const { data: streams, isLoading: streamsLoading } = useQuery(
    'streams',
    streamApi.getAll
  );
  const { data: cameras, isLoading: camerasLoading } = useQuery(
    'cameras',
    cameraApi.getAll
  );

  if (streamsLoading || camerasLoading) {
    return <Typography>Loading...</Typography>;
  }

  const handleFullscreen = (streamId: number) => {
    setFullscreenStream(streamId);
  };

  const handleCloseFullscreen = () => {
    setFullscreenStream(null);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Live Streams
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {streams?.data.map((stream) => {
          const camera = cameras?.data.find((c) => c.id === stream.camera_id);
          if (!camera) return null;

          return (
            <Box key={stream.id}>
              <Card>
                <CardContent>
                  <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
                    <ReactPlayer
                      url={camera.rtsp_url}
                      width="100%"
                      height="100%"
                      playing
                      controls
                      style={{ position: 'absolute', top: 0, left: 0 }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mt: 1,
                    }}
                  >
                    <Typography variant="h6">{camera.name}</Typography>
                    <IconButton
                      onClick={() => handleFullscreen(stream.id)}
                      color="primary"
                    >
                      <FullscreenIcon />
                    </IconButton>
                  </Box>
                  <Typography color="textSecondary">
                    Status: {stream.status}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          );
        })}
      </Box>

      <Dialog
        open={fullscreenStream !== null}
        onClose={handleCloseFullscreen}
        maxWidth="xl"
        fullWidth
      >
        <DialogContent>
          {fullscreenStream && (
            <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
              <ReactPlayer
                url={
                  cameras?.data.find(
                    (c) =>
                      c.id ===
                      streams?.data.find((s) => s.id === fullscreenStream)
                        ?.camera_id
                  )?.rtsp_url
                }
                width="100%"
                height="100%"
                playing
                controls
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
              <IconButton
                onClick={handleCloseFullscreen}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                  },
                }}
              >
                <FullscreenExitIcon />
              </IconButton>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Streams;