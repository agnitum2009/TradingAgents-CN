/**
 * Password utility functions
 *
 * Provides secure password hashing and verification using bcrypt.
 */

import bcrypt from 'bcrypt';
import { Logger } from './logger.js';

const logger = Logger.for('PasswordUtil');

// Salt rounds for bcrypt (higher = more secure but slower)
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 *
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    logger.debug('Password hashed successfully');
    return hash;
  } catch (error) {
    logger.error('Failed to hash password', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Verify a password against a hash
 *
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns True if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hash);
    if (!isValid) {
      logger.debug('Password verification failed');
    }
    return isValid;
  } catch (error) {
    logger.error('Failed to verify password', error);
    return false;
  }
}

/**
 * Validate password strength
 *
 * @param password - Password to validate
 * @returns Object with validity status and error message
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one uppercase letter (optional but recommended)
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one uppercase letter' };
  // }

  // Check for at least one number (optional but recommended)
  // if (!/\d/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one number' };
  // }

  return { valid: true };
}
