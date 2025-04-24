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
  Slider,
  Button,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { modelApi } from '../services/api';
import { Model } from '../types';

const Settings: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);

  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery('models', modelApi.getAll);

  const updateMutation = useMutation(
    (data: { name: string; confidence: number }) =>
      modelApi.update(data.name, { confidence_threshold: data.confidence }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('models');
      },
    }
  );

  const handleSave = () => {
    if (selectedModel) {
      updateMutation.mutate({
        name: selectedModel,
        confidence: confidenceThreshold,
      });
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  const modelList = models?.data || [];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Object Detection Settings
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={selectedModel}
              label="Model"
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {modelList.map((model: Model) => (
                <MenuItem key={model.name} value={model.name}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>Confidence Threshold</Typography>
            <Slider
              value={confidenceThreshold}
              onChange={(_, value) => setConfidenceThreshold(value as number)}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!selectedModel}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;