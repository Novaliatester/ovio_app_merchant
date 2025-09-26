/**
 * Vercel-specific configuration for Supabase authentication
 */

export const vercelConfig = {
  // Vercel deployment environment detection
  isVercel: process.env.VERCEL === '1',
  isProduction: process.env.NODE_ENV === 'production',
  isPreview: process.env.VERCEL_ENV === 'preview',
  
  // Vercel-specific timeouts (shorter for edge functions)
  timeouts: {
    session: 5000, // 5 seconds for session operations
    auth: 8000,    // 8 seconds for auth operations
    data: 10000,   // 10 seconds for data operations
  },
  
  // Vercel-specific retry configuration
  retries: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
  },
  
  // Vercel-specific cookie configuration
  cookies: {
    // Use secure cookies in production
    secure: process.env.NODE_ENV === 'production',
    // Use SameSite=Lax for better Vercel compatibility
    sameSite: 'lax' as const,
    // Set appropriate domain for Vercel
    domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost',
  },
  
  // Vercel-specific headers
  headers: {
    'X-Vercel-Environment': process.env.VERCEL_ENV || 'development',
    'X-Vercel-Region': process.env.VERCEL_REGION || 'unknown',
  },
}

/**
 * Get Vercel-optimized timeout for an operation
 */
export function getVercelTimeout(operation: keyof typeof vercelConfig.timeouts): number {
  return vercelConfig.timeouts[operation]
}

/**
 * Check if we're running on Vercel
 */
export function isVercelDeployment(): boolean {
  return vercelConfig.isVercel
}

/**
 * Get retry configuration for Vercel
 */
export function getVercelRetryConfig() {
  return vercelConfig.retries
}

/**
 * Get cookie configuration for Vercel
 */
export function getVercelCookieConfig() {
  return vercelConfig.cookies
}

/**
 * Get Vercel-specific headers
 */
export function getVercelHeaders() {
  return vercelConfig.headers
}
