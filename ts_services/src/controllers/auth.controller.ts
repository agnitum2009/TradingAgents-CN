/**
 * Authentication Controller
 *
 * Provides authentication endpoints for login, register, token refresh, etc.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import {
  generateToken,
  verifyToken,
  refreshToken,
  getTokenExpiration,
  setAuthConfig,
  getAuthConfig,
} from '../middleware/auth.middleware.js';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  AuthConfigResponse,
} from '../dtos/auth.dto.js';

const logger = Logger.for('AuthController');

/**
 * Mock user database (replace with real database in production)
 */
const mockUsers = new Map<string, {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  createdAt: number;
}>();

/**
 * Initialize mock admin user
 */
mockUsers.set('admin', {
  id: 'user_admin',
  username: 'admin',
  email: 'admin@tacn.local',
  passwordHash: 'admin123', // In production, use bcrypt hash
  roles: ['admin', 'user'],
  createdAt: Date.now(),
});

/**
 * Simple password hash (for demo only - use bcrypt in production)
 */
function hashPassword(password: string): string {
  return password; // TODO: Replace with bcrypt
}

/**
 * Verify password (for demo only - use bcrypt in production)
 */
function verifyPassword(password: string, hash: string): boolean {
  return password === hash; // TODO: Replace with bcrypt
}

/**
 * Authentication Controller
 *
 * Handles user authentication, registration, and token management.
 */
export class AuthController extends BaseRouter {
  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/auth',
      description: 'Authentication endpoints',
      defaultAuthRequired: false, // Auth endpoints are public
    };
    super(config);
    this.registerRoutes();
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // Public endpoints
    this.post<LoginRequest, LoginResponse>(
      '/login',
      this.login.bind(this),
      { authRequired: false }
    );

    this.post<RegisterRequest, RegisterResponse>(
      '/register',
      this.register.bind(this),
      { authRequired: false }
    );

    this.post<RefreshTokenRequest, RefreshTokenResponse>(
      '/refresh',
      this.refreshAccessToken.bind(this),
      { authRequired: false }
    );

    this.post<ValidateTokenRequest, ValidateTokenResponse>(
      '/validate',
      this.validateToken.bind(this),
      { authRequired: false }
    );

    // Protected endpoints (require auth)
    this.get<AuthConfigResponse>(
      '/config',
      this.getAuthConfigInfo.bind(this),
      { authRequired: true }
    );

    this.post<any, { message: string }>(
      '/logout',
      this.logout.bind(this),
      { authRequired: true }
    );
  }

  /**
   * Login endpoint
   * POST /api/v2/auth/login
   */
  private async login(input: any) {
    try {
      const { username, email, password } = input.body as LoginRequest;

      if (!password) {
        return handleRouteError(new Error('Password is required'), input.context.requestId);
      }

      // Find user by username or email
      const user = Array.from(mockUsers.values()).find(
        u => u.username === username || u.email === email
      );

      if (!user) {
        logger.warn(`Login failed: User not found (${username || email})`);
        return handleRouteError(new Error('Invalid credentials'), input.context.requestId);
      }

      // Verify password
      if (!verifyPassword(password, user.passwordHash)) {
        logger.warn(`Login failed: Invalid password for user ${user.username}`);
        return handleRouteError(new Error('Invalid credentials'), input.context.requestId);
      }

      // Generate token
      const token = generateToken({
        sub: user.id,
        username: user.username,
        roles: user.roles,
      });

      logger.info(`User logged in: ${user.username}`);

      const responseData: LoginResponse = {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
        },
        expiresIn: getAuthConfig().expiresIn,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Register endpoint
   * POST /api/v2/auth/register
   */
  private async register(input: any) {
    try {
      const { username, email, password } = input.body as RegisterRequest;

      // Validate input
      if (!username || !email || !password) {
        return handleRouteError(new Error('Username, email, and password are required'), input.context.requestId);
      }

      // Check if user already exists
      const existingUser = Array.from(mockUsers.values()).find(
        u => u.username === username || u.email === email
      );

      if (existingUser) {
        logger.warn(`Registration failed: User already exists (${username})`);
        return handleRouteError(new Error('Username or email already exists'), input.context.requestId);
      }

      // Create new user
      const userId = `user_${Date.now()}`;
      const newUser = {
        id: userId,
        username,
        email,
        passwordHash: hashPassword(password),
        roles: ['user'], // Default role
        createdAt: Date.now(),
      };

      mockUsers.set(userId, newUser);

      // Generate token
      const token = generateToken({
        sub: userId,
        username,
        roles: ['user'],
      });

      logger.info(`New user registered: ${username}`);

      const responseData: RegisterResponse = {
        token,
        user: {
          id: userId,
          username,
          email,
          roles: ['user'],
        },
        expiresIn: getAuthConfig().expiresIn,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Refresh token endpoint
   * POST /api/v2/auth/refresh
   */
  private async refreshAccessToken(input: any) {
    try {
      const { token } = input.body as RefreshTokenRequest;

      if (!token) {
        return handleRouteError(new Error('Token is required'), input.context.requestId);
      }

      // Refresh token
      const newToken = refreshToken({ currentToken: token });

      if (!newToken) {
        return handleRouteError(new Error('Invalid or expired token'), input.context.requestId);
      }

      // Get token expiration
      const expiration = getTokenExpiration(newToken);

      logger.info('Token refreshed');

      const responseData: RefreshTokenResponse = {
        token: newToken,
        expiresIn: getAuthConfig().expiresIn,
        expiresAt: expiration?.getTime(),
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Validate token endpoint
   * POST /api/v2/auth/validate
   */
  private async validateToken(input: any) {
    try {
      const { token } = input.body as ValidateTokenRequest;

      if (!token) {
        return handleRouteError(new Error('Token is required'), input.context.requestId);
      }

      // Verify token
      const payload = verifyToken(token);

      if (!payload) {
        const responseData: ValidateTokenResponse = {
          valid: false,
          error: 'Invalid or expired token',
        };
        return createSuccessResponse(responseData);
      }

      // Get expiration
      const expiration = getTokenExpiration(token);
      const expired = expiration ? expiration < new Date() : false;

      const responseData: ValidateTokenResponse = {
        valid: !expired,
        user: payload.sub ? {
          id: payload.sub,
          username: payload.username,
          roles: payload.roles,
        } : undefined,
        expiresAt: expiration?.getTime(),
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get auth configuration (protected endpoint)
   * GET /api/v2/auth/config
   */
  private async getAuthConfigInfo(input: any) {
    try {
      const config = getAuthConfig();

      const responseData: AuthConfigResponse = {
        expiresIn: config.expiresIn,
        issuer: config.issuer,
        allowCookieToken: config.allowCookieToken,
        allowHeaderToken: config.allowHeaderToken,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Logout endpoint
   * POST /api/v2/auth/logout
   */
  private async logout(input: any) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // by deleting the token. For server-side logout, we'd need
      // to implement token blacklisting.

      const user = input.context.user;
      logger.info(`User logged out: ${user?.userId || 'unknown'}`);

      const responseData = {
        message: 'Logged out successfully',
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }
}
