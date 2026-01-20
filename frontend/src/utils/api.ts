/**
 * API utility functions for TACN v2.0
 *
 * Provides common API request utilities for frontend components
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_V2_BASE_URL = import.meta.env.VITE_API_V2_BASE_URL || 'http://localhost:3001';

// Create axios instance for v1 API (Python backend)
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for v2 API (TypeScript backend)
const apiV2Client: AxiosInstance = axios.create({
  baseURL: API_V2_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available (support both v1 and v2 formats)
    const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Request interceptor for v2
apiV2Client.interceptors.request.use(
  (config) => {
    // Try auth-token first (v2 format), then fallback to auth-token (v1 format)
    const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          break;
        case 403:
          console.error('Access forbidden');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error('API error:', error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

// Response interceptor for v2
apiV2Client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        console.warn('[apiV2] 401 Unauthorized, clearing auth tokens');
        // Clear auth tokens
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth-token');
        localStorage.removeItem('refresh-token');
        localStorage.removeItem('user-info');
        // Redirect to login if not already there
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      console.error('API v2 error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// API request methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.get<T>(url, config);
  },

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.post<T>(url, data, config);
  },

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.put<T>(url, data, config);
  },

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.delete<T>(url, config);
  },

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.patch<T>(url, data, config);
  },
};

// Monitoring API endpoints
export const monitoringApi = {
  getStats: () => api.get('/api/monitoring/stats'),
  getEndpoints: (params?: any) => api.get('/api/monitoring/endpoints', { params }),
  getSlowestEndpoints: (limit = 10) => api.get(`/api/monitoring/endpoints/slowest?limit=${limit}`),
  getTopEndpoints: (limit = 10) => api.get(`/api/monitoring/endpoints/top?limit=${limit}`),
  getErrorEndpoints: (limit = 10) => api.get(`/api/monitoring/endpoints/errors?limit=${limit}`),
  getTimeSeries: (minutes = 60) => api.get(`/api/monitoring/timeseries?minutes=${minutes}`),
  getMetrics: () => api.get('/api/monitoring/metrics', { responseType: 'text' }),
  getSummary: () => api.get('/api/monitoring/summary'),
};

// API v2 endpoints (TypeScript backend)
export const apiV2 = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiV2Client.get<T>(url, config);
  },

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiV2Client.post<T>(url, data, config);
  },

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiV2Client.put<T>(url, data, config);
  },

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiV2Client.delete<T>(url, config);
  },
};

// Financial Data API v2 (MongoDB-backed)
export const financialDataApi = {
  // Health check
  getHealth: () => apiV2.get('/api/v2/financial-data/health'),

  // Query financial data
  query: (symbol: string, params?: { report_period?: string; data_source?: string; limit?: number }) =>
    apiV2.get(`/api/v2/financial-data/query/${symbol}`, { params }),

  // POST query
  queryPost: (symbol: string, params?: any) =>
    apiV2.post('/api/v2/financial-data/query', { symbol, ...params }),

  // Get latest financial data
  getLatest: (symbol: string) =>
    apiV2.get(`/api/v2/financial-data/latest/${symbol}`),

  // Get statistics
  getStatistics: () =>
    apiV2.get('/api/v2/financial-data/statistics'),
};

// Historical Data API v2 (MongoDB-backed)
export const historicalDataApi = {
  // Health check
  getHealth: () => apiV2.get('/api/v2/historical-data/health'),

  // Query historical data
  query: (symbol: string, params?: { start_date?: string; end_date?: string; data_source?: string; period?: string; limit?: number }) =>
    apiV2.get(`/api/v2/historical-data/query/${symbol}`, { params }),

  // POST query
  queryPost: (symbol: string, params?: any) =>
    apiV2.post('/api/v2/historical-data/query', { symbol, ...params }),

  // Get latest date
  getLatestDate: (symbol: string) =>
    apiV2.get(`/api/v2/historical-data/latest-date/${symbol}`),

  // Get statistics
  getStatistics: () =>
    apiV2.get('/api/v2/historical-data/statistics'),

  // Compare data sources
  compare: (symbol: string) =>
    apiV2.get(`/api/v2/historical-data/compare/${symbol}`),
};

// Stock Data API v2
export const stockDataApi = {
  // Health check
  getHealth: () => apiV2.get('/api/v2/stocks/health'),

  // Get stock list
  getStockList: (params?: { page?: number; pageSize?: number; market?: string }) =>
    apiV2.get('/api/v2/stocks/list', { params }),

  // Search stocks
  searchStocks: (keyword: string, limit?: number) =>
    apiV2.get(`/api/v2/stocks/search?q=${encodeURIComponent(keyword)}${limit ? `&limit=${limit}` : ''}`),

  // Get stock quote
  getQuote: (code: string) =>
    apiV2.get(`/api/v2/stocks/${code}/quote`),

  // Batch get quotes
  getBatchQuotes: (codes: string[]) =>
    apiV2.post('/api/v2/stocks/quotes/batch', { codes }),

  // Get K-line data
  getKline: (code: string, params?: { interval?: string; start?: string; end?: string; limit?: number }) =>
    apiV2.get(`/api/v2/stocks/${code}/kline`, { params }),

  // Get combined data
  getCombined: (code: string) =>
    apiV2.get(`/api/v2/stocks/${code}/combined`),

  // Get markets summary
  getMarketsSummary: () =>
    apiV2.get('/api/v2/stocks/markets/summary'),

  // Get sync status
  getSyncStatus: () =>
    apiV2.get('/api/v2/stocks/sync-status'),
};

// Analysis API v2
export const analysisApi = {
  // Health check
  getHealth: () => apiV2.get('/api/v2/analysis/health'),

  // Analysis operations
  analyze: (payload: any) =>
    apiV2.post('/api/v2/analysis/analyze', payload),

  // Get analysis history
  getHistory: (params?: any) =>
    apiV2.get('/api/v2/analysis/history', { params }),

  // Get analysis by ID
  getById: (id: string) =>
    apiV2.get(`/api/v2/analysis/${id}`),

  // Get analysis status
  getStatus: (id: string) =>
    apiV2.get(`/api/v2/analysis/${id}/status`),

  // Cancel analysis
  cancel: (id: string) =>
    apiV2.post(`/api/v2/analysis/${id}/cancel`),
};

// Config API v2
export const configApi = {
  // System config
  getSystemConfig: () => apiV2.get('/api/v2/config/system'),
  updateSystemConfig: (config: any) => apiV2.put('/api/v2/config/system', config),

  // LLM config
  addLLMConfig: (config: any) => apiV2.post('/api/v2/config/llm', config),
  updateLLMConfig: (id: string, config: any) => apiV2.put(`/api/v2/config/llm/${id}`, config),
  deleteLLMConfig: (id: string) => apiV2.delete(`/api/v2/config/llm/${id}`),
  listLLMConfigs: () => apiV2.get('/api/v2/config/llm'),
  getBestLLM: () => apiV2.get('/api/v2/config/llm/best'),

  // Data source config
  addDataSourceConfig: (config: any) => apiV2.post('/api/v2/config/datasources', config),
  updateDataSourceConfig: (id: string, config: any) => apiV2.put(`/api/v2/config/datasources/${id}`, config),
  deleteDataSourceConfig: (id: string) => apiV2.delete(`/api/v2/config/datasources/${id}`),
  listDataSourceConfigs: () => apiV2.get('/api/v2/config/datasources'),

  // Test config
  testConfig: (config: any) => apiV2.post('/api/v2/config/test', config),
};

// Watchlist API v2
export const watchlistApi = {
  // List watchlist
  list: (params?: { includeQuotes?: boolean }) =>
    apiV2.get('/api/v2/watchlist', { params }),

  // Get by ID
  get: (id: string) =>
    apiV2.get(`/api/v2/watchlist/${id}`),

  // Add to watchlist
  add: (payload: any) =>
    apiV2.post('/api/v2/watchlist', payload),

  // Update watchlist item
  update: (id: string, updates: any) =>
    apiV2.put(`/api/v2/watchlist/${id}`, updates),

  // Remove from watchlist
  remove: (id: string) =>
    apiV2.delete(`/api/v2/watchlist/${id}`),

  // Bulk import
  bulkImport: (stocks: any[]) =>
    apiV2.post('/api/v2/watchlist/bulk/import', { stocks }),

  // Bulk export
  bulkExport: (format?: string) =>
    apiV2.get('/api/v2/watchlist/bulk/export', { params: { format } }),

  // Price alerts
  addAlert: (payload: any) =>
    apiV2.post('/api/v2/watchlist/alerts', payload),

  getAlerts: () =>
    apiV2.get('/api/v2/watchlist/alerts'),

  updateAlert: (alertId: string, payload: any) =>
    apiV2.put(`/api/v2/watchlist/alerts/${alertId}`, payload),

  deleteAlert: (alertId: string) =>
    apiV2.delete(`/api/v2/watchlist/alerts/${alertId}`),

  // Get tags
  getTags: () =>
    apiV2.get('/api/v2/watchlist/tags'),

  // Search watchlist
  search: (query: string) =>
    apiV2.get('/api/v2/watchlist/search', { params: { q: query } }),
};

// News API v2
export const newsApi = {
  // Get market news
  getMarketNews: (params?: { category?: string; limit?: number; hoursBack?: number }) =>
    apiV2.get('/api/v2/news/market', { params }),

  // Get stock-specific news
  getStockNews: (code: string, params?: { limit?: number; hoursBack?: number }) =>
    apiV2.get(`/api/v2/news/stock/${code}`, { params }),

  // Get hot concepts
  getHotConcepts: (params?: { hoursBack?: number; topN?: number }) =>
    apiV2.get('/api/v2/news/hot/concepts', { params }),

  // Get hot stocks
  getHotStocks: (params?: { hoursBack?: number; topN?: number }) =>
    apiV2.get('/api/v2/news/hot/stocks', { params }),

  // Get news analytics
  getAnalytics: (params?: { startDate?: number; endDate?: number }) =>
    apiV2.get('/api/v2/news/analytics', { params }),

  // Get word cloud data
  getWordCloud: (params?: { hoursBack?: number; topN?: number }) =>
    apiV2.get('/api/v2/news/wordcloud', { params }),

  // Save news articles
  saveNews: (articles: any[], source?: string, market?: string) =>
    apiV2.post('/api/v2/news/save', { articles, source, market }),
};

// Export all APIs
export {
  api,
  apiV2,
  apiV2Client,
  apiClient,
  monitoringApi,
  stockDataApi,
  financialDataApi,
  historicalDataApi,
  analysisApi,
  configApi,
  watchlistApi,
  newsApi,
};
