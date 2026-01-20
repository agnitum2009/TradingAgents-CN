/**
 * Analysis Controller
 *
 * API v2 controller for AI analysis and trend analysis endpoints.
 * Bridges to Python backend API via HTTP requests.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getPythonApiClient, type PythonApiError } from '../integration/python-api-client.js';
import { broadcastAnalysisProgress } from '../websocket/index.js';
import type {
  // Request types
  SubmitSingleAnalysisRequest,
  SubmitBatchAnalysisRequest,
  TrendAnalysisRequest,
  // Response types
  TaskStatusResponse,
  BatchTaskStatusResponse,
  AnalysisSummaryResponse,
  CancelTaskResponse,
} from '../dtos/analysis.dto.js';
import type { AnalysisTask, AnalysisBatch, TaskStatus, BatchStatus } from '../types/analysis.js';

const logger = Logger.for('AnalysisController');

/**
 * Analysis Controller
 *
 * Handles all AI analysis and trend analysis endpoints.
 * Delegates actual analysis work to Python backend via HTTP.
 */
export class AnalysisController extends BaseRouter {
  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/analysis',
      description: 'AI analysis and trend analysis endpoints',
      defaultAuthRequired: true,
    };
    super(config);
    this.registerRoutes();
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // Single analysis routes
    this.post<SubmitSingleAnalysisRequest, TaskStatusResponse>(
      '/ai/single',
      this.submitSingleAnalysis.bind(this),
    );

    this.get<TaskStatusResponse>(
      '/ai/tasks/:id',
      this.getTaskStatus.bind(this),
    );

    this.get<AnalysisSummaryResponse>(
      '/ai/tasks/:id/result',
      this.getTaskResult.bind(this),
    );

    this.post<CancelTaskResponse>(
      '/ai/tasks/:id/cancel',
      this.cancelTask.bind(this),
    );

    // Batch analysis routes
    this.post<SubmitBatchAnalysisRequest, BatchTaskStatusResponse>(
      '/ai/batch',
      this.submitBatchAnalysis.bind(this),
    );

    this.get<BatchTaskStatusResponse>(
      '/ai/batch/:id',
      this.getBatchStatus.bind(this),
    );

    // Trend analysis routes
    this.post<TrendAnalysisRequest, AnalysisSummaryResponse>(
      '/trend',
      this.analyzeTrend.bind(this),
    );

    // History routes
    this.get<any>(
      '/history',
      this.getAnalysisHistory.bind(this),
    );

    // Public route for health check
    this.get<any>(
      '/health',
      this.healthCheck.bind(this),
      { authRequired: false }
    );
  }

  /**
   * Submit single analysis request
   * POST /api/v2/analysis/ai/single
   */
  private async submitSingleAnalysis(input: any) {
    try {
      const { stockCode, symbol, parameters } = input.body;
      const resolvedSymbol = stockCode || symbol || '';

      if (!resolvedSymbol) {
        return handleRouteError(new Error('Stock code is required'), input.context.requestId);
      }

      logger.info(`Submit single analysis for ${resolvedSymbol}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      // Submit to Python API
      const response = await client.submitSingleAnalysis(
        {
          symbol: resolvedSymbol,
          parameters: parameters || {},
        },
        authToken
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to submit analysis');
      }

      // Map to TaskStatusResponse
      const result: TaskStatusResponse = {
        taskId: response.data.task_id,
        userId: input.context.user?.userId,
        symbol: response.data.symbol || resolvedSymbol,
        stockCode: resolvedSymbol,
        status: response.data.status as any,
        progress: 0,
        currentStep: 'Task created',
        elapsedTime: 0,
        remainingTime: 0,
        estimatedTotalTime: 0,
        startTime: response.data.created_at,
        lastUpdate: response.data.created_at,
      };

      logger.info(`Analysis task created: ${result.taskId} for ${resolvedSymbol}`);

      // Broadcast progress via WebSocket
      await this.broadcastProgress(result.taskId, resolvedSymbol, result.status, result);

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get task status
   * GET /api/v2/analysis/ai/tasks/:id
   */
  private async getTaskStatus(input: any) {
    try {
      const taskId = input.params.id;
      logger.info(`Get task status: ${taskId}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.getTaskStatus(taskId, authToken);

      if (!response.success) {
        throw new Error(response.message || 'Failed to get task status');
      }

      if (!response.data) {
        return handleRouteError(new Error('Task not found'), input.context.requestId);
      }

      // Map to TaskStatusResponse
      const result: TaskStatusResponse = {
        taskId: response.data.task_id || taskId,
        userId: input.context.user?.userId,
        symbol: undefined, // Python API doesn't return symbol in status
        status: response.data.status as TaskStatus,
        progress: response.data.progress || 0,
        currentStep: response.data.current_step,
        message: response.data.error,
        elapsedTime: response.data.elapsed_time || 0,
        remainingTime: response.data.estimated_total_time ?
          Math.max(0, response.data.estimated_total_time - (response.data.elapsed_time || 0)) : 0,
        estimatedTotalTime: response.data.estimated_total_time || 0,
        startTime: undefined,
        lastUpdate: Date.now(),
      };

      // Broadcast progress via WebSocket (only if symbol is known)
      if (result.symbol) {
        await this.broadcastProgress(result.taskId, result.symbol, result.status, result);
      }

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get task result
   * GET /api/v2/analysis/ai/tasks/:id/result
   */
  private async getTaskResult(input: any) {
    try {
      const taskId = input.params.id;
      logger.info(`Get task result: ${taskId}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.getTaskResult(taskId, authToken);

      if (!response.success) {
        throw new Error(response.message || 'Failed to get task result');
      }

      if (!response.data) {
        return handleRouteError(new Error('Task result not found'), input.context.requestId);
      }

      const data = response.data;
      const result = data.result as any;

      // Map AnalysisResult to AnalysisSummaryResponse
      const summary: AnalysisSummaryResponse = {
        stockCode: data.symbol || 'UNKNOWN',
        stockName: data.symbol || 'Unknown Stock',
        rating: this.calculateRating(result),
        signal: this.calculateSignal(result),
        confidence: result?.confidence_score ? Math.round(result.confidence_score * 100) : 70,
        trend: this.calculateTrend(result),
        findings: result?.key_points || [],
        timestamp: data.completed_at || Date.now(),
      };

      logger.info(`Task result retrieved: ${taskId}`);

      return createSuccessResponse(summary);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Cancel task
   * POST /api/v2/analysis/ai/tasks/:id/cancel
   */
  private async cancelTask(input: any) {
    try {
      const taskId = input.params.id;
      logger.info(`Cancel task: ${taskId}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.cancelTask(taskId, authToken);

      const result: CancelTaskResponse = {
        taskId,
        cancelled: response.success && response.data?.cancelled,
        message: response.message,
      };

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Submit batch analysis
   * POST /api/v2/analysis/ai/batch
   */
  private async submitBatchAnalysis(input: any) {
    try {
      const { stockCodes, symbols, parameters, title, description } = input.body;
      const resolvedSymbols = stockCodes || symbols || [];

      if (!resolvedSymbols || resolvedSymbols.length === 0) {
        return handleRouteError(new Error('Stock codes are required'), input.context.requestId);
      }

      logger.info(`Submit batch analysis for ${resolvedSymbols.length} stocks`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.submitBatchAnalysis(
        {
          symbols: resolvedSymbols,
          parameters: parameters || {},
          title,
          description,
        },
        authToken
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to submit batch analysis');
      }

      const result: BatchTaskStatusResponse = {
        batchId: response.data.batch_id,
        status: response.data.status as any,
        total: response.data.total_tasks,
        completed: 0,
        failed: 0,
        tasks: [],
        createdAt: response.data.created_at,
        updatedAt: response.data.created_at,
      };

      logger.info(`Batch analysis created: ${result.batchId} for ${resolvedSymbols.length} stocks`);

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get batch status
   * GET /api/v2/analysis/ai/batch/:id
   */
  private async getBatchStatus(input: any) {
    try {
      const batchId = input.params.id;
      logger.info(`Get batch status: ${batchId}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.getBatchStatus(batchId, authToken);

      if (!response.success) {
        throw new Error(response.message || 'Failed to get batch status');
      }

      if (!response.data) {
        return handleRouteError(new Error('Batch not found'), input.context.requestId);
      }

      const data = response.data;

      const result: BatchTaskStatusResponse = {
        batchId: data.batch_id,
        status: data.status as TaskStatus, // BatchStatus and TaskStatus have compatible values
        total: data.total_tasks,
        completed: data.completed_tasks,
        failed: data.failed_tasks || 0,
        tasks: (data.tasks || []).map((t: any) => ({
          taskId: t.task_id,
          symbol: t.symbol,
          status: t.status as TaskStatus,
          progress: t.progress,
          elapsedTime: t.elapsed_time || 0,
          remainingTime: t.estimated_total_time ?
            Math.max(0, t.estimated_total_time - (t.elapsed_time || 0)) : 0,
          estimatedTotalTime: t.estimated_total_time || 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Broadcast progress for each task via WebSocket
      for (const task of result.tasks) {
        if (task.symbol) {
          await this.broadcastProgress(task.taskId, task.symbol, task.status, {
            progress: task.progress,
            currentStep: undefined,
            message: undefined,
          });
        }
      }

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Analyze trend
   * POST /api/v2/analysis/trend
   */
  private async analyzeTrend(input: any) {
    try {
      const { stockCode, symbol, parameters } = input.body;
      const resolvedSymbol = stockCode || symbol || '';

      if (!resolvedSymbol) {
        return handleRouteError(new Error('Stock code is required'), input.context.requestId);
      }

      logger.info(`Analyze trend for ${resolvedSymbol}`);

      // For trend analysis, submit as single analysis with trend type
      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const response = await client.submitSingleAnalysis(
        {
          symbol: resolvedSymbol,
          parameters: {
            ...parameters,
            analysis_type: 'trend',
          },
        },
        authToken
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to submit trend analysis');
      }

      // Return placeholder response with task info
      const result: AnalysisSummaryResponse = {
        stockCode: resolvedSymbol,
        stockName: resolvedSymbol,
        rating: 3,
        signal: 'hold',
        confidence: 70,
        trend: 'sideways',
        findings: ['Trend analysis submitted', `Task ID: ${response.data.task_id}`],
        timestamp: Date.now(),
      };

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get analysis history
   * GET /api/v2/analysis/history
   */
  private async getAnalysisHistory(input: any) {
    try {
      const userId = input.context.user?.userId;

      if (!userId) {
        return handleRouteError(new Error('User not authenticated'), input.context.requestId);
      }

      logger.info(`Get analysis history for user: ${userId}`);

      const client = getPythonApiClient();
      const authToken = this.getAuthToken(input);

      const page = parseInt(input.query.page || '1');
      const pageSize = parseInt(input.query.pageSize || '20');

      const response = await client.getAnalysisHistory(
        {
          user_id: userId,
          symbol: input.query.symbol,
          status: input.query.status,
          limit: pageSize,
          skip: (page - 1) * pageSize,
        },
        authToken
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to get analysis history');
      }

      const data = response.data;

      const result = {
        items: (data.items || []).map(t => ({
          taskId: t.task_id,
          symbol: t.symbol,
          stockCode: t.symbol,
          status: t.status,
          progress: 0,
          currentStep: undefined,
          createdAt: t.created_at,
          updatedAt: t.created_at,
          completedAt: t.completed_at,
        })),
        total: data.total || 0,
        page,
        pageSize,
      };

      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Health check endpoint
   * GET /api/v2/analysis/health
   */
  private async healthCheck(input: any) {
    try {
      const client = getPythonApiClient();

      // Check Python API health
      const health = await client.healthCheck();

      return createSuccessResponse({
        status: 'healthy',
        pythonBridge: true,
        pythonApi: health.status,
        timestamp: Date.now(),
      });
    } catch (error) {
      return createSuccessResponse({
        status: 'degraded',
        pythonBridge: true,
        pythonApi: 'unreachable',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get auth token from request context
   */
  private getAuthToken(input: any): string | undefined {
    // Try to get from Authorization header
    const authHeader = input.headers?.authorization || input.headers?.Authorization;
    if (authHeader && typeof authHeader === 'string') {
      return authHeader.replace(/^Bearer\s+/i, '');
    }

    // Try to get from context (set by auth middleware)
    return input.context?.token;
  }

  /**
   * Calculate rating from analysis result
   */
  private calculateRating(result: any): number {
    if (!result) return 3;
    if (result.confidence_score >= 0.8) return 5;
    if (result.confidence_score >= 0.6) return 4;
    if (result.confidence_score >= 0.4) return 3;
    if (result.confidence_score >= 0.2) return 2;
    return 1;
  }

  /**
   * Calculate signal from decision
   */
  private calculateSignal(result: any): 'buy' | 'sell' | 'hold' {
    if (!result?.decision) return 'hold';

    const action = (typeof result.decision === 'string')
      ? result.decision.toLowerCase()
      : (result.decision?.action?.toLowerCase() || '');

    if (action === 'buy') return 'buy';
    if (action === 'sell') return 'sell';
    return 'hold';
  }

  /**
   * Calculate trend from analysis
   */
  private calculateTrend(result: any): 'up' | 'down' | 'sideways' {
    if (!result) return 'sideways';

    const points = result.key_points || [];
    const text = Array.isArray(points) ? points.join(' ').toLowerCase() : '';

    if (text.includes('uptrend') || text.includes('上涨') || text.includes('bullish')) {
      return 'up';
    }
    if (text.includes('downtrend') || text.includes('下跌') || text.includes('bearish')) {
      return 'down';
    }
    return 'sideways';
  }

  /**
   * Broadcast analysis progress via WebSocket
   */
  private async broadcastProgress(
    taskId: string,
    symbol: string,
    status: TaskStatus,
    data: Partial<TaskStatusResponse>
  ): Promise<void> {
    try {
      await broadcastAnalysisProgress(taskId, {
        taskId,
        symbol,
        status: status as any,
        progress: data.progress || 0,
        currentStep: data.currentStep,
        message: data.message,
      });
    } catch (error) {
      // Don't fail the request if WebSocket broadcast fails
      logger.debug(`Failed to broadcast progress for task ${taskId}:`, error);
    }
  }
}
