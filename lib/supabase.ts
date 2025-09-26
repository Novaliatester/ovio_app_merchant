import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

const browserClientOptions = {
  auth: {
    // Prevent automatic token refresh conflicts
    autoRefreshToken: true,
    persistSession: true,
    // Use PKCE flow for better security and Vercel compatibility
    flowType: 'pkce' as const,
    // Add debug mode for development
    debug: process.env.NODE_ENV === 'development',
    // Optimize for Vercel deployment
    detectSessionInUrl: false
  },
  // Add request timeout to prevent hanging
  global: {
    headers: {
      'X-Client-Info': 'ovio-merchant-webapp',
      'X-Environment': process.env.NODE_ENV || 'production'
    }
  },
  // Add realtime configuration for better performance
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
}

const createSupabaseBrowserClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey, browserClientOptions)

const getBrowserSupabaseClient = (): BrowserSupabaseClient => {
  const globalScope = globalThis as typeof globalThis & {
    __supabaseBrowserClient?: BrowserSupabaseClient
  }

  if (typeof window === 'undefined') {
    return createSupabaseBrowserClient()
  }

  if (!globalScope.__supabaseBrowserClient) {
    globalScope.__supabaseBrowserClient = createSupabaseBrowserClient()
  }

  return globalScope.__supabaseBrowserClient
}

// Client-side Supabase client with Vercel-optimized configuration
export const supabase = getBrowserSupabaseClient()

// Server-side Supabase client for API routes and SSR
export const createServerSupabaseClient = (
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Handle both NextApiRequest and GetServerSidePropsContext req types
        if ('cookies' in req && req.cookies) {
          return req.cookies[name]
        }
        return undefined
      },
      set(name: string, value: string, options: any) {
        // Handle both NextApiResponse and GetServerSidePropsContext res types
        if ('cookies' in res && res.cookies && typeof (res.cookies as any).set === 'function') {
          (res.cookies as any).set(name, value, options)
        }
      },
      remove(name: string, options: any) {
        // Handle both NextApiResponse and GetServerSidePropsContext res types
        if ('cookies' in res && res.cookies && typeof (res.cookies as any).set === 'function') {
          (res.cookies as any).set(name, '', options)
        }
      },
    },
  })
}

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-key-for-client-side',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
