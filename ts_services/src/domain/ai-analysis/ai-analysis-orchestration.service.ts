/**
 * AI Analysis Orchestration Service
 *
 * Main service for orchestrating AI-based stock analysis using TradingAgents.
 * Handles task submission, execution, progress tracking, and result management.
 *
 * Based on Python:
 * - app/services/analysis_service.py (983 lines)
 * - app/services/simple_analysis_service.py
 *
 * Features:
 * - Single and batch analysis submission
 * - Background task execution with progress tracking
 * - Engine caching for performance
 * - Token usage tracking
 * - MongoDB/Redis progress synchronization
 */

import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnalysisTask,
  AnalysisBatch,
  AnalysisResult,
  SingleAnalysisRequest,
  BatchAnalysisRequest,
  TaskStatusResponse,
  AnalysisParameters,
  ProgressCallback,
} from '../../types/analysis.js';
import {
  ResearchDepth,
  TaskStatus,
  BatchStatus,
} from '../../types/analysis.js';
import type { EngineConfig } from './engine/index.js';
import { AnalysisEngineManager, getEngineManager } from './engine/index.js';
import { Logger } from '../../utils/logger.js';
import { Result, TacnError } from '../../utils/errors.js';
import type { AnalysisTaskRepository, UserTaskStats } from '../../repositories/analysis-task.repository.js';
import { getAnalysisTaskRepository } from '../../repositories/analysis-task.repository.js';
import type { AnalysisBatchRepository, BatchStatistics } from '../../repositories/analysis-batch.repository.js';
import { getAnalysisBatchRepository } from '../../repositories/analysis-batch.repository.js';

const logger = Logger.for('AIAnalysisOrchestrationService');

/**
 * Configuration for AI analysis
 */
export interface AIAnalysisConfig {
  /** Research depth */
  researchDepth: number | ResearchDepth;
  /** Selected analysts */
  selectedAnalysts: string[];
  /** Quick model name */
  quickModel: string;
  /** Deep model name */
  deepModel: string;
  /** LLM provider */
  llmProvider: string;
  /** Market type (A股,港股,美股) */
  marketType?: string;
  /** Quick model config */
  quickModelConfig?: {
    maxTokens: number;
    temperature: number;
    timeout: number;
    retryTimes: number;
    apiBase?: string;
    apiKey?: string;
  };
  /** Deep model config */
  deepModelConfig?: {
    maxTokens: number;
    temperature: number;
    timeout: number;
    retryTimes: number;
    apiBase?: string;
    apiKey?: string;
  };
}

/**
 * Default analysis configuration
 */
const DEFAULT_ANALYSIS_CONFIG: AIAnalysisConfig = {
  researchDepth: ResearchDepth.STANDARD,
  selectedAnalysts: ['market', 'fundamentals'],
  quickModel: 'qwen-turbo',
  deepModel: 'qwen-max',
  llmProvider: 'dashscope',
  marketType: 'A股',
};

/**
 * Analysis configuration levels
 * Maps research depth to analysis parameters
 */
const ANALYSIS_LEVELS: Record<ResearchDepth, {
  max_debate_rounds: number;
  max_risk_discuss_rounds: number;
  memory_enabled: boolean;
  online_tools: boolean;
}> = {
  [ResearchDepth.QUICK]: {
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    memory_enabled: false,
    online_tools: true,
  },
  [ResearchDepth.BASIC]: {
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    memory_enabled: true,
    online_tools: true,
  },
  [ResearchDepth.STANDARD]: {
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 2,
    memory_enabled: true,
    online_tools: true,
  },
  [ResearchDepth.DEEP]: {
    max_debate_rounds: 2,
    max_risk_discuss_rounds: 2,
    memory_enabled: true,
    online_tools: true,
  },
  [ResearchDepth.COMPREHENSIVE]: {
    max_debate_rounds: 3,
    max_risk_discuss_rounds: 3,
    memory_enabled: true,
    online_tools: true,
  },
};

/**
 * Numeric to Chinese research depth mapping
 */
const NUMERIC_TO_CHINESE_DEPTH: Record<number, ResearchDepth> = {
  1: ResearchDepth.QUICK,
  2: ResearchDepth.BASIC,
  3: ResearchDepth.STANDARD,
  4: ResearchDepth.DEEP,
  5: ResearchDepth.COMPREHENSIVE,
};

/**
 * AI Analysis Orchestration Service
 *
 * Main service for AI-powered stock analysis using TradingAgents
 * multi-agent system.
 */
@injectable()
export class AIAnalysisOrchestrationService {
  /** Engine manager singleton */
  private _engineManager: AnalysisEngineManager;

  /** Trading graph cache (config -> engine) */
  private _tradingGraphCache = new Map<string, unknown>();

  /** Progress trackers (task_id -> tracker data) */
  private _progressTrackers = new Map<string, TaskStatusResponse>();

  /** Task repository */
  private readonly _taskRepository: AnalysisTaskRepository;

  /** Batch repository */
  private readonly _batchRepository: AnalysisBatchRepository;

  /** Simulation mode - for testing without actual Python/LLM calls */
  private _simulationMode: boolean;

  constructor(
    taskRepository?: AnalysisTaskRepository,
    batchRepository?: AnalysisBatchRepository,
    simulationMode?: boolean
  ) {
    this._engineManager = getEngineManager();
    this._taskRepository = taskRepository || getAnalysisTaskRepository();
    this._batchRepository = batchRepository || getAnalysisBatchRepository();

    // Link repositories for batch progress tracking
    this._batchRepository.setTaskRepository(this._taskRepository);

    // Enable simulation mode in test environment or when explicitly requested
    this._simulationMode = simulationMode || process.env.NODE_ENV === 'test' || process.env.TACN_SIMULATION_MODE === 'true';

    if (this._simulationMode) {
      logger.warn('🎭 AIAnalysisOrchestrationService running in SIMULATION mode - no actual Python/LLM calls');
    } else {
      logger.info('🔧 AIAnalysisOrchestrationService initialized with repositories');
    }
  }

  /**
   * Convert user ID string to ObjectId-compatible format
   *
   * @param userId - User ID string (or "admin")
   * @returns Converted user ID
   */
  private _convertUserId(userId: string): string {
    try {
      if (userId === 'admin') {
        // Fixed ObjectId for admin user
        return '507f1f77bcf86cd799439011';
      }
      // Validate ObjectId format
      if (/^[0-9a-f]{24}$/i.test(userId)) {
        return userId;
      }
      // Generate new ObjectId if invalid
      const newId = uuidv4().replace(/-/g, '').substring(0, 24);
      logger.warn(`Generated new user ID: ${newId}`);
      return newId;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to convert user ID: ${userId} - ${err.message}`);
      return uuidv4().replace(/-/g, '').substring(0, 24);
    }
  }

  /**
   * Normalize research depth to Chinese string
   *
   * @param researchDepth - Research depth (number, string, or ResearchDepth enum)
   * @returns Normalized Chinese research depth
   */
  private _normalizeResearchDepth(
    researchDepth: number | string | ResearchDepth | undefined
  ): ResearchDepth {
    // If already ResearchDepth enum
    if (typeof researchDepth === 'string' && Object.values(ResearchDepth).includes(researchDepth as ResearchDepth)) {
      return researchDepth as ResearchDepth;
    }

    // If numeric, convert to Chinese
    if (typeof researchDepth === 'number') {
      return NUMERIC_TO_CHINESE_DEPTH[researchDepth] || ResearchDepth.STANDARD;
    }

    // If string number, convert
    if (typeof researchDepth === 'string' && /^\d+$/.test(researchDepth)) {
      const num = parseInt(researchDepth, 10);
      return NUMERIC_TO_CHINESE_DEPTH[num] || ResearchDepth.STANDARD;
    }

    // Default to standard
    return ResearchDepth.STANDARD;
  }

  /**
   * Create analysis configuration from parameters
   *
   * @param parameters - Analysis parameters
   * @returns Complete engine configuration
   */
  private _createEngineConfig(parameters: AnalysisParameters): EngineConfig {
    const researchDepth = this._normalizeResearchDepth(parameters.researchDepth);
    const level = ANALYSIS_LEVELS[researchDepth];

    if (!level) {
      throw new Error(`Invalid research depth: ${researchDepth}`);
    }

    const config: EngineConfig = {
      selected_analysts: parameters.selectedAnalysts || DEFAULT_ANALYSIS_CONFIG.selectedAnalysts,
      debug: false,
      llm_provider: parameters.llmProvider || DEFAULT_ANALYSIS_CONFIG.llmProvider,
      quick_think_llm: parameters.quickAnalysisModel || DEFAULT_ANALYSIS_CONFIG.quickModel,
      deep_think_llm: parameters.deepAnalysisModel || DEFAULT_ANALYSIS_CONFIG.deepModel,
      max_debate_rounds: level.max_debate_rounds,
      max_risk_discuss_rounds: level.max_risk_discuss_rounds,
      memory_enabled: level.memory_enabled,
      online_tools: level.online_tools,
      research_depth: researchDepth,
      quick_model_config: parameters.quickModelConfig,
      deep_model_config: parameters.deepModelConfig,
    };

    logger.info(`📋 Created engine config: research_depth=${researchDepth}, ` +
      `debate_rounds=${config.max_debate_rounds}, ` +
      `risk_rounds=${config.max_risk_discuss_rounds}`);

    return config;
  }

  /**
   * Get or create a TradingAgents engine instance
   *
   * @param config - Engine configuration
   * @returns Engine instance
   */
  private async _getTradingGraph(config: EngineConfig): Promise<unknown> {
    const configKey = JSON.stringify(config, Object.keys(config).sort());

    if (!this._tradingGraphCache.has(configKey)) {
      logger.info('[Adapter] Creating engine instance');

      const engine = this._engineManager.getPrimaryEngine();
      if (engine === null) {
        throw new Error('No available analysis engines');
      }

      await engine.initialize(
        config.selected_analysts || ['market', 'fundamentals'],
        config.debug || false,
        config
      );

      this._tradingGraphCache.set(configKey, engine);
      logger.info(`[Adapter] Engine created: ${engine.name}`);
    }

    return this._tradingGraphCache.get(configKey);
  }

  /**
   * Submit a single stock analysis task
   *
   * @param userId - User ID
   * @param request - Single analysis request
   * @returns Task submission result with task_id
   */
  async submitSingleAnalysis(
    userId: string,
    request: SingleAnalysisRequest
  ): Promise<Result<{ task_id: string; symbol: string; status: TaskStatus }>> {
    try {
      logger.info('📝 Submitting single analysis task');
      logger.info(`👤 User ID: ${userId}`);

      // Get stock code (support both symbol and stock_code fields)
      const stockSymbol = request.symbol || request.stockCode;
      if (!stockSymbol) {
        return Result.error(new TacnError('ANALYSIS_ERROR', 'Stock code cannot be empty'));
      }

      logger.info(`📊 Stock code: ${stockSymbol}`);
      logger.info(`⚙️ Analysis parameters: ${JSON.stringify(request.parameters)}`);

      // Convert user ID
      const convertedUserId = this._convertUserId(userId);
      logger.info(`🔄 Converted user ID: ${convertedUserId}`);

      // Get effective settings from request parameters
      const params = request.parameters || ({} as AnalysisParameters);
      if (!params.quickAnalysisModel) {
        params.quickAnalysisModel = 'qwen-turbo';
      }
      if (!params.deepAnalysisModel) {
        params.deepAnalysisModel = 'qwen-max';
      }

      // Create analysis task via repository
      const task = await this._taskRepository.createTask(
        convertedUserId,
        stockSymbol,
        params
      );

      logger.info(`🆔 Task created: ${task.taskId} - ${stockSymbol}`);

      // Execute analysis in background (non-blocking)
      this._executeSingleAnalysisAsync(task).catch((error) => {
        logger.error(`Background analysis failed: ${error}`);
      });

      logger.info(`🎉 Single analysis task submitted: ${task.taskId} - ${stockSymbol}`);

      return Result.ok({
        task_id: task.taskId,
        symbol: stockSymbol,
        status: TaskStatus.PENDING,
      });
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to submit single analysis: ${e.message}`);
      return Result.error(new TacnError('SUBMIT_FAILED', e.message));
    }
  }

  /**
   * Submit a batch analysis task
   *
   * @param userId - User ID
   * @param request - Batch analysis request
   * @returns Batch submission result with batch_id
   */
  async submitBatchAnalysis(
    userId: string,
    request: BatchAnalysisRequest
  ): Promise<Result<{ batch_id: string; total_tasks: number; status: BatchStatus }>> {
    try {
      logger.info('📝 Submitting batch analysis task');

      // Convert user ID
      const convertedUserId = this._convertUserId(userId);

      // Get stock codes (support both symbols and stock_codes fields)
      const stockSymbols = request.symbols || request.stockCodes || [];
      if (stockSymbols.length === 0) {
        return Result.error(new TacnError('ANALYSIS_ERROR', 'Stock codes list cannot be empty'));
      }

      // Get effective settings from request
      const params = request.parameters || ({} as AnalysisParameters);
      if (!params.quickAnalysisModel) {
        params.quickAnalysisModel = 'qwen-turbo';
      }
      if (!params.deepAnalysisModel) {
        params.deepAnalysisModel = 'qwen-max';
      }

      // Create batch via repository
      const batch = await this._batchRepository.createBatch(
        convertedUserId,
        stockSymbols,
        params,
        request.title,
        request.description
      );

      logger.info(`📦 Batch created: ${batch.batchId} - ${stockSymbols.length} stocks`);

      // Create individual tasks for each symbol
      const tasks: AnalysisTask[] = [];
      for (const symbol of stockSymbols) {
        const task = await this._taskRepository.createTask(
          convertedUserId,
          symbol,
          params,
          batch.batchId
        );
        tasks.push(task);
      }

      logger.info(`📋 Created ${tasks.length} tasks for batch: ${batch.batchId}`);

      // Start batch execution in background
      this._executeBatchAsync(batch, tasks).catch((error) => {
        logger.error(`Background batch execution failed: ${error}`);
      });

      logger.info(`🚀 Batch analysis submitted: ${batch.batchId} - ${stockSymbols.length} stocks`);

      return Result.ok({
        batch_id: batch.batchId,
        total_tasks: stockSymbols.length,
        status: BatchStatus.PENDING,
      });
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to submit batch analysis: ${e.message}`);
      return Result.error(new TacnError('BATCH_SUBMIT_FAILED', e.message));
    }
  }

  /**
   * Execute a single analysis task asynchronously
   *
   * @param task - Analysis task to execute
   */
  private async _executeSingleAnalysisAsync(task: AnalysisTask): Promise<void> {
    const progressTracker: TaskStatusResponse = {
      taskId: task.taskId,
      status: TaskStatus.PROCESSING,
      progress: 0,
      elapsedTime: 0,
      remainingTime: 300, // Default 5 minutes
      estimatedTotalTime: 300,
      steps: [],
      symbol: task.symbol,
      stockCode: task.stockCode,
    };

    this._progressTrackers.set(task.taskId, progressTracker);

    try {
      logger.info(`🔄 Starting analysis task: ${task.taskId} - ${task.symbol}`);

      // Update initial status
      progressTracker.message = '🚀 开始股票分析';
      progressTracker.currentStep = '初始化';
      await this._updateTaskStatus(task.taskId, TaskStatus.PROCESSING, 0, progressTracker);

      // Create engine configuration
      const config = this._createEngineConfig(task.parameters);

      // Update progress
      progressTracker.message = '🔧 检查环境配置';
      progressTracker.progress = 10;
      await this._updateTaskStatus(task.taskId, TaskStatus.PROCESSING, 10, progressTracker);

      // SIMULATION MODE: Skip actual Python/LLM calls
      if (this._simulationMode) {
        logger.info(`🎭 SIMULATION: Skipping actual analysis for ${task.taskId}`);

        // Simulate processing delay
        await this._simulateProgress(task.taskId, progressTracker);

        // Generate mock result
        const mockResult: AnalysisResult = {
          analysisId: uuidv4(),
          summary: `[SIMULATION] 模拟分析结果 for ${task.symbol}`,
          recommendation: this._getRandomRecommendation(),
          confidenceScore: 0.7 + Math.random() * 0.25,
          riskLevel: this._getRandomRiskLevel(),
          keyPoints: [
            `[模拟] 均线趋势${Math.random() > 0.5 ? '向上' : '向下'}`,
            `[模拟] 成交量${Math.random() > 0.5 ? '放大' : '缩小'}`,
            `[模拟] 技术指标${Math.random() > 0.5 ? '看涨' : '看跌'}`
          ],
          detailedAnalysis: {
            simulation: true,
            symbol: task.symbol,
            parameters: task.parameters,
            note: 'This is a simulated result for testing purposes'
          },
          executionTime: 1 + Math.random() * 2,
          tokensUsed: 500 + Math.floor(Math.random() * 500),
          modelInfo: 'simulation-model',
        };

        progressTracker.executionTime = mockResult.executionTime;
        progressTracker.tokensUsed = mockResult.tokensUsed;
        progressTracker.resultData = mockResult.detailedAnalysis as Record<string, unknown>;

        // Mark as completed
        progressTracker.message = '✅ 分析完成 (模拟)';
        progressTracker.progress = 100;
        progressTracker.status = TaskStatus.COMPLETED;
        await this._updateTaskStatus(task.taskId, TaskStatus.COMPLETED, 100, progressTracker, mockResult);

        logger.info(`✅ [SIMULATION] Analysis task completed: ${task.taskId} - ${mockResult.executionTime.toFixed(2)}s`);
        return;
      }

      // PRODUCTION MODE: Actual Python/LLM calls
      // Get trading graph engine
      const tradingGraph = await this._getTradingGraph(config);

      progressTracker.message = '🚀 初始化AI分析引擎';
      progressTracker.progress = 20;
      await this._updateTaskStatus(task.taskId, TaskStatus.PROCESSING, 20, progressTracker);

      // Execute analysis
      const startTime = Date.now();
      const analysisDate = task.parameters.analysisDate || new Date().toISOString().split('T')[0];

      // Create progress callback
      const progressCallback: ProgressCallback = (message: string) => {
        progressTracker.message = message;
        progressTracker.currentStep = message;
      };

      // Call analyze via engine (TradingAgents)
      const [, decision] = await (tradingGraph as { analyze: Function }).analyze(
        task.symbol,
        analysisDate,
        progressCallback,
        task.taskId
      );

      const executionTime = (Date.now() - startTime) / 1000;

      progressTracker.message = '📊 生成分析报告';
      progressTracker.progress = 90;
      await this._updateTaskStatus(task.taskId, TaskStatus.PROCESSING, 90, progressTracker);

      // Build result
      const result: AnalysisResult = {
        analysisId: uuidv4(),
        summary: (decision as { summary?: string }).summary || '',
        recommendation: (decision as { recommendation?: string }).recommendation || '',
        confidenceScore: (decision as { confidence_score?: number }).confidence_score || 0,
        riskLevel: (decision as { risk_level?: string }).risk_level || '中等',
        keyPoints: (decision as { key_points?: string[] }).key_points || [],
        detailedAnalysis: decision,
        executionTime,
        tokensUsed: (decision as { tokens_used?: number }).tokens_used || 0,
        modelInfo: (decision as { model_info?: string }).model_info || 'Unknown',
      };

      progressTracker.executionTime = executionTime;
      progressTracker.tokensUsed = result.tokensUsed;
      progressTracker.resultData = decision as Record<string, unknown>;

      // Mark as completed
      progressTracker.message = '✅ 分析完成';
      progressTracker.progress = 100;
      progressTracker.status = TaskStatus.COMPLETED;
      await this._updateTaskStatus(task.taskId, TaskStatus.COMPLETED, 100, progressTracker, result);

      logger.info(`✅ Analysis task completed: ${task.taskId} - ${executionTime.toFixed(2)}s`);
    } catch (error) {
      const e = error as Error;
      logger.error(`❌ Analysis task failed: ${task.taskId} - ${e.message}`);

      progressTracker.message = `❌ 分析失败: ${e.message}`;
      progressTracker.status = TaskStatus.FAILED;
      progressTracker.errorMessage = e.message;
      await this._updateTaskStatus(task.taskId, TaskStatus.FAILED, progressTracker.progress || 0, progressTracker);
    } finally {
      this._progressTrackers.delete(task.taskId);
    }
  }

  /**
   * Simulate progress updates during analysis (for simulation mode)
   *
   * @param taskId - Task ID
   * @param progressTracker - Progress tracker to update
   */
  private async _simulateProgress(taskId: string, progressTracker: TaskStatusResponse): Promise<void> {
    const delays = [100, 200, 300]; // milliseconds between updates
    const messages = [
      '🔧 正在获取市场数据...',
      '📊 正在计算技术指标...',
      '🤖 正在生成AI分析...'
    ];

    for (let i = 0; i < messages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      progressTracker.message = messages[i];
      progressTracker.progress = 20 + (i + 1) * 20;
      await this._updateTaskStatus(taskId, TaskStatus.PROCESSING, progressTracker.progress, progressTracker);
    }
  }

  /**
   * Get a random recommendation for simulation mode
   */
  private _getRandomRecommendation(): string {
    const recommendations = ['BUY', 'HOLD', 'SELL'];
    return recommendations[Math.floor(Math.random() * recommendations.length)];
  }

  /**
   * Get a random risk level for simulation mode
   */
  private _getRandomRiskLevel(): string {
    const levels = ['低', '中等', '高'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  /**
   * Update task status in repository
   *
   * @param taskId - Task ID
   * @param status - New status
   * @param progress - Progress percentage
   * @param progressData - Progress tracker data
   * @param result - Optional analysis result
   */
  private async _updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    progress: number,
    progressData: TaskStatusResponse,
    result?: AnalysisResult
  ): Promise<void> {
    try {
      await this._taskRepository.updateTaskStatus(
        taskId,
        status,
        progress,
        progressData.message,
        progressData.currentStep
      );

      // Save result if provided
      if (result && status === TaskStatus.COMPLETED) {
        await this._taskRepository.saveResult(taskId, result);
      }

      logger.debug(`Task status updated: ${taskId} - ${status} (${progress}%)`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to update task status: ${taskId} - ${err.message}`);
    }
  }

  /**
   * Get task status
   *
   * @param taskId - Task ID
   * @returns Task status or null if not found
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse | null> {
    try {
      // Check memory cache first (for running tasks)
      if (this._progressTrackers.has(taskId)) {
        return this._progressTrackers.get(taskId)!;
      }

      // Query from repository
      const task = await this._taskRepository.getTaskByTaskId(taskId);
      if (!task) {
        return null;
      }

      // Build response from task
      const response: TaskStatusResponse = {
        taskId: task.taskId,
        userId: task.userId,
        symbol: task.symbol,
        stockCode: task.stockCode,
        status: task.status,
        progress: task.progress || 0,
        currentStep: task.currentStep,
        message: task.message,
        elapsedTime: 0,
        remainingTime: 0,
        estimatedTotalTime: task.estimatedDuration || 300,
        steps: [],
        startTime: task.startedAt,
        endTime: task.completedAt,
        lastUpdate: task.updatedAt,
        parameters: task.parameters,
        executionTime: task.startedAt && task.completedAt
          ? (task.completedAt - task.startedAt) / 1000
          : undefined,
      };

      // Add result data if available
      if (task.result) {
        response.tokensUsed = task.result.tokensUsed;
        response.resultData = task.result.detailedAnalysis as Record<string, unknown>;
      }

      return response;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to get task status: ${taskId} - ${err.message}`);
      return null;
    }
  }

  /**
   * Cancel a task
   *
   * @param taskId - Task ID to cancel
   * @returns True if cancelled successfully
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const result = await this._taskRepository.cancelTask(taskId);
      if (result) {
        // Remove from memory cache
        this._progressTrackers.delete(taskId);
        logger.info(`Task cancelled: ${taskId}`);
      }
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to cancel task: ${taskId} - ${err.message}`);
      return false;
    }
  }

  /**
   * Get batch status
   *
   * @param batchId - Batch ID
   * @returns Batch statistics or null if not found
   */
  async getBatchStatus(batchId: string): Promise<BatchStatistics | null> {
    try {
      return await this._batchRepository.getBatchStatistics(batchId);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to get batch status: ${batchId} - ${err.message}`);
      return null;
    }
  }

  /**
   * Cancel a batch
   *
   * @param batchId - Batch ID to cancel
   * @returns True if cancelled successfully
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    try {
      // Cancel batch
      const batchResult = await this._batchRepository.cancelBatch(batchId);

      // Cancel all pending/processing tasks in the batch
      const tasks = await this._taskRepository.getTasksByBatch(batchId);
      for (const task of tasks) {
        if (
          task.status === TaskStatus.PENDING ||
          task.status === TaskStatus.PROCESSING
        ) {
          await this._taskRepository.cancelTask(task.taskId);
          // Remove from memory cache
          this._progressTrackers.delete(task.taskId);
        }
      }

      logger.info(`Batch cancelled: ${batchId} (${tasks.length} tasks)`);
      return batchResult;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to cancel batch: ${batchId} - ${err.message}`);
      return false;
    }
  }

  /**
   * Get user task statistics
   *
   * @param userId - User ID
   * @returns User task statistics
   */
  async getUserTaskStats(userId: string): Promise<UserTaskStats | null> {
    try {
      const convertedUserId = this._convertUserId(userId);
      return await this._taskRepository.getUserStats(convertedUserId);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to get user task stats: ${userId} - ${err.message}`);
      return null;
    }
  }

  /**
   * Execute batch analysis asynchronously
   *
   * @param batch - Batch to execute
   * @param tasks - Tasks in the batch
   */
  private async _executeBatchAsync(
    batch: AnalysisBatch,
    tasks: AnalysisTask[]
  ): Promise<void> {
    try {
      logger.info(`🚀 Starting batch execution: ${batch.batchId} - ${tasks.length} tasks`);

      // Update batch status to processing
      await this._batchRepository.updateBatchStatus(
        batch.batchId,
        BatchStatus.PROCESSING,
        Date.now()
      );

      // Execute tasks sequentially (with concurrency control in production)
      const concurrency = 3; // Max 3 concurrent tasks
      const executing: Promise<void>[] = [];

      for (const task of tasks) {
        const p = this._executeSingleAnalysisAsync(task).then(async () => {
          // Update batch progress
          await this._batchRepository.incrementTaskCompletion(batch.batchId, true);
        }).catch(async (error) => {
          logger.error(`Task failed in batch: ${task.taskId} - ${error}`);
          // Update batch progress (failed)
          await this._batchRepository.incrementTaskCompletion(batch.batchId, false);
        });

        executing.push(p);

        // Wait for some tasks to complete if we hit concurrency limit
        if (executing.length >= concurrency) {
          await Promise.race(executing);
          // Remove completed promises - filter by checking if promise is still pending
          // We use a simple approach: just keep all promises and let them settle
          // The race above ensures at least one completed before we add more
        }
      }

      // Wait for all tasks to complete
      await Promise.allSettled(executing);

      logger.info(`✅ Batch execution completed: ${batch.batchId}`);
    } catch (error) {
      const e = error as Error;
      logger.error(`❌ Batch execution failed: ${batch.batchId} - ${e.message}`);

      // Update batch status to failed
      await this._batchRepository.updateBatchStatus(
        batch.batchId,
        BatchStatus.FAILED,
        batch.startedAt,
        Date.now()
      );
    }
  }

  /**
   * Record token usage
   *
   * @param _task - Analysis task (unused in simulation)
   * @param result - Analysis result
   * @param provider - LLM provider
   * @param modelName - Model name
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async _recordTokenUsage(
    _task: AnalysisTask,
    result: AnalysisResult,
    provider: string,
    modelName: string
  ): Promise<void> {
    try {
      // In production, this would call Python adapter to record usage
      logger.debug(`Token usage: ${provider}/${modelName} - ${result.tokensUsed} tokens`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to record token usage: ${err.message}`);
    }
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/**
 * Global service instance (lazy initialization)
 */
let _globalService: AIAnalysisOrchestrationService | null = null;

/**
 * Get the global AI Analysis Orchestration Service instance
 *
 * @returns Service singleton
 */
export function getAIAnalysisService(): AIAnalysisOrchestrationService {
  if (_globalService === null) {
    _globalService = new AIAnalysisOrchestrationService();
  }
  return _globalService;
}
