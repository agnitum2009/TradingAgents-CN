/**
 * Authentication API (v2 Only)
 *
 * Uses TypeScript v2 API endpoints only.
 * Base URL: http://localhost:3001/api/v2/auth
 */

import { apiV2 } from '@/utils/api'
import type {
  LoginForm,
  RegisterForm,
  LoginResponse,
  RefreshTokenResponse,
  User,
  ChangePasswordForm
} from '@/types/auth'

// Map v2 login response to LoginResponse format
function mapLoginResponse(response: any): LoginResponse {
  const data = response.data?.data
  if (!data) {
    throw new Error('Invalid response format from v2 API')
  }

  return {
    access_token: data.token,
    refresh_token: data.refreshToken || data.token,
    token_type: 'Bearer',
    expires_in: data.expiresIn || 86400, // 24 hours default
    user: data.user || {
      id: data.id || '',
      username: data.username || '',
      email: data.email || '',
      is_active: true,
      is_verified: true,
      is_admin: data.roles?.includes('admin') || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      preferences: {
        default_market: 'A股',
        default_depth: '3',
        language: 'zh-CN',
        ui_theme: 'auto',
        notifications_enabled: true,
        email_notifications: false
      },
      daily_quota: 100,
      concurrent_limit: 3,
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0
    }
  }
}

// Map v2 user response to User format
function mapUserResponse(data: any): User {
  return {
    id: data.id || data.sub || '',
    username: data.username || '',
    email: data.email || '',
    avatar: data.avatar,
    is_active: data.isActive ?? true,
    is_verified: data.isVerified ?? true,
    is_admin: data.isAdmin ?? data.roles?.includes('admin') ?? false,
    created_at: data.createdAt || data.created_at || new Date().toISOString(),
    updated_at: data.updatedAt || data.updated_at || new Date().toISOString(),
    last_login: data.lastLogin || data.last_login,
    preferences: data.preferences || {
      default_market: 'A股',
      default_depth: '3',
      language: 'zh-CN',
      ui_theme: 'auto',
      notifications_enabled: true,
      email_notifications: false
    },
    daily_quota: data.dailyQuota ?? 100,
    concurrent_limit: data.concurrentLimit ?? 3,
    total_analyses: data.totalAnalyses ?? 0,
    successful_analyses: data.successfulAnalyses ?? 0,
    failed_analyses: data.failedAnalyses ?? 0
  }
}

export const authApi = {
  /**
   * Login
   * POST /api/v2/auth/login
   */
  async login(data: LoginForm): Promise<LoginResponse> {
    const response = await apiV2.post('/api/v2/auth/login', {
      username: data.username,
      password: data.password
    })
    return mapLoginResponse(response)
  },

  /**
   * Register
   * POST /api/v2/auth/register
   */
  async register(data: RegisterForm): Promise<{ message: string; user?: Partial<User> }> {
    const response = await apiV2.post('/api/v2/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password
    })
    return { message: 'Registration successful', user: response.data?.data }
  },

  /**
   * Logout
   * POST /api/v2/auth/logout
   */
  async logout(): Promise<{ message: string }> {
    await apiV2.post('/api/v2/auth/logout')
    return { message: 'Logged out successfully' }
  },

  /**
   * Refresh token
   * POST /api/v2/auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiV2.post('/api/v2/auth/refresh', { refreshToken })
    return {
      access_token: response.data?.data?.token || response.data?.data?.accessToken,
      refresh_token: response.data?.data?.refreshToken || refreshToken,
      expires_in: response.data?.data?.expiresIn || 86400
    }
  },

  /**
   * Validate token and get user info
   * POST /api/v2/auth/validate
   */
  async validateToken(token?: string): Promise<User> {
    const response = await apiV2.post('/api/v2/auth/validate', token ? { token } : undefined)
    return mapUserResponse(response.data?.data)
  },

  /**
   * Get user info (validates current token)
   * POST /api/v2/auth/validate
   */
  async getUserInfo(): Promise<User> {
    const response = await apiV2.post('/api/v2/auth/validate')
    return mapUserResponse(response.data?.data)
  },

  /**
   * Get auth configuration
   * GET /api/v2/auth/config
   */
  async getAuthConfig(): Promise<{ requireEmailVerification: boolean; allowRegistration: boolean }> {
    const response = await apiV2.get('/api/v2/auth/config')
    return response.data?.data || {
      requireEmailVerification: false,
      allowRegistration: true
    }
  }
}
