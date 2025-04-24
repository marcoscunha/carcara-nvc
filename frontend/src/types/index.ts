export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stream {
  id: number;
  camera_id: number;
  status: string;
  current_frame: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Detection {
  id: number;
  camera_id: number;
  stream_id: number;
  frame_number: number;
  timestamp: string;
  model_name: string;
  confidence: number;
  class_name: string;
  bbox: number[];
  metadata: Record<string, any>;
}

export interface Alarm {
  id: number;
  name: string;
  camera_id: number;
  class_name: string;
  confidence_threshold: number;
  region_of_interest: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Model {
  name: string;
  description: string;
  is_available: boolean;
}

export interface RegionOfInterest {
  id: number;
  name: string;
  camera_id: number;
  points: number[][];
  created_at: string;
  updated_at: string;
}