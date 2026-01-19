/**
 * Integration Test Utilities
 */

import { createRequestContext, type RequestContext } from '../../../src/routes/router.base.js';

/**
 * Create a mock request input
 */
export function createMockInput<TBody = unknown>(
  body?: TBody,
  params?: Record<string, string>,
  query?: Record<string, string>
): {
  body: TBody;
  params: Record<string, string>;
  query: Record<string, string>;
  context: RequestContext;
} {
  return {
    body: body ?? {} as TBody,
    params: params ?? {},
    query: query ?? {},
    context: createRequestContext(),
  };
}

/**
 * Create a mock kline data for testing
 */
export function createMockKlineData(count: number = 30): Array<{
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  changePercent: number;
  changeAmount: number;
}> {
  const klines: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
    changePercent: number;
    changeAmount: number;
  }> = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = 100;

  for (let i = 0; i < count; i++) {
    const open = price + (Math.random() - 0.5) * 2;
    const close = open + (Math.random() - 0.5) * 4;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;

    klines.push({
      timestamp: baseTime + i * 24 * 60 * 60 * 1000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(1000000 + Math.random() * 5000000),
      amount: Number((close * (1000000 + Math.random() * 5000000)).toFixed(2)),
      changePercent: Number(((close - price) / price * 100).toFixed(2)),
      changeAmount: Number((close - price).toFixed(2)),
    });

    price = close;
  }

  return klines;
}

/**
 * Wait for async operation with timeout
 */
export function waitFor<T>(
  condition: () => T | Promise<T>,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const { timeout = 5000, interval = 100 } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        const result = await condition();
        resolve(result);
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Condition not met within ${timeout}ms`));
        } else {
          setTimeout(check, interval);
        }
      }
    };

    check();
  });
}

/**
 * Mock Python adapter response
 */
export function mockPythonAdapterResponse<T>(data: T): T {
  return data;
}

/**
 * Create mock user context
 */
export function createMockUserContext(userId: string = '507f1f77bcf86cd799439011'): RequestContext {
  return createRequestContext({
    user: {
      id: userId,
      username: 'test-user',
    },
  });
}

/**
 * Assert API response structure
 */
export function assertApiResponse(response: unknown): asserts response is {
  success: boolean;
  data: unknown;
  meta?: {
    requestId: string;
    timestamp: number;
  };
} {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Response must be an object');
  }

  const r = response as Record<string, unknown>;

  if (typeof r.success !== 'boolean') {
    throw new Error('Response must have a success boolean field');
  }

  if (!('data' in r)) {
    throw new Error('Response must have a data field');
  }
}

/**
 * Assert error response structure
 */
export function assertErrorResponse(response: unknown): asserts response is {
  success: false;
  error: {
    code: string;
    message: string;
  };
} {
  assertApiResponse(response);

  if (response.success) {
    throw new Error('Expected error response but got success response');
  }

  if (!('error' in response)) {
    throw new Error('Error response must have an error field');
  }
}
