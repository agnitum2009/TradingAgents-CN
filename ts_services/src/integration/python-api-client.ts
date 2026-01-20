/**
 * Python API Client
 *
 * HTTP client for calling Python backend API services.
 * Used as an alternative to subprocess-based PythonAdapter.
 */

import { Logger } from '../utils/logger.js';

const logger = Logger.for('PythonApiClient');

// Python API configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://python-api:8000';
const API_BASE = `${PYTHON_API_URL}/api`;
const REQUEST_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT || '30000', 10);

/**
 * HTTP error from Python API
 */
export class PythonApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PythonApiError';
  }
}

/**
 * Request options
 */
interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  timeout?: number;
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * Python API Client
 *
 * Provides HTTP access to Python backend services.
 */
export class PythonApiClient {
  private baseUrl: string;
  private apiBase: string;
  private defaultTimeout: number;

  constructor(config?: { baseUrl?: string; apiBase?: string; timeout?: number }) {
    this.baseUrl = config?.baseUrl || PYTHON_API_URL;
    this.apiBase = config?.apiBase || API_BASE;
    this.defaultTimeout = config?.timeout || REQUEST_TIMEOUT;
    logger.info(`PythonApiClient initialized: ${this.apiBase}`);
  }

  /**
   * Make HTTP request to Python API
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { query, timeout = this.defaultTimeout, ...fetchOptions } = options;

    // Build URL with query params
    let url = `${this.apiBase}${endpoint}`;
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Setup headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    // Add authentication if token provided
    const authToken = options.headers?.['Authorization'] || process.env.PYTHON_API_TOKEN;
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    logger.debug(`Python API request: ${options.method || 'GET'} ${url}`);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        const code = (errorData as any)?.code || 'API_ERROR';
        const message = (errorData as any)?.message || `HTTP ${response.status}`;

        throw new PythonApiError(
          response.status,
          code,
          message,
          errorData
        );
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return (await response.text()) as T;
    } catch (error) {
      if (error instanceof PythonApiError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new PythonApiError(408, 'TIMEOUT', `Request timeout after ${timeout}ms`);
      }

      logger.error('Python API request failed', error);
      throw new PythonApiError(500, 'NETWORK_ERROR', (error as Error).message);
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return this.get('/health');
  }
}

// =============================================================================
// Analysis API Methods
// =============================================================================

/**
 * Analysis API client for Python backend
 */
export class AnalysisApiClient extends PythonApiClient {
  constructor(config?: { baseUrl?: string }) {
    super(config);
  }

  /**
   * Submit single stock analysis
   * POST /api/analysis/single
   */
  async submitSingleAnalysis(request: {
    symbol: string;
    parameters?: Record<string, unknown>;
  }, authToken?: string): Promise<{
    success: boolean;
    data: {
      task_id: string;
      status: string;
      symbol: string;
      created_at: number;
    };
    message: string;
  }> {
    return this.post('/analysis/single', request, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Get task status
   * GET /api/analysis/tasks/{task_id}/status
   */
  async getTaskStatus(taskId: string, authToken?: string): Promise<{
    success: boolean;
    data?: {
      task_id: string;
      status: string;
      progress: number;
      current_step?: string;
      result?: unknown;
      error?: string;
      elapsed_time?: number;
      estimated_total_time?: number;
    };
    message: string;
  }> {
    return this.get(`/analysis/tasks/${taskId}/status`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Get task result
   * GET /api/analysis/tasks/{task_id}/result
   */
  async getTaskResult(taskId: string, authToken?: string): Promise<{
    success: boolean;
    data?: {
      task_id: string;
      symbol: string;
      result: unknown;
      completed_at: number;
    };
    message: string;
  }> {
    return this.get(`/analysis/tasks/${taskId}/result`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Cancel task
   * POST /api/analysis/tasks/{task_id}/cancel
   */
  async cancelTask(taskId: string, authToken?: string): Promise<{
    success: boolean;
    data?: { task_id: string; cancelled: boolean };
    message: string;
  }> {
    return this.post(`/analysis/tasks/${taskId}/cancel`, null, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Submit batch analysis
   * POST /api/analysis/batch
   */
  async submitBatchAnalysis(request: {
    symbols: string[];
    parameters?: Record<string, unknown>;
    title?: string;
    description?: string;
  }, authToken?: string): Promise<{
    success: boolean;
    data: {
      batch_id: string;
      status: string;
      total_tasks: number;
      created_at: number;
    };
    message: string;
  }> {
    return this.post('/analysis/batch', request, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Get batch status
   * GET /api/analysis/batch/{batch_id}
   */
  async getBatchStatus(batchId: string, authToken?: string): Promise<{
    success: boolean;
    data?: {
      batch_id: string;
      status: string;
      total_tasks: number;
      completed_tasks: number;
      failed_tasks?: number;
      tasks: Array<{
        task_id: string;
        symbol: string;
        status: string;
        progress: number;
      }>;
    };
    message: string;
  }> {
    return this.get(`/analysis/batch/${batchId}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }

  /**
   * Get analysis history
   * GET /api/analysis/history
   */
  async getAnalysisHistory(params: {
    user_id?: string;
    symbol?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }, authToken?: string): Promise<{
    success: boolean;
    data: {
      items: Array<{
        task_id: string;
        symbol: string;
        status: string;
        created_at: number;
        completed_at?: number;
      }>;
      total: number;
    };
    message: string;
  }> {
    return this.get('/analysis/history', {
      query: params,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
  }
}

// =============================================================================
// Global Instance Factory
// =============================================================================

let _globalClient: AnalysisApiClient | null = null;

/**
 * Get the global AnalysisApiClient instance
 */
export function getPythonApiClient(): AnalysisApiClient {
  if (!_globalClient) {
    _globalClient = new AnalysisApiClient();
  }
  return _globalClient;
}

/**
 * Reset the global instance (for testing)
 */
export function resetPythonApiClient(): void {
  _globalClient = null;
}
