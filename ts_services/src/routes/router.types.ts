/**
 * Router type definitions
 *
 * Core types and interfaces for the API v2 routing system.
 */

import type { ErrorResponse, SuccessResponse } from '../dtos/common.dto.js';

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Route parameters
 */
export type RouteParams = Record<string, string | number>;

/**
 * Query parameters
 */
export type QueryParams = Record<string, string | string[] | number | boolean | undefined>;

/**
 * Request context
 */
export interface RequestContext {
  /** Request ID */
  requestId: string;
  /** API version */
  apiVersion: string;
  /** Timestamp */
  timestamp: number;
  /** Request path */
  path: string;
  /** HTTP method */
  method: HttpMethod;
  /** Route parameters */
  params: RouteParams;
  /** Query parameters */
  query: QueryParams;
  /** Request headers */
  headers: Record<string, string>;
  /** User info (if authenticated) */
  user?: UserInfo;
}

/**
 * User information
 */
export interface UserInfo {
  /** User ID */
  userId: string;
  /** Username */
  username?: string;
  /** User roles */
  roles?: string[];
  /** Additional user data */
  data?: Record<string, unknown>;
}

/**
 * Request input
 */
export interface RequestInput<TBody = unknown, TParams = RouteParams, TQuery = QueryParams> {
  /** Request body */
  body: TBody;
  /** Route parameters */
  params: TParams;
  /** Query parameters */
  query: TQuery;
  /** Request headers */
  headers: Record<string, string>;
  /** Request context */
  context: RequestContext;
}

/**
 * Response type
 */
export type Response<T = unknown> =
  | SuccessResponse<T>
  | ErrorResponse;

/**
 * Route handler function
 */
export type RouteHandler<TInput = unknown, TOutput = unknown> = (
  input: RequestInput<TInput>
) => Promise<Response<TOutput>>;

/**
 * Route definition
 */
export interface RouteDefinition<TInput = unknown, TOutput = unknown> {
  /** HTTP method */
  method: HttpMethod;
  /** Route path (relative to router base path) */
  path: string;
  /** Route handler */
  handler: RouteHandler<TInput, TOutput>;
  /** Route description */
  description?: string;
  /** Route tags for grouping */
  tags?: string[];
  /** Authentication required */
  authRequired?: boolean;
  /** Required roles */
  requiredRoles?: string[];
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Is this route deprecated? */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Base path for all routes */
  basePath: string;
  /** Router description */
  description?: string;
  /** Default authentication requirement */
  defaultAuthRequired?: boolean;
  /** Default rate limit */
  defaultRateLimit?: number;
  /** Middleware to apply to all routes */
  middleware?: RouteMiddleware[];
}

/**
 * Route middleware function
 */
export type RouteMiddleware = (
  context: RequestContext,
  next: () => Promise<Response>
) => Promise<Response>;

/**
 * Route registration options
 */
export interface RouteRegistrationOptions {
  /** Override authentication requirement */
  authRequired?: boolean;
  /** Override rate limit */
  rateLimit?: number;
  /** Additional middleware */
  middleware?: RouteMiddleware[];
  /** Mark as deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
}

/**
 * Route registration result
 */
export interface RouteRegistrationResult {
  /** Registered route path */
  path: string;
  /** HTTP method */
  method: HttpMethod;
  /** Full path including base path */
  fullPath: string;
}
