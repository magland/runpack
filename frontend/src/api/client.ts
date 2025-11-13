import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AdminStatsResponse,
  AdminJobsResponse,
  AdminRunnersResponse,
  AdminJobDetailResponse,
  AdminRunnerDetailResponse,
  SubmitJobRequest,
  SubmitJobResponse,
  JobStatus,
} from '../types';

const API_BASE_URL = 'https://runpack-worker.neurosift.app';

class ApiClient {
  private adminClient: AxiosInstance;
  private submitClient: AxiosInstance;

  constructor() {
    this.adminClient = axios.create({
      baseURL: API_BASE_URL,
    });

    this.submitClient = axios.create({
      baseURL: API_BASE_URL,
    });

    // Add request interceptor to include API keys
    this.adminClient.interceptors.request.use((config) => {
      const keys = this.getStoredKeys();
      if (keys.adminApiKey) {
        config.headers.Authorization = `Bearer ${keys.adminApiKey}`;
      }
      return config;
    });

    this.submitClient.interceptors.request.use((config) => {
      const keys = this.getStoredKeys();
      if (keys.submitApiKey) {
        config.headers.Authorization = `Bearer ${keys.submitApiKey}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    const errorHandler = (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Unauthorized - redirect to settings
        window.location.href = '/settings';
      }
      return Promise.reject(error);
    };

    this.adminClient.interceptors.response.use(
      (response) => response,
      errorHandler
    );

    this.submitClient.interceptors.response.use(
      (response) => response,
      errorHandler
    );
  }

  private getStoredKeys() {
    const stored = localStorage.getItem('runpack_api_keys');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { adminApiKey: '', submitApiKey: '' };
      }
    }
    return { adminApiKey: '', submitApiKey: '' };
  }

  // Admin endpoints
  async getStats(): Promise<AdminStatsResponse> {
    const response = await this.adminClient.get<AdminStatsResponse>('/api/admin/stats');
    return response.data;
  }

  async getJobs(status?: JobStatus, limit?: number): Promise<AdminJobsResponse> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    
    const response = await this.adminClient.get<AdminJobsResponse>(
      `/api/admin/jobs${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response.data;
  }

  async getJobDetail(jobId: string): Promise<AdminJobDetailResponse> {
    const response = await this.adminClient.get<AdminJobDetailResponse>(
      `/api/admin/jobs/${jobId}`
    );
    return response.data;
  }

  async getRunners(): Promise<AdminRunnersResponse> {
    const response = await this.adminClient.get<AdminRunnersResponse>('/api/admin/runners');
    return response.data;
  }

  async getRunnerDetail(runnerId: string): Promise<AdminRunnerDetailResponse> {
    const response = await this.adminClient.get<AdminRunnerDetailResponse>(
      `/api/admin/runners/${runnerId}`
    );
    return response.data;
  }

  // Job submission endpoint
  async submitJob(request: SubmitJobRequest): Promise<SubmitJobResponse> {
    const response = await this.submitClient.post<SubmitJobResponse>(
      '/api/jobs/submit',
      request
    );
    return response.data;
  }

  // Delete job endpoints
  async deleteJob(jobId: string): Promise<void> {
    await this.adminClient.delete(`/api/admin/jobs/${jobId}`);
  }

  async deleteJobs(jobIds: string[]): Promise<{ success: boolean; deleted: number; failed: string[] }> {
    const response = await this.adminClient.post<{ success: boolean; deleted: number; failed: string[] }>(
      '/api/admin/jobs/batch-delete',
      { job_ids: jobIds }
    );
    return response.data;
  }
}

export const apiClient = new ApiClient();
