/**
 * Authentication API Tests
 *
 * Unit tests for auth API (v2) functionality.
 */

// Mock apiV2 module (must be before imports)
vi.mock('@/utils/api', () => ({
  apiV2: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { apiV2 } from '@/utils/api'

describe('authApi (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should send login request to v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'test-token-123',
            refreshToken: 'refresh-token-456',
            expiresIn: 86400,
            user: {
              id: 'user-123',
              username: 'testuser',
              email: 'test@example.com',
              roles: ['user'],
            },
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.login({
        username: 'testuser',
        password: 'password123',
      })

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/login', {
        username: 'testuser',
        password: 'password123',
      })

      expect(result.access_token).toBe('test-token-123')
      expect(result.refresh_token).toBe('refresh-token-456')
      expect(result.token_type).toBe('Bearer')
      expect(result.expires_in).toBe(86400)
    })

    it('should map user data correctly', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'test-token',
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            roles: ['admin'],
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.login({
        username: 'testuser',
        password: 'password123',
      })

      expect(result.user).toMatchObject({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        is_admin: true,
      })
    })

    it('should handle admin role correctly', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'test-token',
            id: 'user-123',
            username: 'admin',
            roles: ['admin'],
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.login({
        username: 'admin',
        password: 'admin123',
      })

      expect(result.user.is_admin).toBe(true)
    })

    it('should throw error on invalid response format', async () => {
      vi.mocked(apiV2.post).mockResolvedValue({ data: {} } as any)

      await expect(authApi.login({
        username: 'testuser',
        password: 'password123',
      })).rejects.toThrow('Invalid response format from v2 API')
    })
  })

  describe('register', () => {
    it('should send registration request to v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'new-user-123',
            username: 'newuser',
            email: 'new@example.com',
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        confirm_password: 'Password123!',
        agreement: true,
      })

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/register', {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      })

      expect(result.message).toBe('Registration successful')
      expect(result.user).toMatchObject({
        id: 'new-user-123',
        username: 'newuser',
      })
    })
  })

  describe('logout', () => {
    it('should send logout request to v2 API', async () => {
      vi.mocked(apiV2.post).mockResolvedValue({ data: { data: {} } } as any)

      const result = await authApi.logout()

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/logout')
      expect(result.message).toBe('Logged out successfully')
    })
  })

  describe('refreshToken', () => {
    it('should send refresh token request to v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 86400,
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.refreshToken('old-refresh-token')

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/refresh', {
        refreshToken: 'old-refresh-token',
      })

      expect(result.access_token).toBe('new-access-token')
      expect(result.refresh_token).toBe('new-refresh-token')
      expect(result.expires_in).toBe(86400)
    })

    it('should use original refresh token if not returned', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'new-access-token',
            expiresIn: 86400,
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.refreshToken('original-refresh-token')

      expect(result.refresh_token).toBe('original-refresh-token')
    })
  })

  describe('validateToken', () => {
    it('should validate token and return user info', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            isAdmin: true,
            isActive: true,
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.validateToken('test-token')

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/validate', {
        token: 'test-token',
      })

      expect(result).toMatchObject({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        is_admin: true,
        is_active: true,
      })
    })

    it('should validate without token parameter', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'user-123',
            username: 'testuser',
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      await authApi.validateToken()

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/validate', undefined)
    })

    it('should map camelCase response to snake_case', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            isActive: false,
            isVerified: true,
            isAdmin: false,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
            dailyQuota: 200,
            concurrentLimit: 5,
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.validateToken()

      expect(result.is_active).toBe(false)
      expect(result.is_verified).toBe(true)
      expect(result.is_admin).toBe(false)
      expect(result.daily_quota).toBe(200)
      expect(result.concurrent_limit).toBe(5)
    })
  })

  describe('getUserInfo', () => {
    it('should get current user info', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            preferences: {
              default_market: '美股',
              default_depth: '5',
            },
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.getUserInfo()

      expect(apiV2.post).toHaveBeenCalledWith('/api/v2/auth/validate')
      expect(result).toMatchObject({
        id: 'user-123',
        username: 'testuser',
      })
    })

    it('should use default preferences if not provided', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'user-123',
            username: 'testuser',
          },
        },
      }

      vi.mocked(apiV2.post).mockResolvedValue(mockResponse as any)

      const result = await authApi.getUserInfo()

      expect(result.preferences).toMatchObject({
        default_market: 'A股',
        default_depth: '3',
        language: 'zh-CN',
        ui_theme: 'auto',
        notifications_enabled: true,
        email_notifications: false,
      })
    })
  })

  describe('getAuthConfig', () => {
    it('should get auth configuration', async () => {
      const mockResponse = {
        data: {
          data: {
            requireEmailVerification: true,
            allowRegistration: true,
          },
        },
      }

      vi.mocked(apiV2.get).mockResolvedValue(mockResponse as any)

      const result = await authApi.getAuthConfig()

      expect(apiV2.get).toHaveBeenCalledWith('/api/v2/auth/config')
      expect(result).toMatchObject({
        requireEmailVerification: true,
        allowRegistration: true,
      })
    })

    it('should use default values if config not available', async () => {
      vi.mocked(apiV2.get).mockResolvedValue({ data: {} } as any)

      const result = await authApi.getAuthConfig()

      expect(result).toMatchObject({
        requireEmailVerification: false,
        allowRegistration: true,
      })
    })
  })
})
