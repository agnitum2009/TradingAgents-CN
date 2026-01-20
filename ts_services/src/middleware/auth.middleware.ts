/**
 * JWT Authentication Middleware
 *
 * Provides JWT-based authentication for API routes.
 * Supports both Bearer token and cookie-based authentication.
 */

import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger.js';
import type { RouteMiddleware, RequestContext } from '../routes/router.types.js';
import { createErrorResponse } from './index.js';

const logger = Logger.for('AuthMiddleware');

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** User ID */
  sub: string;
  /** Username */
  username?: string;
  /** User roles */
  roles?: string[];
  /** Issued at */
  iat: number;
  /** Expiration time */
  exp: number;
  /** Issuer */
  iss?: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** JWT secret key */
  secret: string;
  /** Token expiration time (e.g., '1h', '7d', '30d') */
  expiresIn: string;
  /** Issuer */
  issuer?: string;
  /** Cookie name for token storage */
  cookieName?: string;
  /** Allow tokens from cookies */
  allowCookieToken?: boolean;
  /** Allow tokens from Authorization header */
  allowHeaderToken?: boolean;
}

/**
 * Default authentication configuration
 */
const defaultConfig: AuthConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  issuer: process.env.JWT_ISSUER || 'tacn-api',
  cookieName: 'tacn_token',
  allowCookieToken: true,
  allowHeaderToken: true,
};

/**
 * Current authentication configuration
 */
let authConfig: AuthConfig = { ...defaultConfig };

/**
 * Update authentication configuration
 */
export function setAuthConfig(config: Partial<AuthConfig>): void {
  authConfig = { ...authConfig, ...config };
  logger.info('Auth configuration updated');
}

/**
 * Get current authentication configuration
 */
export function getAuthConfig(): AuthConfig {
  return { ...authConfig };
}

/**
 * Generate JWT token for a user
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(payload, authConfig.secret, {
    expiresIn: authConfig.expiresIn,
    issuer: authConfig.issuer,
  });

  logger.debug(`Token generated for user: ${payload.sub}`);
  return token;
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, authConfig.secret, {
      issuer: authConfig.issuer,
    }) as JwtPayload;

    logger.debug(`Token verified for user: ${decoded.sub}`);
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error: error.message });
    } else {
      logger.error('Token verification error', { error });
    }
    return null;
  }
}

/**
 * Extract token from request
 */
export function extractToken(context: RequestContext): string | null {
  const { headers } = context;

  // Try Authorization header first (Bearer token)
  if (authConfig.allowHeaderToken) {
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
  }

  // Try cookie
  if (authConfig.allowCookieToken && authConfig.cookieName) {
    const cookieHeader = headers['cookie'] || headers['Cookie'];
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const tokenCookie = cookies.find(c => c.startsWith(`${authConfig.cookieName}=`));
      if (tokenCookie) {
        return tokenCookie.slice(authConfig.cookieName.length + 1);
      }
    }
  }

  return null;
}

/**
 * Authentication error codes
 */
export enum AuthError {
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
}

/**
 * Create authentication error response
 */
function createAuthError(code: AuthError, message: string): ReturnType<typeof createErrorResponse> {
  return createErrorResponse({
    code,
    message,
    statusCode: code === AuthError.MISSING_TOKEN ? 401 : 401,
  });
}

/**
 * Authentication middleware factory
 *
 * Creates middleware that checks for valid JWT token.
 * Optionally checks for required roles.
 */
export function createAuthMiddleware(options?: {
  /** Required roles (user must have at least one) */
  requiredRoles?: string[];
  /** Allow optional auth (no error if token missing) */
  optional?: boolean;
}): RouteMiddleware {
  const { requiredRoles, optional = false } = options || {};

  return async (context: RequestContext, next) => {
    // Extract token
    const token = extractToken(context);

    // No token found
    if (!token) {
      if (optional) {
        // Optional auth - continue without user
        return await next();
      }
      logger.warn('Authentication failed: No token provided');
      return createAuthError(AuthError.MISSING_TOKEN, 'Authentication required');
    }

    // Verify token
    const payload = verifyToken(token);

    if (!payload) {
      logger.warn('Authentication failed: Invalid or expired token');
      return createAuthError(AuthError.INVALID_TOKEN, 'Invalid or expired token');
    }

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = payload.roles || [];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        logger.warn(`Authorization failed: User ${payload.sub} lacks required roles`, {
          userRoles,
          requiredRoles,
        });
        return createAuthError(
          AuthError.INSUFFICIENT_PERMISSIONS,
          `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`
        );
      }
    }

    // Add user info to context
    context.user = {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };

    logger.debug(`User authenticated: ${payload.sub}`, {
      username: payload.username,
      roles: payload.roles,
    });

    return await next();
  };
}

/**
 * Require authentication middleware
 *
 * Shortcut for createAuthMiddleware() without options.
 */
export const requireAuth = createAuthMiddleware();

/**
 * Optional authentication middleware
 *
 * Authenticates user if token is present, but doesn't require it.
 */
export const optionalAuth = createAuthMiddleware({ optional: true });

/**
 * Require specific role middleware
 *
 * Creates middleware that requires at least one of the specified roles.
 */
export function requireRole(...roles: string[]): RouteMiddleware {
  return createAuthMiddleware({ requiredRoles: roles });
}

/**
 * Require admin role middleware
 */
export const requireAdmin = createAuthMiddleware({ requiredRoles: ['admin'] });

/**
 * Token refresh options
 */
export interface RefreshTokenOptions {
  /** Current token */
  currentToken: string;
  /** Additional payload to include in new token */
  additionalPayload?: Omit<JwtPayload, 'iat' | 'exp' | 'sub'>;
}

/**
 * Refresh JWT token
 *
 * Creates a new token with the same payload but new expiration.
 */
export function refreshToken(options: RefreshTokenOptions): string | null {
  const { currentToken, additionalPayload = {} } = options;

  try {
    // Verify current token (even if expired)
    const decoded = jwt.decode(currentToken) as JwtPayload | null;

    if (!decoded || !decoded.sub) {
      logger.warn('Token refresh failed: Invalid token structure');
      return null;
    }

    // Create new token
    const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: decoded.sub,
      username: decoded.username,
      roles: decoded.roles,
      ...additionalPayload,
    };

    const newToken = generateToken(newPayload);
    logger.info(`Token refreshed for user: ${decoded.sub}`);

    return newToken;
  } catch (error) {
    logger.error('Token refresh error', { error });
    return null;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;

    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  } catch (error) {
    logger.error('Token decode error', { error });
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
export function isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
  const expiration = getTokenExpiration(token);

  if (!expiration) {
    return true;
  }

  const now = new Date();
  const bufferTime = new Date(now.getTime() + bufferSeconds * 1000);

  return expiration < bufferTime;
}
