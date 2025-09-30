/**
 * Environment variable validation for security
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const

const optionalEnvVars = [
  'NEXT_PUBLIC_BILLING_WEBHOOK_URL',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_REGION'
] as const

export interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  NEXT_PUBLIC_BILLING_WEBHOOK_URL?: string
  VERCEL?: string
  VERCEL_ENV?: string
  VERCEL_REGION?: string
}

/**
 * Validates that all required environment variables are present
 * @throws Error if required variables are missing
 */
export function validateEnv(): EnvConfig {
  const missing: string[] = []
  
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate URL formats
  try {
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
  }

  // Validate key formats (basic length check)
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.length < 32) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid')
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY!.length < 32) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid')
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    NEXT_PUBLIC_BILLING_WEBHOOK_URL: process.env.NEXT_PUBLIC_BILLING_WEBHOOK_URL,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION
  }
}

/**
 * Safe environment access with validation
 */
export const env = validateEnv()
