// During local development Vite proxies this path to the FastAPI backend,
// keeping browser requests same-origin and avoiding CORS requirements.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiReport {
  id: string;
  filename: string;
  video_url: string | null;
  status: string;
  metadata: {
    duration: number | null;
    frame_count: number | null;
    fps: number | null;
    resolution?: string | null;
    codec?: string | null;
  };
}

export interface ApiIncident {
  id: string;
  type: string;
  title: string;
  timestamp: number;
  confidence: number;
  license_plate: string | null;
  ocr_confidence: number | null;
  evidence_url: string | null;
  status: string;
  reward_credits: number;
  details: Record<string, unknown>;
}

export interface Progress {
  frames_read: number;
  frames_remaining: number;
  current_timestamp: number;
  video_duration: number;
  percent_complete: number;
  estimated_time_remaining: number;
  current_stage: string;
  status: string;
  error: string | null;
}

export interface DashboardResponse {
  submitted: number; verified: number; pending: number; rejected: number; rewards: number;
  risk_index: number; safety_score: number; routes_analyzed: number;
}

export interface Submission {
  tracking_id: string | null;
  submitted_at: string;
  incident_count: number;
  reward_credits: number;
  government_response: string;
  delivery_mode: 'government' | 'mock';
  report_text: string | null;
}

type UploadProgressHandler = (percentComplete: number) => void;

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      body.detail || body.errors?.[0] || `Request failed (${response.status}).`,
      response.status,
    );
  }
  const body = await response.json() as T | { data: T };
  return typeof body === 'object' && body !== null && 'data' in body ? body.data : body as T;
}

export const api = {
  upload: (file: File, onProgress?: UploadProgressHandler) => {
    const data = new FormData();
    data.append('video', file);
    // Fetch deliberately does not expose upload progress in browsers.  Use
    // XMLHttpRequest here so a large video does not look frozen at 10% while
    // its bytes are still being sent to the backend.
    return new Promise<ApiReport>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/upload`);
      request.responseType = 'json';
      request.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) return;
        // Keep 100% for a successful server response; the backend still needs
        // to validate the completed file after all bytes have been received.
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      });
      request.addEventListener('load', () => {
        const body = request.response || (() => {
          try { return JSON.parse(request.responseText); } catch { return {}; }
        })();
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(body?.detail || body?.errors?.[0] || `Request failed (${request.status}).`));
          return;
        }
        resolve(body && typeof body === 'object' && 'data' in body ? body.data as ApiReport : body as ApiReport);
      });
      request.addEventListener('error', () => reject(new Error('Network error while uploading the video.')));
      request.send(data);
    });
  },
  analyze: (id: string) => request(`/analyze/${id}`, { method: 'POST' }),
  progress: (id: string) => request<Progress>(`/reports/${id}/progress`),
  incidents: (id: string) => request<ApiIncident[]>(`/reports/${id}/incidents`),
  approve: (reportId: string, incidentId: string) => request<ApiIncident>(`/reports/${reportId}/incidents/${incidentId}/approve`, { method: 'POST' }),
  reject: (reportId: string, incidentId: string) => request<ApiIncident>(`/reports/${reportId}/incidents/${incidentId}/reject`, { method: 'POST' }),
  submit: (id: string) => request<Submission>(`/reports/${id}/submit`, { method: 'POST' }),
  dashboard: () => request<DashboardResponse>('/dashboard'),
  mediaUrl: (path: string | null) => path ? `${API_BASE}${path}` : '',
};
