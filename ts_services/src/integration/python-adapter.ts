/**
 * Python Integration Adapter
 *
 * Provides a TypeScript interface to call Python services in the TACN backend.
 * Uses Python subprocess communication via stdio with JSON-RPC protocol.
 */

import { spawn, ChildProcess } from 'child_process';
import { injectable, singleton } from 'tsyringe';
import { Logger } from '../utils/logger';

/**
 * JSON-RPC request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown[];
}

/**
 * JSON-RPC response
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Python adapter configuration
 */
export interface PythonAdapterConfig {
  /** Python executable path */
  pythonPath?: string;
  /** Service module path */
  servicePath: string;
  /** Startup timeout (ms) */
  startupTimeout?: number;
  /** Request timeout (ms) */
  requestTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Python adapter for calling Python services from TypeScript
 */
@injectable()
@singleton()
export class PythonAdapter {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestId = 0;
  private isReady = false;
  private readonly logger = Logger.for('PythonAdapter');

  constructor(private readonly config: PythonAdapterConfig) {}

  /**
   * Initialize the Python adapter
   */
  async initialize(): Promise<void> {
    if (this.process) {
      throw new Error('Python adapter already initialized');
    }

    const pythonPath = this.config.pythonPath || 'python3';
    const env = { ...process.env };

    // Set PYTHONPATH to include app directory
    const appPath = process.cwd();
    if (env.PYTHONPATH) {
      env.PYTHONPATH = `${appPath}:${env.PYTHONPATH}`;
    } else {
      env.PYTHONPATH = appPath;
    }

    this.logger.info('Starting Python service', {
      pythonPath,
      servicePath: this.config.servicePath,
    });

    // Spawn Python process
    this.process = spawn(pythonPath, [this.config.servicePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    // Handle stdout (JSON responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleResponse(data.toString());
    });

    // Handle stderr (logging)
    this.process.stderr?.on('data', (data: Buffer) => {
      this.logger.debug('Python stderr', { output: data.toString() });
    });

    // Handle process exit
    this.process.on('close', (code) => {
      this.logger.warn('Python process closed', { code });
      this.isReady = false;
      this.process = null;
      // Reject all pending requests
      for (const [id, { reject, timeout }] of this.pendingRequests) {
        clearTimeout(timeout);
        reject(new Error('Python process closed'));
      }
      this.pendingRequests.clear();
    });

    // Handle process error
    this.process.on('error', (error) => {
      this.logger.error('Python process error', { error });
      this.isReady = false;
    });

    // Wait for ready signal
    await this.waitForReady();
  }

  /**
   * Wait for Python process to be ready
   */
  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python service startup timeout'));
      }, this.config.startupTimeout || 10000);

      // Check for ready signal in responses
      const checkReady = () => {
        if (this.isReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Handle response from Python process
   */
  private handleResponse(data: string): void {
    const lines = data.toString().trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JsonRpcResponse = JSON.parse(line);

        // Handle ready signal
        if (response.id === undefined && 'result' in response) {
          const result = response.result as { status?: string };
          if (result.status === 'ready') {
            this.isReady = true;
            this.logger.info('Python service ready');
          }
          continue;
        }

        // Handle regular response
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(
              new Error(`Python error: ${response.error.message}`),
            );
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        this.logger.warn('Failed to parse Python response', { line, error });
      }
    }
  }

  /**
   * Call a Python method
   */
  async call<T = unknown>(
    method: string,
    ...params: unknown[]
  ): Promise<T> {
    if (!this.process || !this.isReady) {
      throw new Error('Python adapter not ready');
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Python call timeout: ${method}`));
      }, this.config.requestTimeout || 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      try {
        this.process.stdin?.write(JSON.stringify(request) + '\n');
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Shutdown the Python adapter
   */
  async shutdown(): Promise<void> {
    if (this.process) {
      this.logger.info('Shutting down Python service');
      this.process.kill('SIGTERM');
      // Wait up to 5 seconds for graceful shutdown
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
      }, 5000);
      await new Promise((resolve) => {
        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve(undefined);
        });
      });
      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Check if adapter is ready
   */
  get ready(): boolean {
    return this.isReady;
  }
}

/**
 * Factory function to create Python adapter for specific service
 */
export function createPythonAdapter(
  serviceModule: string,
  config?: Partial<PythonAdapterConfig>,
): PythonAdapter {
  const fullConfig: PythonAdapterConfig = {
    servicePath: `${process.cwd()}/app/services/${serviceModule}/_bridge.py`,
    startupTimeout: 10000,
    requestTimeout: 30000,
    debug: false,
    ...config,
  };

  return new PythonAdapter(fullConfig);
}

/**
 * Helper to call Python analysis service
 */
export async function callPythonAnalysis<T = unknown>(
  method: string,
  ...params: unknown[]
): Promise<T> {
  // This would use a singleton instance in production
  const adapter = createPythonAdapter('analysis');
  if (!adapter.ready) {
    await adapter.initialize();
  }
  return adapter.call<T>(method, ...params);
}
