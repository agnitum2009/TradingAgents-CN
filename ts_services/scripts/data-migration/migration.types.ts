/**
 * Data Migration Types
 *
 * Types for data migration operations.
 */

export interface MigrationResult {
  /** Migration name */
  name: string;
  /** Whether migration succeeded */
  success: boolean;
  /** Number of items processed */
  processed: number;
  /** Number of items succeeded */
  succeeded: number;
  /** Number of items failed */
  failed: number;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

export interface MigrationOptions {
  /** Whether to create backups */
  backup?: boolean;
  /** Whether to dry run (no actual changes) */
  dryRun?: boolean;
  /** Batch size for processing */
  batchSize?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
  /** Current item index */
  current: number;
  /** Total items */
  total: number;
  /** Percentage complete */
  percentage: number;
  /** Current item being processed */
  currentItem?: string;
}

export interface DataMapping<TFrom, TTo> {
  /** Transform function */
  transform: (from: TFrom) => TTo | Promise<TTo>;
  /** Validation function */
  validate?: (to: TTo) => boolean | Promise<boolean>;
  /** Filter function (include only items that return true) */
  filter?: (from: TFrom) => boolean | Promise<boolean>;
}

export interface BackupOptions {
  /** Backup directory */
  dir?: string;
  /** Whether to include timestamp */
  timestamp?: boolean;
  /** Compression format */
  format?: 'none' | 'gzip' | 'zip';
}
