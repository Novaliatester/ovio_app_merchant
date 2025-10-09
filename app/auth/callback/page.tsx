'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/components/LanguageProvider'
import LanguageSelector from '@/components/LanguageSelector'

function AuthCallbackContent() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check URL parameters first
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        const type = searchParams.get('type')

        if (type === 'recovery' && accessToken && refreshToken) {
          // This is a password reset flow - set the session and redirect
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            setError(sessionError.message)
            return
          }

          toast.success(t('auth.passwordResetLinkValid'))
          router.replace('/update-password')
          return
        }

        // Regular auth callback - check existing session
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          setError(error.message)
          return
        }

        if (data.session) {
          // Regular auth callback - redirect to dashboard
          toast.success(t('auth.loginSuccess'))
          router.replace('/dashboard')
        } else {
          // No session found - redirect to login
          router.replace('/login')
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err)
        setError(t('auth.unexpectedError'))
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router, searchParams, t])

  if (loading) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative"
        style={{
          backgroundImage: 'url(/1271722.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="mx-auto w-full max-w-md relative z-10">
          <div className="mb-6 flex justify-end">
            <LanguageSelector />
          </div>
          <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-lg font-medium mt-4">{t('auth.processing')}</p>
              <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">{t('auth.pleaseWait')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative"
        style={{
          backgroundImage: 'url(/1271722.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="mx-auto w-full max-w-md relative z-10">
          <div className="mb-6 flex justify-end">
            <LanguageSelector />
          </div>
          <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.error')}</h1>
              <p className="text-sm text-gray-600 text-center mb-6">{error}</p>
              <button
                onClick={() => router.replace('/login')}
                className="btn btn-primary w-full"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div 
        className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative"
        style={{
          backgroundImage: 'url(/1271722.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="mx-auto w-full max-w-md relative z-10">
          <div className="mb-6 flex justify-end">
            <LanguageSelector />
          </div>
          <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-lg font-medium mt-4">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
