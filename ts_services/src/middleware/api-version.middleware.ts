/**
 * API Version Management Middleware
 *
 * Handles API versioning and deprecation.
 */

import { Logger } from '../utils/logger.js';

const logger = Logger.for('ApiVersionMiddleware');

/**
 * API version information
 */
export interface ApiVersion {
  /** Version string (e.g., "2.0") */
  version: string;
  /** Major version */
  major: number;
  /** Minor version */
  minor: number;
  /** Patch version */
  patch: number;
  /** Release date */
  releasedAt: Date;
  /** Deprecation date (if deprecated) */
  deprecatedAt?: Date;
  /** Sunset date (when it will be removed) */
  sunsetAt?: Date;
  /** Is this the current version? */
  isCurrent: boolean;
  /** Is this deprecated? */
  isDeprecated: boolean;
  /** Is this beta/experimental? */
  isBeta: boolean;
}

/**
 * API version registry
 */
const API_VERSIONS: Record<string, ApiVersion> = {
  '1.0': {
    version: '1.0',
    major: 1,
    minor: 0,
    patch: 0,
    releasedAt: new Date('2024-01-01'),
    isCurrent: false,
    isDeprecated: false,
    isBeta: false,
  },
  '2.0': {
    version: '2.0',
    major: 2,
    minor: 0,
    patch: 0,
    releasedAt: new Date('2026-01-19'),
    isCurrent: true,
    isDeprecated: false,
    isBeta: true,
  },
};

/**
 * Get version info for a version string
 */
export function getVersionInfo(version: string): ApiVersion | undefined {
  return API_VERSIONS[version];
}

/**
 * Get current API version
 */
export function getCurrentVersion(): ApiVersion {
  return Object.values(API_VERSIONS).find((v) => v.isCurrent) || API_VERSIONS['2.0'];
}

/**
 * Get all available API versions
 */
export function getAllVersions(): ApiVersion[] {
  return Object.values(API_VERSIONS).sort((a, b) => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
  });
}

/**
 * Parse version from request
 *
 * Supports:
 * - URL path: /api/v2/...
 * - Header: API-Version: 2.0
 * - Query param: ?version=2.0
 */
export function parseVersionFromRequest(request: {
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}): string {
  // Try URL path first (e.g., /api/v2/...)
  if (request.url) {
    const pathMatch = request.url.match(/\/api\/v(\d+(?:\.\d+)?)\//);
    if (pathMatch) {
      return pathMatch[1];
    }
  }

  // Try header next
  if (request.headers) {
    const headerVersion =
      request.headers['api-version'] ||
      request.headers['API-Version'] ||
      request.headers['x-api-version'] ||
      request.headers['X-API-Version'];
    if (headerVersion) {
      return headerVersion;
    }
  }

  // Try query parameter
  if (request.query?.version) {
    return request.query.version;
  }

  // Default to current version
  return getCurrentVersion().version;
}

/**
 * Normalize version string
 *
 * Converts "2" to "2.0", "2.1" to "2.1.0", etc.
 */
export function normalizeVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length === 1) {
    return `${parts[0]}.0`;
  }
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): boolean {
  const normalized = normalizeVersion(version);
  const versionInfo = getVersionInfo(normalized);

  if (!versionInfo) {
    return false;
  }

  // Check if version has been sunset
  if (versionInfo.sunsetAt && new Date() > versionInfo.sunsetAt) {
    return false;
  }

  return true;
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const normalized = normalizeVersion(version);
  const versionInfo = getVersionInfo(normalized);
  return versionInfo?.isDeprecated || false;
}

/**
 * Get deprecation warning for a version
 */
export function getDeprecationWarning(version: string): string | null {
  const normalized = normalizeVersion(version);
  const versionInfo = getVersionInfo(normalized);

  if (!versionInfo) {
    return null;
  }

  if (versionInfo.isDeprecated && versionInfo.sunsetAt) {
    const daysUntilSunset = Math.ceil(
      (versionInfo.sunsetAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return `API version ${version} is deprecated and will be sunset on ${versionInfo.sunsetAt.toISOString().split('T')[0]} (${daysUntilSunset} days remaining). Please migrate to version ${getCurrentVersion().version}.`;
  }

  if (versionInfo.isBeta) {
    return `API version ${version} is in beta. Features may change before final release.`;
  }

  return null;
}

/**
 * Version compatibility check
 *
 * Checks if client version is compatible with API version
 */
export function isVersionCompatible(
  clientVersion: string,
  apiVersion: string
): boolean {
  const client = normalizeVersion(clientVersion);
  const api = normalizeVersion(apiVersion);

  const clientParts = client.split('.').map(Number);
  const apiParts = api.split('.').map(Number);

  // Major version must match
  if (clientParts[0] !== apiParts[0]) {
    return false;
  }

  // Client minor version must be <= API minor version
  if (clientParts[1] > apiParts[1]) {
    return false;
  }

  return true;
}

/**
 * Create version response headers
 */
export function createVersionHeaders(): Record<string, string> {
  const current = getCurrentVersion();
  const all = getAllVersions();

  return {
    'API-Version': current.version,
    'API-Versions': all.map((v) => v.version).join(', '),
  };
}

/**
 * Log version access
 */
export function logVersionAccess(
  version: string,
  endpoint: string,
  requestId?: string
): void {
  const normalized = normalizeVersion(version);
  const versionInfo = getVersionInfo(normalized);
  const deprecationWarning = getDeprecationWarning(normalized);

  if (deprecationWarning) {
    logger.warn(`Deprecated API version accessed: ${version}`, {
      endpoint,
      version: normalized,
      requestId,
      warning: deprecationWarning,
    });
  } else if (versionInfo?.isBeta) {
    logger.info(`Beta API version accessed: ${version}`, {
      endpoint,
      version: normalized,
      requestId,
    });
  } else {
    logger.debug(`API version accessed: ${version}`, {
      endpoint,
      version: normalized,
      requestId,
    });
  }
}

/**
 * Version middleware options
 */
export interface VersionMiddlewareOptions {
  /** Allow unsupported versions? Default: false */
  allowUnsupported?: boolean;
  /** Allow deprecated versions? Default: true */
  allowDeprecated?: boolean;
  /** Warn on deprecated access? Default: true */
  warnOnDeprecated?: boolean;
  /** Require version header? Default: false */
  requireVersionHeader?: boolean;
}

/**
 * Create version check result
 */
export interface VersionCheckResult {
  /** Is version valid? */
  valid: boolean;
  /** Version string */
  version: string;
  /** Version info */
  versionInfo?: ApiVersion;
  /** Error message if invalid */
  error?: string;
  /** Warning message */
  warning?: string;
  /** Suggested version */
  suggestedVersion?: string;
}

/**
 * Check request version
 *
 * Performs all version checks and returns a result object.
 */
export function checkRequestVersion(
  request: {
    url?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  },
  options: VersionMiddlewareOptions = {}
): VersionCheckResult {
  const {
    allowUnsupported = false,
    allowDeprecated = true,
    warnOnDeprecated = true,
  } = options;

  // Parse version from request
  const version = normalizeVersion(parseVersionFromRequest(request));
  const versionInfo = getVersionInfo(version);
  const current = getCurrentVersion();

  // Check if version exists
  if (!versionInfo) {
    return {
      valid: allowUnsupported,
      version,
      error: `Unsupported API version: ${version}. Supported versions: ${Object.keys(API_VERSIONS).join(', ')}`,
      suggestedVersion: current.version,
    };
  }

  // Check if version is sunset
  if (versionInfo.sunsetAt && new Date() > versionInfo.sunsetAt) {
    return {
      valid: allowUnsupported,
      version,
      error: `API version ${version} has been sunset. Please use version ${current.version}`,
      suggestedVersion: current.version,
    };
  }

  // Check if version is deprecated
  if (versionInfo.isDeprecated && !allowDeprecated) {
    return {
      valid: false,
      version,
      error: `API version ${version} is deprecated. Please use version ${current.version}`,
      suggestedVersion: current.version,
    };
  }

  // Build result
  const result: VersionCheckResult = {
    valid: true,
    version,
    versionInfo,
  };

  // Add warning for deprecated or beta versions
  if (warnOnDeprecated && (versionInfo.isDeprecated || versionInfo.isBeta)) {
    result.warning = getDeprecationWarning(version) || undefined;
  }

  return result;
}
