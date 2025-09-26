import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

// Unique storage key so we don’t clash with other clients
const storageKey = 'ovio-merchant-auth'

// ✅ Browser client – only one instance
const getBrowserSupabaseClient = (): BrowserSupabaseClient => {
  const globalScope = globalThis as typeof globalThis & {
    __supabaseClient?: BrowserSupabaseClient
  }

  if (!globalScope.__supabaseClient) {
    globalScope.__supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey,
        autoRefreshToken: true,
        persistSession: true,
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    })
  }

  return globalScope.__supabaseClient
}

// 👉 Use this everywhere in client components
export const supabase = getBrowserSupabaseClient()

// 👉 Server client for SSR / API handlers
export const createServerSupabaseClient = (
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return 'cookies' in req ? req.cookies[name] : undefined
      },
      set(name, value, options) {
        if ('cookies' in res && typeof (res.cookies as any).set === 'function') {
          (res.cookies as any).set(name, value, options)
        }
      },
      remove(name, options) {
        if ('cookies' in res && typeof (res.cookies as any).set === 'function') {
          (res.cookies as any).set(name, '', options)
        }
      },
    },
  })
}

// 👉 Admin client (server-only, never in browser)
export function getSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client is server-only')
  }
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}