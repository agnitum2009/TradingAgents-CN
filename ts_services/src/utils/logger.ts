/**
 * Logger Utility
 *
 * A structured logging utility for TypeScript services.
 * Supports multiple log levels, formatted output, and context awareness.
 */

import * as winston from 'winston';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log metadata
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Log entry context
 */
export interface LogContext {
  /** Context/module name */
  context: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Custom log format
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let log = `${timestamp} | ${level.toUpperCase().padEnd(5)}`;
    if (context) {
      log += ` | ${String(context).padEnd(20)}`;
    }
    log += ` | ${message}`;
    const keys = Object.keys(meta);
    if (keys.length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }
    return log;
  }),
);

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level */
  level?: LogLevel;
  /** Enable console output */
  console?: boolean;
  /** Enable file output */
  file?: boolean;
  /** Log file path */
  filePath?: string;
  /** Enable JSON format */
  json?: boolean;
  /** Additional transports */
  transports?: Array<winston.transport>;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  console: true,
  file: false,
  json: false,
};

/**
 * Logger class for structured logging
 */
export class Logger {
  private static instances = new Map<string, Logger>();
  private readonly _winston: winston.Logger;
  private readonly context: string;

  private constructor(context: string, config: LoggerConfig = {}, existingWinston?: winston.Logger) {
    this.context = context;
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    if (existingWinston) {
      this._winston = existingWinston;
    } else {
      const transportList: Array<winston.transport> = [];

      // Console transport
      if (finalConfig.console) {
        transportList.push(
          new winston.transports.Console({
            format: finalConfig.json
              ? winston.format.combine(winston.format.timestamp(), winston.format.json())
              : customFormat,
          }),
        );
      }

      // File transport
      if (finalConfig.file && finalConfig.filePath) {
        transportList.push(
          new winston.transports.File({
            filename: finalConfig.filePath,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
          }),
        );
      }

      // Custom transports
      if (finalConfig.transports) {
        transportList.push(...finalConfig.transports);
      }

      this._winston = winston.createLogger({
        level: finalConfig.level,
        transports: transportList,
        exitOnError: false,
      });
    }
  }

  // Expose winston as getter for internal use
  private get winston(): winston.Logger {
    return this._winston;
  }

  /**
   * Get or create a logger instance for a context
   */
  static for(context: string, config?: LoggerConfig): Logger {
    if (!Logger.instances.has(context)) {
      Logger.instances.set(context, new Logger(context, config));
    }
    return Logger.instances.get(context)!;
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string, additionalMeta?: LogMetadata): Logger {
    const combinedContext = `${this.context}:${childContext}`;
    // Create child logger with parent's winston instance
    return new Logger(combinedContext, {}, this._winston);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: LogMetadata): void {
    this.winston.debug(message, { context: this.context, ...meta });
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: LogMetadata): void {
    this.winston.info(message, { context: this.context, ...meta });
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: LogMetadata): void {
    this.winston.warn(message, { context: this.context, ...meta });
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, meta?: LogMetadata): void {
    const errorMeta = error instanceof Error
      ? {
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          ...meta,
        }
      : { error, ...meta };

    this.winston.error(message, { context: this.context, ...errorMeta });
  }

  /**
   * Log a message at a specific level
   */
  log(level: LogLevel, message: string, meta?: LogMetadata): void {
    this.winston.log(level, message, { context: this.context, ...meta });
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.winston.level = level;
    // Update all instances
    for (const logger of Array.from(Logger.instances.values())) {
      logger.winston.level = level;
    }
  }

  /**
   * Close the logger and flush any pending logs
   */
  async close(): Promise<void> {
    // Winston's close is deprecated, use childLoggers.close() if available
    const logger = this._winston as winston.Logger & { close?: (cb?: (err?: Error) => void) => void };
    if (typeof logger.close === 'function') {
      await new Promise<void>((resolve, reject) => {
        logger.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Close all logger instances
   */
  static async closeAll(): Promise<void> {
    await Promise.all(Array.from(Logger.instances.values()).map((logger) => logger.close()));
    Logger.instances.clear();
  }
}

/**
 * Create a logger for a specific context
 *
 * @example
 * const logger = Logger.for('MyService');
 * logger.info('Service started');
 * logger.error('Operation failed', new Error('Something went wrong'), { userId: '123' });
 */
export function createLogger(context: string, config?: LoggerConfig): Logger {
  return Logger.for(context, config);
}

/**
 * Set global log level for all loggers
 */
export function setGlobalLogLevel(level: LogLevel): void {
  Logger.for('root').setLevel(level);
}

/**
 * Shutdown all loggers gracefully
 */
export async function shutdownLoggers(): Promise<void> {
  await Logger.closeAll();
}

// Process hooks to ensure logs are flushed on exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await Logger.closeAll();
  });

  process.on('SIGINT', async () => {
    await Logger.closeAll();
  });

  process.on('SIGTERM', async () => {
    await Logger.closeAll();
  });

  process.on('uncaughtException', async (error) => {
    const logger = Logger.for('process');
    logger.error('Uncaught exception', error);
    await Logger.closeAll();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const logger = Logger.for('process');
    logger.error('Unhandled rejection', reason, { promise });
  });
}
