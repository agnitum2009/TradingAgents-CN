/**
 * Batch Queue Type Definitions
 *
 * Type definitions for batch analysis queue management.
 * Based on Python:
 * - app/services/queue_service.py (QueueService)
 * - app/routers/queue.py
 */

import type { Entity } from './common.js';

// =============================================================================
// Task Status
// =============================================================================

/**
 * Queue task status
 */
export enum QueueTaskStatus {
  /** Task is waiting in queue */
  QUEUED = 'queued',
  /** Task is being processed */
  PROCESSING = 'processing',
  /** Task completed successfully */
  COMPLETED = 'completed',
  /** Task failed */
  FAILED = 'failed',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Task priority
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

// =============================================================================
// Task Types
// =============================================================================

/**
 * Queue task
 */
export interface QueueTask extends Entity {
  /** Task ID */
  id: string;
  /** User ID who created the task */
  userId: string;
  /** Stock symbol to analyze */
  symbol: string;
  /** Task status */
  status: QueueTaskStatus;
  /** Task priority */
  priority: TaskPriority;
  /** Task parameters */
  parameters: TaskParameters;
  /** Batch ID (if part of a batch) */
  batchId?: string;
  /** Worker ID processing this task */
  workerId?: string;
  /** Created timestamp */
  createdAt: number;
  /** Enqueued timestamp */
  enqueuedAt: number;
  /** Started timestamp (when processing began) */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Requeued timestamp (if task was requeued) */
  requeuedAt?: number;
  /** Cancelled timestamp */
  cancelledAt?: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Error message (if failed) */
  error?: string;
  /** Task result */
  result?: TaskResult;
}

/**
 * Task parameters
 */
export interface TaskParameters {
  /** Analysis type */
  analysisType?: 'trend' | 'ai' | 'comprehensive';
  /** Time interval */
  interval?: string;
  /** Time period */
  period?: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Task result
 */
export interface TaskResult {
  /** Result data */
  data: unknown;
  /** Success flag */
  success: boolean;
  /** Message */
  message?: string;
  /** Processing duration (ms) */
  duration?: number;
}

// =============================================================================
// Batch Types
// =============================================================================

/**
 * Batch analysis job
 */
export interface BatchJob extends Entity {
  /** Batch ID */
  id: string;
  /** User ID who created the batch */
  userId: string;
  /** Batch name/description */
  name: string;
  /** Batch status */
  status: QueueBatchStatus;
  /** Total tasks submitted */
  totalTasks: number;
  /** Completed tasks count */
  completedTasks: number;
  /** Failed tasks count */
  failedTasks: number;
  /** Task IDs in this batch */
  taskIds: string[];
  /** Common parameters for all tasks */
  parameters: TaskParameters;
  /** Created timestamp */
  createdAt: number;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Batch result summary */
  summary?: BatchSummary;
}

/**
 * Queue batch status
 */
export enum QueueBatchStatus {
  /** Batch is queued */
  QUEUED = 'queued',
  /** Batch is being processed */
  PROCESSING = 'processing',
  /** Batch completed */
  COMPLETED = 'completed',
  /** Batch failed */
  FAILED = 'failed',
  /** Batch was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Batch summary
 */
export interface BatchSummary {
  /** Total tasks */
  total: number;
  /** Successful tasks */
  successful: number;
  /** Failed tasks */
  failed: number;
  /** Skipped tasks */
  skipped: number;
  /** Average processing duration (ms) */
  avgDuration?: number;
  /** Total processing duration (ms) */
  totalDuration?: number;
  /** Results by symbol */
  results: Record<string, TaskResult>;
}

// =============================================================================
// Queue Statistics
// =============================================================================

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of tasks waiting */
  queued: number;
  /** Number of tasks processing */
  processing: number;
  /** Number of tasks completed */
  completed: number;
  /** Number of tasks failed */
  failed: number;
  /** Number of tasks cancelled */
  cancelled: number;
  /** Total tasks in system */
  total: number;
}

/**
 * User queue status
 */
export interface UserQueueStatus {
  /** User ID */
  userId: string;
  /** Number of tasks processing */
  processing: number;
  /** Concurrent limit */
  concurrentLimit: number;
  /** Available slots */
  availableSlots: number;
}

/**
 * Batch queue statistics
 */
export interface BatchQueueStats extends QueueStats {
  /** Active batches */
  activeBatches: number;
  /** Completed batches */
  completedBatches: number;
  /** Pending batches */
  pendingBatches: number;
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Create batch request
 */
export interface CreateBatchRequest {
  /** User ID */
  userId: string;
  /** Stock symbols to analyze */
  symbols: string[];
  /** Common parameters */
  parameters: TaskParameters;
  /** Batch name */
  name?: string;
  /** Priority */
  priority?: TaskPriority;
}

/**
 * Create batch response
 */
export interface CreateBatchResponse {
  /** Batch ID */
  batchId: string;
  /** Number of tasks created */
  taskCount: number;
  /** Estimated completion time (seconds) */
  estimatedDuration?: number;
}

/**
 * Enqueue task request
 */
export interface EnqueueTaskRequest {
  /** User ID */
  userId: string;
  /** Stock symbol */
  symbol: string;
  /** Task parameters */
  parameters: TaskParameters;
  /** Batch ID (optional) */
  batchId?: string;
  /** Priority */
  priority?: TaskPriority;
}

/**
 * Dequeue task request (worker)
 */
export interface DequeueTaskRequest {
  /** Worker ID */
  workerId: string;
  /** Maximum tasks to dequeue */
  maxTasks?: number;
}

/**
 * Acknowledge task request
 */
export interface AckTaskRequest {
  /** Task ID */
  taskId: string;
  /** Success flag */
  success: boolean;
  /** Result data */
  result?: TaskResult;
  /** Error message */
  error?: string;
}

/**
 * Get batch status response
 */
export interface BatchStatusResponse {
  /** Batch ID */
  batchId: string;
  /** Status */
  status: QueueBatchStatus;
  /** Progress */
  progress: number;
  /** Total tasks */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Task statuses */
  taskStatuses: Record<string, QueueTaskStatus>;
  /** Created timestamp */
  createdAt: number;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
}

/**
 * Get task status response
 */
export interface TaskStatusResponse {
  /** Task ID */
  taskId: string;
  /** Status */
  status: QueueTaskStatus;
  /** Symbol */
  symbol: string;
  /** Result */
  result?: TaskResult;
  /** Error */
  error?: string;
  /** Created timestamp */
  createdAt: number;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
}

// =============================================================================
// Worker Types
// =============================================================================

/**
 * Worker info
 */
export interface WorkerInfo {
  /** Worker ID */
  id: string;
  /** Worker type */
  type: 'analysis' | 'batch' | 'cleanup';
  /** Status */
  status: 'idle' | 'busy' | 'offline';
  /** Current task ID */
  currentTaskId?: string;
  /** Tasks processed */
  tasksProcessed: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
  /** Started timestamp */
  startedAt: number;
}

/**
 * Worker heartbeat
 */
export interface WorkerHeartbeat {
  /** Worker ID */
  workerId: string;
  /** Current task ID */
  currentTaskId?: string;
  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Batch queue configuration
 */
export interface BatchQueueConfig {
  /** User concurrent task limit */
  userConcurrentLimit: number;
  /** Global concurrent task limit */
  globalConcurrentLimit: number;
  /** Visibility timeout (seconds) - how long a task can be processing before being requeued */
  visibilityTimeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Task cleanup age (days) - old completed tasks to delete */
  taskCleanupAge: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Worker heartbeat timeout (seconds) */
  workerHeartbeatTimeout: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_BATCH_QUEUE_CONFIG: BatchQueueConfig = {
  userConcurrentLimit: 5,
  globalConcurrentLimit: 50,
  visibilityTimeout: 300, // 5 minutes
  maxRetries: 3,
  taskCleanupAge: 7, // 7 days
  maxQueueSize: 10000,
  workerHeartbeatTimeout: 120, // 2 minutes
};
