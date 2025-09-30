'use client'

import { useAuth } from '@/components/AuthProvider'
import DashboardLayout from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/components/LanguageProvider'
import { getMerchantLogoUrl, uploadMerchantLogo } from '@/lib/storage'

interface ProfileFormData {
  name: string
  legal_name: string
  vat_number: string
  street_line1: string
  street_line2: string
  city: string
  postal_code: string
  country: string
  contact_email: string
  instagram_handle: string
  logo_url: string
}

export const runtime = 'nodejs'

export default function ProfilePage() {
  const { user, merchant, loading, refreshMerchant } = useAuth()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    legal_name: '',
    vat_number: '',
    street_line1: '',
    street_line2: '',
    city: '',
    postal_code: '',
    country: '',
    contact_email: '',
    instagram_handle: '',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (!loading && (!user || !merchant)) {
      router.push('/')
    }
  }, [user, merchant, loading, router])

  const parseStreetLines = (street: string | null | undefined) => {
    if (!street) {
      return {
        street_line1: '',
        street_line2: '',
      }
    }

    const lines = street
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const [street_line1 = '', street_line2 = ''] = lines

    return {
      street_line1,
      street_line2,
    }
  }

  const mergeStreetLines = (fields: Pick<ProfileFormData, 'street_line1' | 'street_line2'>) => {
    const lines = [fields.street_line1, fields.street_line2]
      .map((line) => line.trim())
      .filter(Boolean)

    return lines.length > 0 ? lines.join('\n') : null
  }

  useEffect(() => {
    if (merchant && !loading) {
      const { street_line1, street_line2 } = parseStreetLines('street' in merchant ? (merchant.street as string) : null)
      setFormData({
        name: merchant.name || '',
        legal_name: merchant.legal_name || '',
        vat_number: merchant.vat_number || '',
        street_line1,
        street_line2,
        city: 'city' in merchant && merchant.city ? (merchant.city as string) : '',
        postal_code: 'postal_code' in merchant && merchant.postal_code ? (merchant.postal_code as string) : '',
        country: 'country' in merchant && merchant.country ? (merchant.country as string) : '',
        contact_email:
          'contact_email' in merchant && merchant.contact_email
            ? (merchant.contact_email as string)
            : user?.email || '',
        instagram_handle: 'instagram_handle' in merchant && merchant.instagram_handle ? (merchant.instagram_handle as string) : '',
        logo_url: merchant.logo_url ? (merchant.logo_url as string) : '',
      })
      const initialPreview = merchant.logo_signed_url
        || (merchant.logo_url?.startsWith('http') ? merchant.logo_url : null)
      setLogoPreview(initialPreview)
    }
  }, [merchant, user, loading])

  useEffect(() => {
    if (!logoFile) return
    const preview = URL.createObjectURL(logoFile)
    setLogoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [logoFile])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
      toast(t('profile.logoToast'))
    }
  }

  const supportsStreet = useMemo(
    () => merchant ? Object.prototype.hasOwnProperty.call(merchant, 'street') : false,
    [merchant]
  )

  const supportsCity = useMemo(
    () => merchant ? Object.prototype.hasOwnProperty.call(merchant, 'city') : false,
    [merchant]
  )

  const supportsPostalCode = useMemo(
    () => merchant ? Object.prototype.hasOwnProperty.call(merchant, 'postal_code') : false,
    [merchant]
  )

  const supportsCountry = useMemo(
    () => merchant ? Object.prototype.hasOwnProperty.call(merchant, 'country') : false,
    [merchant]
  )

  const supportsContactEmail = useMemo(
    () => merchant ? Object.prototype.hasOwnProperty.call(merchant, 'contact_email') : false,
    [merchant]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!merchant) return

    setSaving(true)

    try {
      let logoUrl: string | null = formData.logo_url ? formData.logo_url : null
      let signedUrl: string | null = null

      if (logoFile) {
        const { path, signedUrl: uploadedSigned } = await uploadMerchantLogo(logoFile, merchant.id)
        logoUrl = path
        signedUrl = uploadedSigned
      }

      const updatePayload: Record<string, any> = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        vat_number: formData.vat_number || null,
        logo_url: logoUrl
      }

      if (supportsStreet) {
        updatePayload.street = mergeStreetLines({
          street_line1: formData.street_line1,
          street_line2: formData.street_line2,
        })
      }

      if (supportsCity) {
        updatePayload.city = formData.city.trim() || null
      }

      if (supportsPostalCode) {
        updatePayload.postal_code = formData.postal_code.trim() || null
      }

      if (supportsCountry) {
        updatePayload.country = formData.country.trim() || null
      }

      if (supportsContactEmail) {
        updatePayload.contact_email = formData.contact_email || null
      }

      // Instagram handle is always supported as it's in the schema
      updatePayload.instagram_handle = formData.instagram_handle.trim() || null

      const { error } = await supabase
        .from('merchants')
        .update(updatePayload)
        .eq('id', merchant.id)

      if (error) throw error

      await refreshMerchant()
      await refreshMerchant()
      if (logoUrl !== undefined) {
        setFormData((prev) => ({ ...prev, logo_url: logoUrl || '' }))
        if (signedUrl) {
          setLogoPreview(signedUrl)
        } else if (logoUrl && logoUrl.startsWith('http')) {
          setLogoPreview(logoUrl)
        } else {
          const fallbackSigned = logoUrl ? await getMerchantLogoUrl(logoUrl).catch(() => null) : null
          setLogoPreview(fallbackSigned)
        }
      }
      setLogoFile(null)
      toast.success(t('profile.saveSuccess'))
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error?.message || t('profile.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivateAccount = async () => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ is_visible: false })
        .eq('id', merchant!.id)

      if (error) throw error

      await refreshMerchant()
      toast.success(t('profile.deactivateSuccess'))
      setShowDeactivateModal(false)
    } catch (error: any) {
      console.error('Error deactivating account:', error)
      toast.error(error?.message || t('profile.deactivateError'))
    }
  }

  const handleReactivateAccount = async () => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ is_visible: true })
        .eq('id', merchant!.id)

      if (error) throw error

      await refreshMerchant()
      toast.success(t('profile.reactivateSuccess'))
    } catch (error: any) {
      console.error('Error reactivating account:', error)
      toast.error(error?.message || t('profile.reactivateError'))
    }
  }

  useEffect(() => {
    if (!loading && (!user || !merchant) && !redirectingRef.current) {
      redirectingRef.current = true
      router.replace('/')
    }
  }, [user, merchant, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user || !merchant) {
    return null
  }

  const createdLabel = t('profile.createdOn', {
    date: new Date(merchant.created_at).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  })

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-gray-900">{t('profile.title')}</h1>
          <p className="mt-2 text-gray-600">{t('profile.subtitle')}</p>
        </header>

        {/* Business Identity Section */}
        <section className="card">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('profile.identitySectionTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('profile.identitySectionDescription')}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="form-label">{t('profile.businessName')}</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="input"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label htmlFor="legal_name" className="form-label">{t('profile.legalEntityName')}</label>
                  <input
                    id="legal_name"
                    name="legal_name"
                    type="text"
                    className="input"
                    value={formData.legal_name}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label htmlFor="vat_number" className="form-label">{t('profile.vatNumber')}</label>
                  <input
                    id="vat_number"
                    name="vat_number"
                    type="text"
                    className="input"
                    value={formData.vat_number}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Business Address Section */}
        <section className="card">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('profile.addressSectionTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('profile.addressSectionDescription')}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="street_line1" className="form-label">{t('profile.streetLine1')}</label>
                <input
                  id="street_line1"
                  name="street_line1"
                  type="text"
                  className="input"
                  value={formData.street_line1}
                  onChange={handleInputChange}
                  placeholder={t('profile.streetLine1Placeholder')}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="street_line2" className="form-label">{t('profile.streetLine2')}</label>
                <input
                  id="street_line2"
                  name="street_line2"
                  type="text"
                  className="input"
                  value={formData.street_line2}
                  onChange={handleInputChange}
                  placeholder={t('profile.streetLine2Placeholder')}
                />
              </div>
              <div>
                <label htmlFor="city" className="form-label">{t('profile.city')}</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="input"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label htmlFor="postal_code" className="form-label">{t('profile.postalCode')}</label>
                <input
                  id="postal_code"
                  name="postal_code"
                  type="text"
                  className="input"
                  value={formData.postal_code}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label htmlFor="country" className="form-label">{t('profile.country')}</label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  className="input"
                  value={formData.country}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Contact & Social Section */}
        <section className="card">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('profile.contactSectionTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('profile.contactSectionDescription')}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="contact_email" className="form-label">{t('profile.contactEmail')}</label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  className="input"
                  value={formData.contact_email}
                  onChange={handleInputChange}
                  placeholder={t('profile.contactEmailPlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="instagram_handle" className="form-label">{t('profile.instagramHandle')}</label>
                <input
                  id="instagram_handle"
                  name="instagram_handle"
                  type="text"
                  className="input"
                  value={formData.instagram_handle}
                  onChange={handleInputChange}
                  placeholder={t('profile.instagramHandlePlaceholder')}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Branding Section */}
        <section className="card">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('profile.brandingSectionTitle')}</h2>
              <p className="mt-1 text-sm text-gray-500">{t('profile.brandingSectionDescription')}</p>
            </div>
            <div className="flex flex-col items-start gap-4">
              <label className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 transition hover:border-primary-300 hover:text-primary-600">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                {t('profile.logoUpload')}
              </label>
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-32 w-32 rounded-xl border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null)
                      setLogoPreview(null)
                      setFormData((prev) => ({ ...prev, logo_url: '' }))
                    }}
                    className="absolute right-2 top-2 rounded-full bg-white/70 p-1 text-gray-500 shadow hover:text-gray-700"
                  >
                    <span className="sr-only">{t('profile.logoRemove')}</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('profile.logoEmpty')}</p>
              )}
            </div>
            <p className="text-xs text-gray-500">{t('profile.logoHint')}</p>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.accountStatus')}</h2>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {merchant.is_visible ? t('profile.accountActive') : t('profile.accountHidden')}
                </p>
                <p className="text-xs text-gray-500">{createdLabel}</p>
              </div>
              <span
                className={`inline-flex h-3 w-3 rounded-full ${merchant.is_visible ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </div>
          </div>

          <div className={`card ${merchant.is_visible ? 'border-red-200 bg-red-50/70' : 'border-green-200 bg-green-50/70'}`}>
            <h2 className={`text-lg font-semibold ${merchant.is_visible ? 'text-red-900' : 'text-green-900'}`}>
              {merchant.is_visible ? t('profile.deactivateCardTitle') : t('profile.reactivateTitle')}
            </h2>
            <p className={`mt-2 text-sm ${merchant.is_visible ? 'text-red-700' : 'text-green-700'}`}>
              {merchant.is_visible ? t('profile.deactivateCardDescription') : t('profile.reactivateDescription')}
            </p>
            {merchant.is_visible ? (
              <button
                onClick={() => setShowDeactivateModal(true)}
                className="btn btn-danger mt-4 w-fit"
              >
                {t('profile.deactivateCta')}
              </button>
            ) : (
              <button
                onClick={handleReactivateAccount}
                className="btn btn-primary mt-4 w-fit"
              >
                {t('profile.reactivateCta')}
              </button>
            )}
          </div>
        </section>

        {showDeactivateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">{t('profile.deactivateModalTitle')}</h3>
              <p className="mt-2 text-sm text-gray-600">{t('profile.deactivateModalDescription')}</p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowDeactivateModal(false)} className="btn btn-secondary">
                  {t('profile.deactivateCancel')}
                </button>
                <button onClick={handleDeactivateAccount} className="btn btn-danger">
                  {t('profile.deactivateConfirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
