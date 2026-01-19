/**
 * User-related type definitions
 */

import type { Entity } from './common.js';

/**
 * User role
 */
export enum UserRole {
  /** Admin user */
  ADMIN = 'admin',
  /** Regular user */
  USER = 'user',
  /** Guest user */
  GUEST = 'guest',
}

/**
 * User entity
 */
export interface User extends Entity {
  /** Username */
  username: string;
  /** Email */
  email: string;
  /** Display name */
  displayName?: string;
  /** Password hash (never exposed in API) */
  passwordHash?: string;
  /** User role */
  role: UserRole;
  /** Is active */
  isActive: boolean;
  /** API quota */
  apiQuota?: number;
  /** API usage */
  apiUsage?: number;
  /** Preferences */
  preferences: UserPreferences;
  /** Last login */
  lastLoginAt?: number;
}

/**
 * User preferences
 */
export interface UserPreferences {
  /** Theme */
  theme: 'light' | 'dark' | 'auto';
  /** Language */
  language: 'zh' | 'en';
  /** Timezone */
  timezone: string;
  /** Default market */
  defaultMarket?: string;
  /** Default interval */
  defaultInterval?: string;
  /** Notification settings */
  notifications: NotificationSettings;
  /** Display settings */
  display: DisplaySettings;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Email notifications */
  email: boolean;
  /** Browser notifications */
  browser: boolean;
  /** Analysis complete */
  analysisComplete: boolean;
  /** Price alerts */
  priceAlerts: boolean;
  /** News alerts */
  newsAlerts: boolean;
}

/**
 * Display settings
 */
export interface DisplaySettings {
  /** Chart type */
  chartType: 'candlestick' | 'line' | 'area';
  /** Show volume */
  showVolume: boolean;
  /** Show indicators */
  showIndicators: boolean;
  /** Color scheme */
  colorScheme: 'default' | 'monochrome';
}

/**
 * User session
 */
export interface UserSession {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Created at */
  createdAt: number;
  /** Expires at */
  expiresAt: number;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * JWT payload
 */
export interface JWTPayload {
  /** User ID */
  userId: string;
  /** Username */
  username: string;
  /** Role */
  role: UserRole;
  /** Issued at */
  iat: number;
  /** Expires at */
  exp: number;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  /** Username or email */
  username: string;
  /** Password */
  password: string;
  /** Remember me */
  remember?: boolean;
}

/**
 * Auth tokens
 */
export interface AuthTokens {
  /** Access token */
  accessToken: string;
  /** Refresh token */
  refreshToken: string;
  /** Token type */
  tokenType: 'Bearer';
  /** Expires in (seconds) */
  expiresIn: number;
}

/**
 * API usage record
 */
export interface ApiUsageRecord {
  /** User ID */
  userId: string;
  /** Endpoint */
  endpoint: string;
  /** Method */
  method: string;
  /** Timestamp */
  timestamp: number;
  /** Response time (ms) */
  responseTime: number;
  /** Status code */
  statusCode: number;
  /** Token count (for LLM calls) */
  tokenCount?: number;
  /** Cost */
  cost?: number;
}
