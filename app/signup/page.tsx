'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import LanguageSelector from '@/components/LanguageSelector'
import { uploadMerchantLogo } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

type Step = 1 | 2

interface FormData {
  email: string
  password: string
  confirmPassword: string
  name: string
  legal_name: string
  vat_number: string
  address: string
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
    address: '',
  })
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    email: false,
    password: false,
    confirmPassword: false,
    name: false,
    legal_name: false,
    vat_number: false,
    address: false,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const router = useRouter()
  const { t, language } = useTranslation()

  const steps = useMemo(
    () => [
      { id: 1, label: t('signup.stepAccount'), description: t('signup.stepAccountDescription') },
      { id: 2, label: t('signup.stepBusiness'), description: t('signup.stepBusinessDescription') },
    ],
    [t]
  )

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }

    const nextPreview = URL.createObjectURL(logoFile)
    setLogoPreview(nextPreview)

    return () => {
      URL.revokeObjectURL(nextPreview)
    }
  }, [logoFile])

  const errors: FormErrors = useMemo(() => {
    const result: FormErrors = {}

    if (!formData.email) {
      result.email = t('auth.emailRequired')
    } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(formData.email)) {
      result.email = t('auth.emailInvalid')
    }

    if (!formData.password) {
      result.password = t('auth.passwordRequired')
    } else if (formData.password.length < 8) {
      result.password = t('signup.passwordDescription')
    }

    if (!formData.confirmPassword) {
      result.confirmPassword = t('signup.confirmPasswordRequired')
    } else if (formData.password && formData.password !== formData.confirmPassword) {
      result.confirmPassword = t('signup.passwordMismatch')
    }

    if (!formData.name) {
      result.name = t('common.requiredField')
    }

    if (!formData.legal_name) {
      result.legal_name = t('common.requiredField')
    }

    if (formData.vat_number && !VAT_REGEX.test(formData.vat_number.toUpperCase())) {
      result.vat_number = t('signup.vatInvalid')
    }

    if (!formData.address) {
      result.address = t('common.requiredField')
    }

    return result
  }, [formData, t])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'vat_number' ? value.toUpperCase() : value,
    }))
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
    }
  }

  const markTouched = (fields: Array<keyof FormData>) => {
    setTouched((prev) => {
      const next = { ...prev }
      fields.forEach((field) => {
        next[field] = true
      })
      return next
    })
  }

  const hasStepErrors = (fields: Array<keyof FormData>) =>
    fields.some((field) => Boolean(errors[field]))

  const handleStep1Submit = (event: React.FormEvent) => {
    event.preventDefault()
    const fields: Array<keyof FormData> = ['email', 'password', 'confirmPassword']
    markTouched(fields)

    if (hasStepErrors(fields)) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setStep(2)
  }

  const handleStep2Submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const fields: Array<keyof FormData> = ['name', 'legal_name', 'vat_number', 'address']
    markTouched(fields)

    if (hasStepErrors(fields)) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)

    try {
      const { merchantId } = await signUp(formData.email, formData.password, {
        name: formData.name,
        legal_name: formData.legal_name,
        vat_number: formData.vat_number || undefined,
        address: formData.address,
        preferred_language: language,
      })

      if (merchantId && logoFile) {
        try {
          const { path } = await uploadMerchantLogo(logoFile, merchantId)
          await supabase
            .from('merchants')
            .update({ logo_url: path })
            .eq('id', merchantId)
          setLogoFile(null)
          setLogoPreview(null)
        } catch (uploadError: any) {
          console.error('Error uploading logo during signup:', uploadError)
          toast.error(uploadError?.message || t('profile.saveError'))
        }
      }

      toast.success(t('signup.accountCreated'))
      router.push('/')
    } catch (error: any) {
      toast.error(error?.message || t('signup.accountCreateError'))
    } finally {
      setLoading(false)
    }
  }

  const renderError = (field: keyof FormData) =>
    touched[field] && errors[field] ? (
      <p className="form-error mt-1">{errors[field]}</p>
    ) : null

  const StepIndicator = () => (
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
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex justify-end md:mb-8">
          <LanguageSelector />
        </div>
        <div className="grid gap-12 rounded-3xl bg-white/70 p-8 shadow-lg backdrop-blur md:grid-cols-2 md:p-12">
          <div className="hidden flex-col justify-center md:flex">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary-600">Ovio Merchant</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">{t('signup.heroTitle')}</h1>
            <p className="mt-4 text-base text-gray-600">{t('signup.heroDescription')}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <StepIndicator />

            {step === 1 ? (
              <form className="space-y-6" onSubmit={handleStep1Submit} noValidate>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="email" className="form-label">
                      {t('signup.emailLabel')}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={`input ${touched.email && errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('auth.emailPlaceholder')}
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['email'])}
                      aria-invalid={Boolean(touched.email && errors.email)}
                    />
                    {renderError('email')}
                  </div>

                  <div>
                    <label htmlFor="password" className="form-label">
                      {t('signup.passwordLabel')}
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      className={`input ${touched.password && errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.passwordDescription')}
                      value={formData.password}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['password'])}
                      aria-invalid={Boolean(touched.password && errors.password)}
                    />
                    {renderError('password')}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="form-label">
                      {t('signup.confirmPasswordLabel')}
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      className={`input ${touched.confirmPassword && errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.confirmPasswordLabel')}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['confirmPassword'])}
                      aria-invalid={Boolean(touched.confirmPassword && errors.confirmPassword)}
                    />
                    {renderError('confirmPassword')}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full">
                  {t('signup.continue')}
                </button>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleStep2Submit} noValidate>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="name" className="form-label">
                      {t('signup.businessNameLabel')}
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className={`input ${touched.name && errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.businessNameLabel')}
                      value={formData.name}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['name'])}
                      aria-invalid={Boolean(touched.name && errors.name)}
                    />
                    {renderError('name')}
                  </div>

                  <div>
                    <label htmlFor="legal_name" className="form-label">
                      {t('signup.legalNameLabel')}
                    </label>
                    <input
                      id="legal_name"
                      name="legal_name"
                      type="text"
                      className={`input ${touched.legal_name && errors.legal_name ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.legalNameLabel')}
                      value={formData.legal_name}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['legal_name'])}
                      aria-invalid={Boolean(touched.legal_name && errors.legal_name)}
                    />
                    {renderError('legal_name')}
                  </div>

                  <div>
                    <label htmlFor="address" className="form-label">
                      {t('signup.addressLabel')}
                    </label>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      className={`input ${touched.address && errors.address ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.addressLabel')}
                      value={formData.address}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['address'])}
                      aria-invalid={Boolean(touched.address && errors.address)}
                    />
                    {renderError('address')}
                  </div>

                  <div>
                    <label htmlFor="vat_number" className="form-label flex items-center justify-between">
                      {t('signup.vatLabel')}
                      <span className="text-xs font-normal text-gray-400">{t('common.optional')}</span>
                    </label>
                    <input
                      id="vat_number"
                      name="vat_number"
                      type="text"
                      className={`input ${touched.vat_number && errors.vat_number ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder={t('signup.vatHint')}
                      value={formData.vat_number}
                      onChange={handleInputChange}
                      onBlur={() => markTouched(['vat_number'])}
                      aria-invalid={Boolean(touched.vat_number && errors.vat_number)}
                    />
                    {renderError('vat_number')}
                  </div>

                  <div>
                    <label className="form-label flex items-center justify-between" htmlFor="logo">
                      {t('signup.logoLabel')}
                      <span className="text-xs font-normal text-gray-400">{t('common.optional')}</span>
                    </label>
                    <div className="flex items-start gap-4">
                      <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-primary-300 hover:text-primary-600">
                        <input
                          id="logo"
                          name="logo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                        <span className="text-xs font-medium">{t('profile.logoUpload')}</span>
                      </label>
                      <div className="flex-1 space-y-2 text-xs text-gray-500">
                        <p>{t('signup.logoHint')}</p>
                        {logoPreview && (
                          <div className="relative inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                            <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded object-cover" />
                            <button
                              type="button"
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                              onClick={() => setLogoFile(null)}
                            >
                              {t('profile.logoRemove')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn btn-secondary flex-1"
                  >
                    {t('signup.back')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary flex-1 justify-center"
                  >
                    {loading ? t('signup.creatingAccount') : t('signup.createAccount')}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-gray-600">
              {t('signup.alreadyHaveAccount')}{' '}
              <Link href="/" className="font-medium text-primary-600 hover:text-primary-700">
                {t('signup.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
