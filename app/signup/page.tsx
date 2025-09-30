'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import LanguageSelector from '@/components/LanguageSelector'
import { callWebhook } from '@/lib/webhook-config'

type Step = 1 | 2 | 3 | 'loading' | 'confirmation'

interface FormData {
  email: string
  password: string
  confirmPassword: string
  name: string
  legal_name: string
  vat_number: string
  street: string
  city: string
  postal_code: string
  country: string
  instagram_handle: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

const VAT_REGEX = /^[A-Z]{2}[A-Z0-9]{8,12}$/

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    legal_name: '',
    vat_number: '',
    street: '',
    city: '',
    postal_code: '',
    country: '',
    instagram_handle: '',
  })
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>(
    Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: false }), {}) as Record<
      keyof FormData,
      boolean
    >
  )
  const router = useRouter()
  const { t } = useTranslation()

  const steps = useMemo(
    () => [
      { id: 1, label: t('signup.stepAccount'), description: t('signup.stepAccountDescription') },
      { id: 2, label: t('signup.stepBusiness'), description: t('signup.stepBusinessDescription') },
      { id: 3, label: t('signup.stepAddress'), description: t('signup.stepAddressDescription') },
    ],
    [t]
  )

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const markTouched = (fields: Array<keyof FormData>) => {
    setTouched((prev) => {
      const next = { ...prev }
      fields.forEach((field) => (next[field] = true))
      return next
    })
  }

  const errors: FormErrors = useMemo(() => {
    const result: FormErrors = {}
    if (step === 1) {
      if (!formData.email) result.email = t('auth.emailRequired')
      else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(formData.email)) result.email = t('auth.emailInvalid')
      if (!formData.password) result.password = t('auth.passwordRequired')
      else if (formData.password.length < 8) result.password = t('signup.passwordDescription')
      if (!formData.confirmPassword) result.confirmPassword = t('signup.confirmPasswordRequired')
      else if (formData.password !== formData.confirmPassword) result.confirmPassword = t('signup.passwordMismatch')
    }
    if (step === 2) {
      if (!formData.name) result.name = t('common.requiredField')
      if (!formData.legal_name) result.legal_name = t('common.requiredField')
      if (formData.vat_number && !VAT_REGEX.test(formData.vat_number.toUpperCase())) result.vat_number = t('signup.vatInvalid')
    }
    if (step === 3) {
      if (!formData.street) result.street = t('common.requiredField')
      if (!formData.city) result.city = t('common.requiredField')
      if (!formData.postal_code) result.postal_code = t('common.requiredField')
      if (!formData.country) result.country = t('common.requiredField')
    }
    return result
  }, [formData, step, t])

  const handleStepSubmit = (fields: Array<keyof FormData>, nextStep: Step) => (e: React.FormEvent) => {
    e.preventDefault()
    markTouched(fields)
    if (Object.keys(errors).length > 0) {
      toast.error(t('auth.fixErrors'))
      return
    }
    setStep(nextStep)
  }

  // --- Final Submit ---
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    markTouched(['street', 'city', 'postal_code', 'country'])
    if (Object.keys(errors).length > 0) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)
    setStep('loading')
    try {
      // 1. Create supabase auth user
      const { auth } = await signUp(formData.email, formData.password)
      if (!auth.user) throw new Error('Failed to create user account')

      // 2. Send business info to webhook
      const webhookResult = await callWebhook('SIGNUP_WEBHOOK', {
        user_id: auth.user.id,
        email: formData.email,
        name: formData.name,
        legal_name: formData.legal_name,
        vat_number: formData.vat_number,
        street: formData.street,
        city: formData.city,
        postal_code: formData.postal_code,
        country: formData.country,
        instagram_handle: formData.instagram_handle,
      })

      if (!webhookResult.success) {
        throw new Error(webhookResult.error || 'Failed to create merchant profile')
      }

      // 3. Show confirmation message
      setStep('confirmation')
    } catch (err: unknown) {
      console.error('Signup error:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      toast.error(errorMessage)
      setStep(3) // back to form
    } finally {
      setLoading(false)
    }
  }

  const StepIndicator = () =>
    step === 1 || step === 2 || step === 3 ? (
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm font-medium text-gray-600">
          <span>{t('signup.stepLabel', { current: step, total: steps.length })}</span>
          <span>{steps[step - 1].label}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-500">{steps[step - 1].description}</p>
      </div>
    ) : null

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
      <div className="mx-auto w-full max-w-6xl relative z-10">
        <div className="mb-6 flex justify-end md:mb-8">
          <LanguageSelector />
        </div>
        <div className="grid gap-12 rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur-sm md:grid-cols-2 md:p-12">
          <div className="hidden flex-col justify-center md:flex">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary-600">Ovio Merchant</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t('signup.heroTitle')}</h1>
            <p className="mt-4 text-base text-gray-600">{t('signup.heroDescription')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            {step !== 'loading' && step !== 'confirmation' && <StepIndicator />}

            {step === 1 && (
              <form className="space-y-6" onSubmit={handleStepSubmit(['email', 'password', 'confirmPassword'], 2)}>
                <div>
                  <input 
                    name="email" 
                    placeholder="Email" 
                    value={formData.email} 
                    onChange={handleInputChange} 
                    className={`input ${touched.email && errors.email ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.email && errors.email && (
                    <p className="form-error mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Password" 
                    value={formData.password} 
                    onChange={handleInputChange} 
                    className={`input ${touched.password && errors.password ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.password && errors.password && (
                    <p className="form-error mt-1">{errors.password}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="confirmPassword" 
                    type="password" 
                    placeholder="Confirm Password" 
                    value={formData.confirmPassword} 
                    onChange={handleInputChange} 
                    className={`input ${touched.confirmPassword && errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.confirmPassword && errors.confirmPassword && (
                    <p className="form-error mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
                <button type="submit" className="btn btn-primary w-full">{t('signup.continue')}</button>
              </form>
            )}

            {step === 2 && (
              <form className="space-y-6" onSubmit={handleStepSubmit(['name', 'legal_name', 'vat_number'], 3)}>
                <div>
                  <input 
                    name="name" 
                    placeholder="Business name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    className={`input ${touched.name && errors.name ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.name && errors.name && (
                    <p className="form-error mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="legal_name" 
                    placeholder="Legal name" 
                    value={formData.legal_name} 
                    onChange={handleInputChange} 
                    className={`input ${touched.legal_name && errors.legal_name ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.legal_name && errors.legal_name && (
                    <p className="form-error mt-1">{errors.legal_name}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="vat_number" 
                    placeholder="VAT number (optional)" 
                    value={formData.vat_number} 
                    onChange={handleInputChange} 
                    className={`input ${touched.vat_number && errors.vat_number ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.vat_number && errors.vat_number && (
                    <p className="form-error mt-1">{errors.vat_number}</p>
                  )}
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">{t('signup.back')}</button>
                  <button type="submit" className="btn btn-primary flex-1">{t('signup.continue')}</button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form className="space-y-6" onSubmit={handleFinalSubmit}>
                <div>
                  <input 
                    name="street" 
                    placeholder="Street" 
                    value={formData.street} 
                    onChange={handleInputChange} 
                    className={`input ${touched.street && errors.street ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.street && errors.street && (
                    <p className="form-error mt-1">{errors.street}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="city" 
                    placeholder="City" 
                    value={formData.city} 
                    onChange={handleInputChange} 
                    className={`input ${touched.city && errors.city ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.city && errors.city && (
                    <p className="form-error mt-1">{errors.city}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="postal_code" 
                    placeholder="Postal code" 
                    value={formData.postal_code} 
                    onChange={handleInputChange} 
                    className={`input ${touched.postal_code && errors.postal_code ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.postal_code && errors.postal_code && (
                    <p className="form-error mt-1">{errors.postal_code}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="country" 
                    placeholder="Country" 
                    value={formData.country} 
                    onChange={handleInputChange} 
                    className={`input ${touched.country && errors.country ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  />
                  {touched.country && errors.country && (
                    <p className="form-error mt-1">{errors.country}</p>
                  )}
                </div>
                <div>
                  <input 
                    name="instagram_handle" 
                    placeholder="Instagram handle (optional)" 
                    value={formData.instagram_handle} 
                    onChange={handleInputChange} 
                    className="input" 
                  />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">{t('signup.back')}</button>
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1">{t('signup.createAccount')}</button>
                </div>
              </form>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                </div>
                <p className="text-lg font-medium mt-4">{t('signup.settingUp')}</p>
                <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">{t('signup.pleaseWait')}</p>
              </div>
            )}

            {step === 'confirmation' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900">{t('signup.confirmAccount')}</p>
                <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">
                  We've sent a confirmation link to <strong>{formData.email}</strong>. Please check your email and click the link to activate your merchant account.
                </p>
                <button
                  className="btn btn-primary mt-6"
                  onClick={() => router.push('/login')}
                >
                  {t('signup.accountConfirmed')}
                </button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-gray-600">
              {t('signup.alreadyHaveAccount')}{' '}
              <Link href="/" className="font-medium text-primary-600 hover:text-primary-700">{t('signup.signIn')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}