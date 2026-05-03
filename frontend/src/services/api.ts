import axios, { AxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Dashboard
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  activities: () => api.get('/dashboard/activities'),
};

// Clients
export const clientApi = {
  list: (params?: any) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.patch(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
};

// Time Entries
export const timeApi = {
  list: (params?: any) => api.get('/time-entries', { params }),
  create: (data: any) => api.post('/time-entries', data),
  weekly: () => api.get('/time-entries/summary/weekly'),
  delete: (id: string) => api.delete(`/time-entries/${id}`),
};

// Transactions
export const transactionApi = {
  list: (params?: any) => api.get('/transactions', { params }),
  categorize: (id: string) => api.post(`/transactions/${id}/categorize`),
  confirm: (id: string, data: any) => api.post(`/transactions/${id}/confirm`, data),
  bulkCategorize: (ids: string[]) => api.post('/transactions/bulk-categorize', { ids }),
  seedDemo: () => api.post('/transactions/seed-demo'),
  exportCsv: (params?: any) => api.get('/transactions/export/csv', { params, responseType: 'blob' }),
};

// Advisory
export const advisoryApi = {
  opportunities: (params?: any) => api.get('/advisory/opportunities', { params }),
  detect: (data: any) => api.post('/advisory/detect', data),
  updateOpportunity: (id: string, data: any) => api.patch(`/advisory/opportunities/${id}`, data),
  dashboard: () => api.get('/advisory/dashboard'),
};

// Document Requests
export const documentApi = {
  list: (params?: any) => api.get('/document-requests', { params }),
  create: (data: any) => api.post('/document-requests', data),
  templates: () => api.get('/document-requests/templates/list'),
  sendReminder: (id: string) => api.post(`/document-requests/${id}/send-reminder`),
};

// Integrations
export const integrationApi = {
  list: () => api.get('/integrations'),
  connect: (data: any) => api.post('/integrations', data),
  providers: () => api.get('/integrations/providers/list'),
};

// Email Settings
export const emailSettingsApi = {
  get: () => api.get('/email-settings'),
  save: (data: any) => api.patch('/email-settings', data),
  test: () => api.post('/email-settings/test'),
};