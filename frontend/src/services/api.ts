import axios from 'axios';
import { Camera, Stream, Detection, Alarm, Model, RegionOfInterest } from '../types';

const API_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Camera endpoints
export const cameraApi = {
  getAll: () => api.get<Camera[]>('/cameras/'),
  getById: (id: number) => api.get<Camera>(`/cameras/${id}`),
  create: (data: Omit<Camera, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Camera>('/cameras/', data),
  update: (id: number, data: Partial<Camera>) =>
    api.put<Camera>(`/cameras/${id}`, data),
  delete: (id: number) => api.delete(`/cameras/${id}`),
};

// Stream endpoints
export const streamApi = {
  getAll: () => api.get<Stream[]>('/streams/'),
  getById: (id: number) => api.get<Stream>(`/streams/${id}`),
  create: (data: Omit<Stream, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Stream>('/streams/', data),
  update: (id: number, data: Partial<Stream>) =>
    api.put<Stream>(`/streams/${id}`, data),
  delete: (id: number) => api.delete(`/streams/${id}`),
};

// Detection endpoints
export const detectionApi = {
  getAll: (params?: { camera_id?: number; stream_id?: number }) =>
    api.get<Detection[]>('/detections/', { params }),
  getById: (id: number) => api.get<Detection>(`/detections/${id}`),
  create: (data: Omit<Detection, 'id' | 'timestamp'>) =>
    api.post<Detection>('/detections/', data),
  delete: (id: number) => api.delete(`/detections/${id}`),
};

// Alarm endpoints
export const alarmApi = {
  getAll: () => api.get<Alarm[]>('/alarms/'),
  getById: (id: number) => api.get<Alarm>(`/alarms/${id}`),
  create: (data: Omit<Alarm, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Alarm>('/alarms/', data),
  update: (id: number, data: Partial<Alarm>) =>
    api.put<Alarm>(`/alarms/${id}`, data),
  delete: (id: number) => api.delete(`/alarms/${id}`),
};

// Model endpoints
export const modelApi = {
  getAll: () => api.get<Model[]>('/models/'),
  getById: (name: string) => api.get<Model>(`/models/${name}`),
};

// Region of Interest endpoints
export const roiApi = {
  getAll: (camera_id: number) =>
    api.get<RegionOfInterest[]>(`/roi/`, { params: { camera_id } }),
  getById: (id: number) => api.get<RegionOfInterest>(`/roi/${id}`),
  create: (data: Omit<RegionOfInterest, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<RegionOfInterest>('/roi/', data),
  update: (id: number, data: Partial<RegionOfInterest>) =>
    api.put<RegionOfInterest>(`/roi/${id}`, data),
  delete: (id: number) => api.delete(`/roi/${id}`),
};