'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/components/LanguageProvider'
import LanguageSelector from '@/components/LanguageSelector'
import { supabase } from '@/lib/supabase'

interface ValidationState {
  email: string
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [touched, setTouched] = useState<Record<keyof ValidationState, boolean>>({
    email: false,
  })
  const router = useRouter()
  const { t } = useTranslation()

  const errors: ValidationState = useMemo(() => {
    const next: ValidationState = { email: '' }

    if (!email) {
      next.email = t('auth.emailRequired')
    } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(email)) {
      next.email = t('auth.emailInvalid')
    }

    return next
  }, [email, t])

  const hasErrors = Object.values(errors).some(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true })

    if (hasErrors) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (error) throw error

      setEmailSent(true)
      toast.success(t('auth.passwordResetEmailSent'))
    } catch (error: unknown) {
      console.error('Password reset error:', error)
      toast.error(error instanceof Error ? error.message : t('auth.passwordResetError'))
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
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
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="mx-auto w-full max-w-md relative z-10">
          <div className="mb-6 flex justify-end">
            <LanguageSelector />
          </div>
          <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.passwordResetEmailSentTitle')}</h1>
              <p className="text-sm text-gray-600 text-center mb-6">
                {t('auth.passwordResetEmailSentMessage', { email })}
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => {
                    setEmailSent(false)
                    setEmail('')
                    setTouched({ email: false })
                  }}
                  className="btn btn-secondary w-full"
                >
                  {t('auth.sendAnotherEmail')}
                </button>
                <Link href="/login" className="btn btn-primary w-full text-center">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="mx-auto w-full max-w-md relative z-10">
        <div className="mb-6 flex justify-end">
          <LanguageSelector />
        </div>
        <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('auth.forgotPasswordTitle')}</h1>
            <p className="mt-2 text-gray-600">{t('auth.forgotPasswordDescription')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="form-label">
                {t('auth.emailLabel')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={`input ${touched.email && errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                aria-invalid={Boolean(touched.email && errors.email)}
                aria-describedby="email-error"
              />
              {touched.email && errors.email ? (
                <p id="email-error" className="form-error mt-1">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? t('auth.sending') : t('auth.sendResetEmail')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
