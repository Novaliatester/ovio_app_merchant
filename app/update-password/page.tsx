'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/components/LanguageProvider'
import LanguageSelector from '@/components/LanguageSelector'
import { supabase } from '@/lib/supabase'

interface ValidationState {
  password: string
  confirmPassword: string
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [touched, setTouched] = useState<Record<keyof ValidationState, boolean>>({
    password: false,
    confirmPassword: false,
  })
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    // Check if user has a valid session for password reset
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('auth.invalidResetLink'))
        router.replace('/forgot-password')
      }
    }
    checkSession()
  }, [router, t])

  const errors: ValidationState = useMemo(() => {
    const next: ValidationState = { password: '', confirmPassword: '' }

    if (!password) {
      next.password = t('auth.passwordRequired')
    } else if (password.length < 8) {
      next.password = t('auth.passwordMinLength')
    }

    if (!confirmPassword) {
      next.confirmPassword = t('auth.confirmPasswordRequired')
    } else if (password !== confirmPassword) {
      next.confirmPassword = t('auth.passwordMismatch')
    }

    return next
  }, [password, confirmPassword, t])

  const hasErrors = Object.values(errors).some(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ password: true, confirmPassword: true })

    if (hasErrors) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setPasswordUpdated(true)
      toast.success(t('auth.passwordUpdatedSuccess'))
    } catch (error: unknown) {
      console.error('Password update error:', error)
      toast.error(error instanceof Error ? error.message : t('auth.passwordUpdateError'))
    } finally {
      setLoading(false)
    }
  }

  if (passwordUpdated) {
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.passwordUpdatedTitle')}</h1>
              <p className="text-sm text-gray-600 text-center mb-6">
                {t('auth.passwordUpdatedMessage')}
              </p>
              <button
                onClick={() => router.replace('/dashboard')}
                className="btn btn-primary w-full"
              >
                {t('auth.goToDashboard')}
              </button>
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
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="mx-auto w-full max-w-md relative z-10">
        <div className="mb-6 flex justify-end">
          <LanguageSelector />
        </div>
        <div className="rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('auth.updatePasswordTitle')}</h1>
            <p className="mt-2 text-gray-600">{t('auth.updatePasswordDescription')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="form-label">
                {t('auth.newPasswordLabel')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className={`input ${touched.password && errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder={t('auth.newPasswordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                aria-invalid={Boolean(touched.password && errors.password)}
                aria-describedby="password-error"
              />
              {touched.password && errors.password ? (
                <p id="password-error" className="form-error mt-1">
                  {errors.password}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                {t('auth.confirmNewPasswordLabel')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className={`input ${touched.confirmPassword && errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder={t('auth.confirmNewPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                aria-invalid={Boolean(touched.confirmPassword && errors.confirmPassword)}
                aria-describedby="confirm-password-error"
              />
              {touched.confirmPassword && errors.confirmPassword ? (
                <p id="confirm-password-error" className="form-error mt-1">
                  {errors.confirmPassword}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? t('auth.updating') : t('auth.updatePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
