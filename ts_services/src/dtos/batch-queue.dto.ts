/**
 * Batch Queue API v2 DTO types
 *
 * Request/Response types for batch queue management endpoints.
 */

import type {
  QueueTask,
  BatchJob,
  QueueStats,
  WorkerInfo,
  TaskPriority,
  QueueTaskStatus,
} from '../types/batch.js';

// Re-export batch types with renamed status to avoid conflict with analysis.dto.ts
export type {
  QueueTask,
  BatchJob,
  QueueStats,
  WorkerInfo,
  TaskPriority,
};

// Export QueueTaskStatus as QueueTaskStatus to avoid conflict
export type { QueueTaskStatus as QueueTaskStatus };

/**
 * Enqueue task request
 */
export interface EnqueueTaskRequest {
  /** Task type */
  taskType: string;
  /** Task payload */
  payload: Record<string, unknown>;
  /** Priority level */
  priority?: TaskPriority;
  /** Delay execution until (timestamp) */
  delayedUntil?: number;
  /** Timeout in seconds */
  timeout?: number;
  /** Max retries */
  maxRetries?: number;
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Enqueue task response
 */
export interface EnqueueTaskResponse {
  /** Enqueued task */
  task: QueueTask;
  /** Queue position */
  position?: number;
  /** Estimated wait time (seconds) */
  estimatedWait?: number;
}

/**
 * Dequeue task request
 */
export interface DequeueTaskRequest {
  /** Worker ID */
  workerId: string;
  /** Task types to accept */
  acceptTypes?: string[];
  /** Max tasks to dequeue */
  maxTasks?: number;
  /** Worker timeout (seconds) */
  timeout?: number;
}

/**
 * Dequeue task response
 */
export interface DequeueTaskResponse {
  /** Dequeued tasks */
  tasks: QueueTask[];
  /** Worker ID */
  workerId: string;
}

/**
 * Update task status request
 */
export interface UpdateTaskStatusRequest {
  /** Task ID */
  taskId: string;
  /** New status */
  status: QueueTaskStatus;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Result data */
  result?: Record<string, unknown>;
  /** Error message */
  error?: string;
}

/**
 * Complete task request
 */
export interface CompleteTaskRequest {
  /** Task ID */
  taskId: string;
  /** Worker ID */
  workerId: string;
  /** Task result */
  result?: Record<string, unknown>;
  /** Output data */
  output?: unknown;
}

/**
 * Fail task request
 */
export interface FailTaskRequest {
  /** Task ID */
  taskId: string;
  /** Worker ID */
  workerId: string;
  /** Error message */
  error: string;
  /** Error code */
  errorCode?: string;
  /** Retryable flag */
  retryable?: boolean;
}

/**
 * Retry task request
 */
export interface RetryTaskRequest {
  /** Task ID */
  taskId: string;
  /** New priority */
  priority?: TaskPriority;
  /** Delay execution until (timestamp) */
  delayedUntil?: number;
}

/**
 * Cancel task request
 */
export interface CancelTaskRequest {
  /** Task ID */
  taskId: string;
  /** Reason for cancellation */
  reason?: string;
}

/**
 * Get queue stats response
 */
export interface GetQueueStatsResponse {
  /** Queue statistics */
  stats: QueueStats;
  /** Timestamp */
  timestamp: number;
}

/**
 * Get task request
 */
export interface GetTaskRequest {
  /** Task ID */
  taskId: string;
  /** Include result data */
  includeResult?: boolean;
  /** Include payload */
  includePayload?: boolean;
}

/**
 * Get task response
 */
export interface GetTaskResponse {
  /** Task details */
  task: QueueTask;
  /** Task result */
  result?: unknown;
  /** Task payload */
  payload?: Record<string, unknown>;
}

/**
 * List tasks query
 */
export interface ListTasksQuery {
  /** Status filter */
  status?: QueueTaskStatus;
  /** Task type filter */
  taskType?: string;
  /** Worker ID filter */
  workerId?: string;
  /** Date from (ISO 8601) */
  createdFrom?: string;
  /** Date to (ISO 8601) */
  createdTo?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort by field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * List tasks response
 */
export interface ListTasksResponse {
  /** Tasks */
  tasks: QueueTask[];
  /** Total count */
  total: number;
  /** Pagination info */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has next page */
  hasNext: boolean;
}

/**
 * Create batch job request
 */
export interface CreateBatchJobRequest {
  /** Job name */
  name: string;
  /** Job description */
  description?: string;
  /** Task type */
  taskType: string;
  /** Task payloads */
  payloads: Array<Record<string, unknown>>;
  /** Job options */
  options?: {
    /** Priority level */
    priority?: TaskPriority;
    /** Max concurrent tasks */
    maxConcurrent?: number;
    /** Delay execution until (timestamp) */
    delayedUntil?: number;
    /** Callback URL */
    callbackUrl?: string;
  };
}

/**
 * Create batch job response
 */
export interface CreateBatchJobResponse {
  /** Batch job */
  job: BatchJob;
  /** Enqueued tasks count */
  tasksEnqueued: number;
}

/**
 * Get batch job request
 */
export interface GetBatchJobRequest {
  /** Batch job ID */
  jobId: string;
  /** Include tasks */
  includeTasks?: boolean;
}

/**
 * Get batch job response
 */
export interface GetBatchJobResponse {
  /** Batch job details */
  job: BatchJob;
  /** Job tasks */
  tasks?: QueueTask[];
}

/**
 * List batch jobs query
 */
export interface ListBatchJobsQuery {
  /** Status filter */
  status?: QueueTaskStatus;
  /** Date from (ISO 8601) */
  createdFrom?: string;
  /** Date to (ISO 8601) */
  createdTo?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * List batch jobs response
 */
export interface ListBatchJobsResponse {
  /** Batch jobs */
  jobs: BatchJob[];
  /** Total count */
  total: number;
  /** Pagination info */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has next page */
  hasNext: boolean;
}

/**
 * Register worker request
 */
export interface RegisterWorkerRequest {
  /** Worker ID */
  workerId: string;
  /** Worker name */
  name?: string;
  /** Supported task types */
  supportedTypes: string[];
  /** Max concurrent tasks */
  maxConcurrent?: number;
  /** Worker metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Register worker response
 */
export interface RegisterWorkerResponse {
  /** Worker info */
  worker: WorkerInfo;
  /** Registered timestamp */
  registeredAt: number;
}

/**
 * Update worker heartbeat request
 */
export interface UpdateWorkerHeartbeatRequest {
  /** Worker ID */
  workerId: string;
  /** Current tasks count */
  currentTasks?: number;
  /** Worker status */
  status?: 'idle' | 'busy' | 'draining';
}

/**
 * List workers query
 */
export interface ListWorkersQuery {
  /** Status filter */
  status?: 'idle' | 'busy' | 'draining';
  /** Task type filter */
  supportsType?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * List workers response
 */
export interface ListWorkersResponse {
  /** Workers */
  workers: WorkerInfo[];
  /** Total count */
  total: number;
  /** Active workers */
  activeCount: number;
  /** Idle workers */
  idleCount: number;
}
