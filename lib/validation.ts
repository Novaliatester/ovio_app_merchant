/**
 * Enhanced input validation utilities for security
 */

// More robust email validation
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// VAT number validation by country
export const VAT_PATTERNS = {
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  BG: /^BG\d{9,10}$/,
  HR: /^HR\d{11}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  DE: /^DE\d{9}$/,
  GR: /^(EL|GR)\d{9}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE(\d{7}[A-W][A-I]?|\d[A-Z]\d{5}[A-W])$/,
  IT: /^IT\d{11}$/,
  LV: /^LV\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SK: /^SK\d{10}$/,
  SI: /^SI\d{8}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  SE: /^SE\d{12}$/,
  // Generic fallback
  DEFAULT: /^[A-Z]{2}[A-Z0-9]{2,13}$/
}

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate email address with enhanced security
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' }
  }

  const trimmed = email.trim().toLowerCase()
  
  // Length check
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address is too long' }
  }

  // Basic format check
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' }
  }

  // Additional security checks
  const [localPart] = trimmed.split('@')
  
  if (localPart.length > 64) {
    return { isValid: false, error: 'Email local part is too long' }
  }

  // Check for dangerous patterns
  const suspiciousPatterns = [
    /\.\./,  // Consecutive dots
    /^\./, // Starting with dot
    /\.$/, // Ending with dot
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(localPart)) {
      return { isValid: false, error: 'Invalid email format' }
    }
  }

  return { isValid: true }
}

/**
 * Validate password with security requirements
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' }
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' }
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' }
  }

  // Check for complexity
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  const complexityScore = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length

  if (complexityScore < 3) {
    return { 
      isValid: false, 
      error: 'Password must contain at least 3 of: lowercase, uppercase, number, special character' 
    }
  }

  return { isValid: true }
}

/**
 * Validate VAT number with country-specific patterns
 */
export function validateVATNumber(vat: string): ValidationResult {
  if (!vat || vat.trim() === '') {
    return { isValid: true } // VAT is optional
  }

  const normalized = vat.trim().toUpperCase().replace(/[\s-]/g, '')
  
  if (normalized.length < 4 || normalized.length > 15) {
    return { isValid: false, error: 'VAT number length is invalid' }
  }

  const countryCode = normalized.substring(0, 2)
  const pattern = VAT_PATTERNS[countryCode as keyof typeof VAT_PATTERNS] || VAT_PATTERNS.DEFAULT

  if (!pattern.test(normalized)) {
    return { isValid: false, error: 'Invalid VAT number format' }
  }

  return { isValid: true }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (!input) return ''
  
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .slice(0, 1000) // Limit length
}

/**
 * Validate business name
 */
export function validateBusinessName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Business name is required' }
  }

  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Business name must be at least 2 characters' }
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Business name is too long' }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /data:text\/html/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { isValid: false, error: 'Business name contains invalid characters' }
    }
  }

  return { isValid: true }
}

/**
 * Rate limiting utility (simple in-memory implementation)
 */
class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const record = this.attempts.get(identifier)

    if (!record) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now })
      return true
    }

    // Reset if window has passed
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now })
      return true
    }

    // Increment counter
    record.count++
    record.lastAttempt = now

    return record.count <= this.maxAttempts
  }

  getRemainingTime(identifier: string): number {
    const record = this.attempts.get(identifier)
    if (!record) return 0

    const elapsed = Date.now() - record.lastAttempt
    return Math.max(0, this.windowMs - elapsed)
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier)
  }
}

export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000) // 5 attempts per 15 minutes
export const signupRateLimiter = new RateLimiter(3, 60 * 60 * 1000) // 3 attempts per hour
