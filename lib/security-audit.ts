/**
 * Security audit and monitoring utilities
 */

export interface SecurityEvent {
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'suspicious_activity' | 'rate_limit_exceeded'
  userId?: string
  email?: string
  ip?: string
  userAgent?: string
  timestamp: Date
  details?: Record<string, unknown>
}

class SecurityAuditor {
  private events: SecurityEvent[] = []
  private readonly maxEvents = 1000

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    }

    this.events.push(fullEvent)

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Security Event:', fullEvent)
    }

    // In production, you would send this to your monitoring service
    // e.g., Sentry, LogRocket, DataDog, etc.
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit)
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEvent['type'], limit: number = 50): SecurityEvent[] {
    return this.events
      .filter(event => event.type === type)
      .slice(-limit)
  }

  /**
   * Check for suspicious patterns
   */
  detectSuspiciousActivity(userId?: string, email?: string): boolean {
    const recentEvents = this.getRecentEvents(100)
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Check for multiple failed login attempts
    const recentFailures = recentEvents.filter(event => 
      event.type === 'login_failure' &&
      event.timestamp > oneHourAgo &&
      (event.userId === userId || event.email === email)
    )

    if (recentFailures.length >= 5) {
      return true
    }

    // Check for rapid-fire attempts (more than 10 attempts in 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const rapidAttempts = recentEvents.filter(event =>
      event.type === 'login_attempt' &&
      event.timestamp > fiveMinutesAgo &&
      (event.userId === userId || event.email === email)
    )

    if (rapidAttempts.length >= 10) {
      return true
    }

    return false
  }

  /**
   * Clear old events (cleanup)
   */
  cleanup(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    this.events = this.events.filter(event => event.timestamp > oneWeekAgo)
  }
}

export const securityAuditor = new SecurityAuditor()

/**
 * Security headers validation
 */
export function validateSecurityHeaders(headers: Headers): {
  score: number
  missing: string[]
  recommendations: string[]
} {
  const requiredHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security',
    'content-security-policy'
  ]

  const missing: string[] = []
  const recommendations: string[] = []

  for (const header of requiredHeaders) {
    if (!headers.get(header)) {
      missing.push(header)
    }
  }

  let score = Math.max(0, 100 - (missing.length * 25))

  // Check CSP quality
  const csp = headers.get('content-security-policy')
  if (csp) {
    if (csp.includes("'unsafe-inline'")) {
      score -= 10
      recommendations.push('Consider removing unsafe-inline from CSP')
    }
    if (csp.includes("'unsafe-eval'")) {
      score -= 10
      recommendations.push('Consider removing unsafe-eval from CSP')
    }
  }

  // Check HSTS quality
  const hsts = headers.get('strict-transport-security')
  if (hsts && !hsts.includes('includeSubDomains')) {
    recommendations.push('Consider adding includeSubDomains to HSTS')
  }

  return { score, missing, recommendations }
}

/**
 * Password strength analyzer
 */
export function analyzePasswordStrength(password: string): {
  score: number
  feedback: string[]
  isWeak: boolean
} {
  const feedback: string[] = []
  let score = 0

  // Length scoring
  if (password.length >= 12) score += 25
  else if (password.length >= 8) score += 15
  else {
    feedback.push('Use at least 8 characters (12+ recommended)')
  }

  // Character variety
  if (/[a-z]/.test(password)) score += 10
  else feedback.push('Include lowercase letters')

  if (/[A-Z]/.test(password)) score += 10
  else feedback.push('Include uppercase letters')

  if (/\d/.test(password)) score += 10
  else feedback.push('Include numbers')

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15
  else feedback.push('Include special characters')

  // Patterns that reduce security
  if (/(.)\1{2,}/.test(password)) {
    score -= 10
    feedback.push('Avoid repeating characters')
  }

  if (/123|abc|qwe|password|admin/i.test(password)) {
    score -= 20
    feedback.push('Avoid common patterns and words')
  }

  // Entropy bonus for longer passwords
  if (password.length >= 16) score += 20

  const isWeak = score < 60

  return {
    score: Math.max(0, Math.min(100, score)),
    feedback,
    isWeak
  }
}

/**
 * Utility to sanitize user input for logging
 */
export function sanitizeForLogging(obj: unknown): unknown {
  const sensitive = ['password', 'token', 'key', 'secret', 'authorization']
  
  if (typeof obj === 'string') {
    return obj.length > 100 ? obj.substring(0, 100) + '...' : obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging)
  }

  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()
      if (sensitive.some(s => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }
    return sanitized
  }

  return obj
}
