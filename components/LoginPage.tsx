'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from './LanguageProvider'
import LanguageSelector from './LanguageSelector'

interface ValidationState {
  email: string
  password: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<Record<keyof ValidationState, boolean>>({
    email: false,
    password: false,
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()

  const errors: ValidationState = useMemo(() => {
    const next: ValidationState = { email: '', password: '' }

    if (!email) {
      next.email = t('auth.emailRequired')
    } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(email)) {
      next.email = t('auth.emailInvalid')
    }

    if (!password) {
      next.password = t('auth.passwordRequired')
    }

    return next
  }, [email, password, t])

  const hasErrors = Object.values(errors).some(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })

    if (hasErrors) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)

    try {
      await signIn(email, password)
      toast.success(t('auth.loginSuccess'))
      router.replace('/dashboard')
    } catch (error: any) {
      toast.error(error?.message || t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  const renderError = (field: keyof ValidationState) =>
    touched[field] && errors[field] ? (
      <p className="form-error mt-1">{errors[field]}</p>
    ) : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex justify-end md:mb-8">
          <LanguageSelector />
        </div>
        <div className="grid gap-12 rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur md:grid-cols-2 md:p-12">
          <div className="hidden flex-col justify-center md:flex">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary-600">Ovio Merchant</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t('auth.heroTitle')}</h1>
            <p className="mt-4 text-base text-gray-600">
              {t('auth.heroDescription')}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8 text-left">
              <h2 className="text-2xl font-semibold text-gray-900">{t('auth.signInTitle')}</h2>
              <p className="mt-2 text-sm text-gray-500">{t('auth.signInSubtitle')}</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <div className="space-y-5">
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

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="form-label">
                      {t('auth.passwordLabel')}
                    </label>
                    <Link href="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className={`input ${touched.password && errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder={t('auth.passwordPlaceholder')}
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex w-full items-center justify-center gap-2"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeWidth="4" strokeLinecap="round"></path>
                  </svg>
                )}
                {loading ? t('auth.signingIn') : t('auth.signInButton')}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-gray-600">
              <span>{t('auth.noAccount')}</span>{' '}
              <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-700">
                {t('auth.signUpHere')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
