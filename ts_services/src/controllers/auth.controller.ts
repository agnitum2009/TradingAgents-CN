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
import { hashPassword as hashPasswordBcrypt, verifyPassword as verifyPasswordBcrypt, validatePasswordStrength } from '../utils/password.js';
import { getUserRepository, UserRepository } from '../repositories/user.repository.js';
import { addToBlacklist, isInBlacklist } from '../services/token-blacklist.service.js';
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
 * Authentication Controller
 *
 * Handles user authentication, registration, and token management.
 */
export class AuthController extends BaseRouter {
  private userRepo: UserRepository;

  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/auth',
      description: 'Authentication endpoints',
      defaultAuthRequired: false, // Auth endpoints are public
    };
    super(config);
    this.userRepo = getUserRepository();
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
      const user = await this.userRepo.findByUsernameOrEmail(username || email || '');

      if (!user) {
        logger.warn(`Login failed: User not found (${username || email})`);
        return handleRouteError(new Error('Invalid credentials'), input.context.requestId);
      }

      // Verify password using bcrypt
      const isValid = await verifyPasswordBcrypt(password, user.passwordHash);

      if (!isValid) {
        logger.warn(`Login failed: Invalid password for user ${user.username}`);
        return handleRouteError(new Error('Invalid credentials'), input.context.requestId);
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn(`Login failed: Account disabled for user ${user.username}`);
        return handleRouteError(new Error('Account is disabled'), input.context.requestId);
      }

      // Generate token
      const token = generateToken({
        sub: user.id,
        username: user.username,
        roles: user.roles,
      });

      // Update last login
      await this.userRepo.updateLastLogin(user.id);

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

      // Validate password strength
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        return handleRouteError(new Error(passwordCheck.error || 'Invalid password'), input.context.requestId);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return handleRouteError(new Error('Invalid email format'), input.context.requestId);
      }

      // Validate username format (alphanumeric, 3-20 characters)
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        return handleRouteError(new Error('Username must be 3-20 characters (alphanumeric and underscore only)'), input.context.requestId);
      }

      // Check if user already exists
      const existingUser = await this.userRepo.findByUsernameOrEmail(username);
      if (existingUser && existingUser.username === username) {
        logger.warn(`Registration failed: Username already exists (${username})`);
        return handleRouteError(new Error('Username already exists'), input.context.requestId);
      }

      const existingEmail = await this.userRepo.findByUsernameOrEmail(email);
      if (existingEmail && existingEmail.email === email) {
        logger.warn(`Registration failed: Email already exists (${email})`);
        return handleRouteError(new Error('Email already exists'), input.context.requestId);
      }

      // Hash password using bcrypt
      const passwordHash = await hashPasswordBcrypt(password);

      // Create new user
      const newUser = await this.userRepo.create({
        username,
        email,
        passwordHash,
        roles: ['user'], // Default role
        isActive: true,
      });

      // Generate token
      const token = generateToken({
        sub: newUser.id,
        username: newUser.username,
        roles: newUser.roles,
      });

      logger.info(`New user registered: ${username}`);

      const responseData: RegisterResponse = {
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          roles: newUser.roles,
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

      // Check if token is blacklisted
      const blacklisted = await isInBlacklist(token);
      if (blacklisted) {
        return handleRouteError(new Error('Token has been revoked'), input.context.requestId);
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

      // Check if token is blacklisted
      const blacklisted = await isInBlacklist(token);
      if (blacklisted) {
        const responseData: ValidateTokenResponse = {
          valid: false,
          error: 'Token has been revoked',
        };
        return createSuccessResponse(responseData);
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

      // Get user info
      const user = await this.userRepo.findById(payload.sub);
      if (!user || !user.isActive) {
        const responseData: ValidateTokenResponse = {
          valid: false,
          error: 'User not found or inactive',
        };
        return createSuccessResponse(responseData);
      }

      const responseData: ValidateTokenResponse = {
        valid: !expired,
        user: payload.sub ? {
          id: payload.sub,
          username: payload.username,
          roles: user.roles,
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
   *
   * Adds the current token to the blacklist for server-side logout.
   */
  private async logout(input: any) {
    try {
      const user = input.context.user;

      // Extract token from Authorization header
      const authHeader = input.context.headers['authorization'] || input.context.headers['Authorization'];
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (token) {
        // Add token to blacklist with expiration time
        const expiration = getTokenExpiration(token);
        const ttl = expiration ? Math.max(0, expiration.getTime() - Date.now()) : 7 * 24 * 60 * 60 * 1000; // Default 7 days
        await addToBlacklist(token, ttl);
      }

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
