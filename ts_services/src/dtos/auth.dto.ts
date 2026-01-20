/**
 * Authentication DTOs
 *
 * Request/Response types for authentication endpoints.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Login request
 */
export interface LoginRequest {
  /** Username (alternative to email) */
  username?: string;
  /** Email (alternative to username) */
  email?: string;
  /** Password */
  password: string;
}

/**
 * Register request
 */
export interface RegisterRequest {
  /** Username (unique) */
  username: string;
  /** Email address (unique) */
  email: string;
  /** Password */
  password: string;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  /** Current token to refresh */
  token: string;
}

/**
 * Validate token request
 */
export interface ValidateTokenRequest {
  /** Token to validate */
  token: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * User info
 */
export interface UserInfo {
  /** User ID */
  id: string;
  /** Username */
  username: string;
  /** Email address */
  email?: string;
  /** User roles */
  roles: string[];
}

/**
 * Login response
 */
export interface LoginResponse {
  /** JWT token */
  token: string;
  /** User information */
  user: UserInfo;
  /** Token expiration time (human-readable) */
  expiresIn: string;
}

/**
 * Register response
 */
export interface RegisterResponse {
  /** JWT token */
  token: string;
  /** User information */
  user: UserInfo;
  /** Token expiration time (human-readable) */
  expiresIn: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
  /** New JWT token */
  token: string;
  /** Token expiration time (human-readable) */
  expiresIn: string;
  /** Token expiration timestamp */
  expiresAt?: number;
}

/**
 * Validate token response
 */
export interface ValidateTokenResponse {
  /** Is token valid? */
  valid: boolean;
  /** User information (if valid) */
  user?: UserInfo;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Error message (if invalid) */
  error?: string;
}

/**
 * Auth configuration response
 */
export interface AuthConfigResponse {
  /** Token expiration time (human-readable) */
  expiresIn: string;
  /** Token issuer */
  issuer?: string;
  /** Allow token from cookies */
  allowCookieToken?: boolean;
  /** Allow token from Authorization header */
  allowHeaderToken?: boolean;
}
