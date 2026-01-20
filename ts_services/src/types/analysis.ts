/**
 * Analysis-related type definitions
 */

import type {
  Entity,
  AnalysisStatus,
  SignalType,
  SignalStrength,
  TrendDirection,
  VolumeStatus,
  StockCode,
  TrendStatus,
  BuySignal,
} from './common.js';
import type { Kline, TechnicalIndicators } from './stock.js';

/**
 * Trend analysis result (from StockTrendAnalyzer)
 * Based on the trading philosophy:
 * 1. 严进策略 - 不追高，追求每笔交易成功率
 * 2. 趋势交易 - MA5>MA10>MA20 多头排列，顺势而为
 * 3. 效率优先 - 关注筹码结构好的股票
 * 4. 买点偏好 - 在 MA5/MA10 附近回踩买入
 */
export interface TrendAnalysisResult {
  /** Stock code */
  code: string;
  /** Stock name */
  name?: string;

  // Trend determination
  /** Trend status */
  trendStatus: TrendStatus;
  /** MA alignment description */
  maAlignment: string;
  /** Trend strength 0-100 */
  trendStrength: number;

  // Moving averages
  /** MA5 value */
  ma5: number;
  /** MA10 value */
  ma10: number;
  /** MA20 value */
  ma20: number;
  /** MA60 value */
  ma60: number;
  /** Current price */
  currentPrice: number;

  // Bias rates (deviation from MAs)
  /** Bias from MA5: (Close - MA5) / MA5 * 100 */
  biasMa5: number;
  /** Bias from MA10 */
  biasMa10: number;
  /** Bias from MA20 */
  biasMa20: number;

  // Volume analysis
  /** Volume status */
  volumeStatus: VolumeDetailStatus;
  /** Volume ratio vs 5-day average */
  volumeRatio5d: number;
  /** Volume trend description */
  volumeTrend: string;

  // Support/Resistance
  /** MA5 forms support */
  supportMa5: boolean;
  /** MA10 forms support */
  supportMa10: boolean;
  /** Resistance levels */
  resistanceLevels: number[];
  /** Support levels */
  supportLevels: number[];

  // Trading signals
  /** Buy signal recommendation */
  buySignal: BuySignal;
  /** Signal score 0-100 */
  signalScore: number;
  /** Signal reasons */
  signalReasons: string[];
  /** Risk factors */
  riskFactors: string[];

  /** Analysis timestamp */
  timestamp: number;
}

/**
 * Detailed volume status (extended from common.VolumeStatus)
 */
export enum VolumeDetailStatus {
  /** 放量上涨 - Volume up with price up */
  HEAVY_VOLUME_UP = 'heavy_volume_up',
  /** 放量下跌 - Heavy volume down */
  HEAVY_VOLUME_DOWN = 'heavy_volume_down',
  /** 缩量上涨 - Low volume up */
  SHRINK_VOLUME_UP = 'shrink_volume_up',
  /** 缩量回调 - Low volume pullback (preferred) */
  SHRINK_VOLUME_DOWN = 'shrink_volume_down',
  /** 量能正常 - Normal volume */
  NORMAL = 'normal',
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis extends Entity {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Analysis status */
  status: AnalysisStatus;
  /** Trend direction */
  trend: TrendDirection;
  /** Trend strength */
  trendStrength?: SignalStrength;
  /** Volume status */
  volumeStatus: VolumeStatus;
  /** Current phase */
  phase: string;
  /** Key levels */
  keyLevels: KeyLevels;
  /** Technical indicators */
  indicators: TechnicalIndicators;
  /** Analysis signals */
  signals: AnalysisSignal[];
  /** Risk assessment */
  risk: RiskAssessment;
  /** Support and resistance */
  support: number[];
  resistance: number[];
  /** Analysis notes */
  notes?: string;
  /** Analyzer version */
  analyzerVersion: string;
}

/**
 * Key price levels
 */
export interface KeyLevels {
  /** Current price */
  current: number;
  /** Support levels */
  supports: number[];
  /** Resistance levels */
  resistances: number[];
  /** Stop loss level */
  stopLoss?: number;
  /** Take profit levels */
  takeProfits?: number[];
}

/**
 * Analysis signal
 */
export interface AnalysisSignal {
  /** Signal type */
  type: SignalType;
  /** Signal strength */
  strength: SignalStrength;
  /** Signal name/description */
  name: string;
  /** Signal reason */
  reason: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Price level */
  price?: number;
  /** Target price */
  target?: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  /** Overall risk level (0-100) */
  riskLevel: number;
  /** Risk category */
  category: 'low' | 'medium' | 'high' | 'extreme';
  /** Risk factors */
  factors: RiskFactor[];
  /** Suggested position size */
  suggestedPositionSize?: number;
}

/**
 * Risk factor
 */
export interface RiskFactor {
  /** Factor name */
  name: string;
  /** Factor description */
  description: string;
  /** Impact level (0-1) */
  impact: number;
  /** Factor type */
  type: 'technical' | 'fundamental' | 'market' | 'sentiment';
}

/**
 * AI decision result
 */
export interface AIDecision extends Entity {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Decision */
  decision: SignalType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning */
  reasoning: string;
  /** Key points */
  keyPoints: string[];
  /** Risk warnings */
  riskWarnings: string[];
  /** Suggested action */
  suggestedAction: string;
  /** Target price */
  targetPrice?: number;
  /** Stop loss */
  stopLoss?: number;
  /** Time horizon */
  timeHorizon: 'short' | 'medium' | 'long';
  /** Analyst consensus */
  analystConsensus?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  /** LLM provider used */
  llmProvider: string;
  /** Model used */
  model: string;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  /** Stock codes */
  codes: string[];
  /** Start date */
  startDate: string;
  /** End date */
  endDate: string;
  /** Initial capital */
  initialCapital: number;
  /** Position size */
  positionSize: number;
  /** Strategy parameters */
  strategyParams: Record<string, unknown>;
  /** Commission rate */
  commissionRate?: number;
  /** Slippage */
  slippage?: number;
}

/**
 * Backtest result
 */
export interface BacktestResult extends Entity {
  /** Configuration used */
  config: BacktestConfig;
  /** Total trades */
  totalTrades: number;
  /** Winning trades */
  winningTrades: number;
  /** Losing trades */
  losingTrades: number;
  /** Win rate */
  winRate: number;
  /** Total return */
  totalReturn: number;
  /** Annual return */
  annualReturn: number;
  /** Maximum drawdown */
  maxDrawdown: number;
  /** Sharpe ratio */
  sharpeRatio?: number;
  /** Sortino ratio */
  sortinoRatio?: number;
  /** Trade list */
  trades: BacktestTrade[];
  /** Equity curve */
  equityCurve: EquityPoint[];
}

/**
 * Backtest trade
 */
export interface BacktestTrade {
  /** Trade ID */
  id: string;
  /** Stock code */
  code: string;
  /** Entry type */
  entryType: 'long' | 'short';
  /** Entry price */
  entryPrice: number;
  /** Entry time */
  entryTime: number;
  /** Exit price */
  exitPrice?: number;
  /** Exit time */
  exitTime?: number;
  /** Quantity */
  quantity: number;
  /** Profit/Loss */
  pnl?: number;
  /** Return percent */
  returnPercent?: number;
  /** Exit reason */
  exitReason?: string;
}

/**
 * Equity point
 */
export interface EquityPoint {
  /** Timestamp */
  timestamp: number;
  /** Equity value */
  equity: number;
  /** Drawdown */
  drawdown: number;
}

/**
 * Strategy signal
 */
export interface StrategySignal {
  /** Stock code */
  code: string;
  /** Strategy name */
  strategyName: string;
  /** Signal type */
  signalType: SignalType;
  /** Signal strength */
  strength: SignalStrength;
  /** Entry price */
  entryPrice?: number;
  /** Target price */
  targetPrice?: number;
  /** Stop loss */
  stopLoss?: number;
  /** Confidence */
  confidence: number;
  /** Reasoning */
  reasoning?: string;
  /** Timestamp */
  timestamp: number;
  /** Expiration */
  expiresAt?: number;
}

/**
 * Analysis history record
 */
export interface AnalysisHistory extends Entity {
  /** Stock code */
  code: string;
  /** Analysis type */
  analysisType: 'trend' | 'ai' | 'backtest';
  /** Analysis data (JSON) */
  data: Record<string, unknown>;
  /** User ID */
  userId?: string;
}

// =============================================================================
// AI Analysis Orchestration Types (P2-02)
// =============================================================================

/**
 * Research depth levels for AI analysis
 * Supports numeric (1-5) or Chinese levels
 */
export enum ResearchDepth {
  /** Level 1 - 快速分析 */
  QUICK = '快速',
  /** Level 2 - 基础分析 */
  BASIC = '基础',
  /** Level 3 - 标准分析 (推荐) */
  STANDARD = '标准',
  /** Level 4 - 深度分析 */
  DEEP = '深度',
  /** Level 5 - 全面分析 */
  COMPREHENSIVE = '全面',
}

/**
 * Analysis task status
 */
export enum TaskStatus {
  /** Task is pending */
  PENDING = 'pending',
  /** Task is processing */
  PROCESSING = 'processing',
  /** Task completed successfully */
  COMPLETED = 'completed',
  /** Task failed */
  FAILED = 'failed',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Batch analysis status
 */
export enum BatchStatus {
  /** Batch is pending */
  PENDING = 'pending',
  /** Batch is processing */
  PROCESSING = 'processing',
  /** Batch completed successfully */
  COMPLETED = 'completed',
  /** Batch failed */
  FAILED = 'failed',
  /** Batch was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Analysis task parameters
 */
export interface AnalysisParameters {
  /** Research depth (1-5 or Chinese) */
  researchDepth?: number | ResearchDepth;
  /** Selected analysts/agents */
  selectedAnalysts?: string[];
  /** Quick analysis model */
  quickAnalysisModel?: string;
  /** Deep analysis model */
  deepAnalysisModel?: string;
  /** LLM provider */
  llmProvider?: string;
  /** Market type */
  marketType?: string;
  /** Analysis date (YYYY-MM-DD) */
  analysisDate?: string;
  /** Quick model configuration */
  quickModelConfig?: LLMModelConfig;
  /** Deep model configuration */
  deepModelConfig?: LLMModelConfig;
}

/**
 * LLM model configuration
 */
export interface LLMModelConfig {
  /** Maximum tokens */
  maxTokens: number;
  /** Temperature */
  temperature: number;
  /** Timeout in seconds */
  timeout: number;
  /** Retry times */
  retryTimes: number;
  /** API base URL */
  apiBase?: string;
  /** API key */
  apiKey?: string;
}

/**
 * Analysis task
 */
export interface AnalysisTask extends Entity {
  /** Task ID */
  taskId: string;
  /** User ID */
  userId: string;
  /** Batch ID (for batch analysis) */
  batchId?: string;
  /** Stock symbol/code */
  symbol: string;
  /** Stock code (legacy field) */
  stockCode: string;
  /** Analysis parameters */
  parameters: AnalysisParameters;
  /** Task status */
  status: TaskStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current step description */
  currentStep?: string;
  /** Message */
  message?: string;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Estimated duration in seconds */
  estimatedDuration?: number;
  /** Analysis result */
  result?: AnalysisResult;
  /** Error message */
  errorMessage?: string;
}

/**
 * Analysis batch
 */
export interface AnalysisBatch extends Entity {
  /** Batch ID */
  batchId: string;
  /** User ID */
  userId: string;
  /** Batch title */
  title?: string;
  /** Batch description */
  description?: string;
  /** Total tasks */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks?: number;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Analysis parameters (shared by all tasks) */
  parameters: AnalysisParameters;
  /** Batch status */
  status: BatchStatus;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  /** Analysis ID */
  analysisId: string;
  /** Summary */
  summary: string;
  /** Recommendation */
  recommendation: string;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Risk level */
  riskLevel: string;
  /** Key points */
  keyPoints: string[];
  /** Detailed analysis (full decision object) */
  detailedAnalysis: Record<string, unknown>;
  /** Execution time in seconds */
  executionTime: number;
  /** Tokens used */
  tokensUsed: number;
  /** Model information */
  modelInfo: string;
  /** Error message (if analysis failed) */
  errorMessage?: string;
}

/**
 * Single analysis request
 */
export interface SingleAnalysisRequest {
  /** Stock symbol/code */
  symbol?: string;
  /** Stock code (legacy field) */
  stockCode?: string;
  /** Analysis parameters */
  parameters?: AnalysisParameters;
}

/**
 * Batch analysis request
 */
export interface BatchAnalysisRequest {
  /** Stock symbols/codes */
  symbols?: string[];
  /** Stock codes (legacy field) */
  stockCodes?: string[];
  /** Batch title */
  title?: string;
  /** Batch description */
  description?: string;
  /** Analysis parameters (shared by all tasks) */
  parameters?: AnalysisParameters;
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
  /** Task ID */
  taskId: string;
  /** User ID */
  userId?: string;
  /** Stock symbol */
  symbol?: string;
  /** Stock code (legacy) */
  stockCode?: string;
  /** Task status */
  status: TaskStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step */
  currentStep?: string;
  /** Message */
  message?: string;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Remaining time in seconds */
  remainingTime: number;
  /** Estimated total time in seconds */
  estimatedTotalTime: number;
  /** Steps list */
  steps?: TaskStep[];
  /** Start time */
  startTime?: number;
  /** End time */
  endTime?: number;
  /** Last update time */
  lastUpdate?: number;
  /** Analysis parameters */
  parameters?: AnalysisParameters;
  /** Execution time */
  executionTime?: number;
  /** Tokens used */
  tokensUsed?: number;
  /** Result data */
  resultData?: Record<string, unknown>;
  /** Error message */
  errorMessage?: string;
}

/**
 * Task step
 */
export interface TaskStep {
  /** Step name */
  name: string;
  /** Step status */
  status: TaskStatus;
  /** Progress percentage */
  progress: number;
  /** Message */
  message?: string;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
}

/**
 * Progress tracker data (from Redis)
 */
export interface ProgressTrackerData {
  /** Task ID */
  taskId: string;
  /** Status */
  status: TaskStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step */
  currentStep: string;
  /** Message */
  message: string;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Remaining time in seconds */
  remainingTime: number;
  /** Estimated total time in seconds */
  estimatedTotalTime?: number;
  /** Steps list */
  steps: TaskStep[];
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Last update time */
  lastUpdate: number;
  /** Selected analysts */
  analysts: string[];
  /** Research depth */
  researchDepth: string;
  /** LLM provider */
  llmProvider: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (message: string) => void;

/**
 * Progress callback with percentage
 */
export type ProgressCallbackWithPercent = (percent: number, message: string) => void;
