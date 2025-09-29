import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: {
        // Use the same storage key as client
        storageKey: 'ovio-merchant-auth',
        autoRefreshToken: true,
        persistSession: true,
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set(name, value, options),
        remove: (name, options) => res.cookies.set(name, '', options),
      },
    }
  )

  // Only run auth check for dashboard routes
  if (!req.nextUrl.pathname.startsWith('/dashboard')) {
    return res
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('Middleware session check:', {
    path: req.nextUrl.pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    storageKey: 'ovio-merchant-auth'
  })

  // Only protect /dashboard routes
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    console.log('No session found, redirecting to /login')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*'],
}