/**
 * Analysis API v2 DTO types
 *
 * Request/Response types for AI analysis and trend analysis endpoints.
 */

import type {
  AnalysisTask,
  AnalysisResult,
  TrendAnalysisResult,
  TaskStatus,
  ResearchDepth,
} from '../types/analysis.js';

// Re-export analysis types
export type {
  AnalysisTask,
  AnalysisResult,
  TrendAnalysisResult,
  TaskStatus,
  ResearchDepth,
};

/**
 * Submit single analysis request
 */
export interface SubmitSingleAnalysisRequest {
  /** Stock code to analyze */
  stockCode: string;
  /** Research depth */
  researchDepth?: ResearchDepth;
  /** Analysis options */
  options?: AnalysisOptions;
}

/**
 * Submit batch analysis request
 */
export interface SubmitBatchAnalysisRequest {
  /** Stock codes to analyze */
  stockCodes: string[];
  /** Research depth */
  researchDepth?: ResearchDepth;
  /** Batch options */
  options?: BatchAnalysisOptions;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Include trend analysis */
  includeTrend?: boolean;
  /** Include AI analysis */
  includeAI?: boolean;
  /** Include backtest */
  includeBacktest?: boolean;
  /** Custom parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Batch analysis options
 */
export interface BatchAnalysisOptions extends AnalysisOptions {
  /** Priority level */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Max concurrent tasks */
  maxConcurrent?: number;
  /** Callback URL */
  callbackUrl?: string;
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
  /** Task ID */
  taskId: string;
  /** Task status */
  status: TaskStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current step */
  currentStep?: string;
  /** Result if completed */
  result?: AnalysisResult;
  /** Error if failed */
  error?: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Batch task status response
 */
export interface BatchTaskStatusResponse {
  /** Batch task ID */
  batchId: string;
  /** Batch status */
  status: TaskStatus;
  /** Total tasks */
  total: number;
  /** Completed tasks */
  completed: number;
  /** Failed tasks */
  failed: number;
  /** Individual task statuses */
  tasks: TaskStatusResponse[];
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Analysis summary response
 */
export interface AnalysisSummaryResponse {
  /** Stock code */
  stockCode: string;
  /** Stock name */
  stockName?: string;
  /** Overall rating (1-5) */
  rating?: number;
  /** Signal (buy/sell/hold) */
  signal?: string;
  /** Confidence score (0-100) */
  confidence?: number;
  /** Trend direction */
  trend?: string;
  /** Key findings */
  findings?: string[];
  /** Analysis timestamp */
  timestamp: number;
}

/**
 * Trend analysis request
 */
export interface TrendAnalysisRequest {
  /** Stock code */
  stockCode: string;
  /** Kline interval */
  interval?: string;
  /** Lookback period */
  period?: number;
  /** Include indicators */
  includeIndicators?: boolean;
}

/**
 * Get analysis history query
 */
export interface GetAnalysisHistoryQuery {
  /** Stock code filter */
  stockCode?: string;
  /** Status filter */
  status?: string;
  /** Date from */
  from?: string;
  /** Date to */
  to?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Cancel task response
 */
export interface CancelTaskResponse {
  /** Task ID */
  taskId: string;
  /** Cancellation status */
  cancelled: boolean;
  /** Message */
  message?: string;
}
