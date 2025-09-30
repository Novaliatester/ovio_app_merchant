'use client'

import { useAuth } from '@/components/AuthProvider'
import DashboardLayout from '@/components/DashboardLayout'
import NewOfferForm from '@/components/NewOfferForm'
import { Offer } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslation } from '@/components/LanguageProvider'

interface OfferFormData {
  title: string
  description: string
  discount_type: 'percent' | 'coupon'
  discount_value: number
  min_followers: number
  start_at: string
  end_at: string
  is_active: boolean
}

interface OfferFieldErrors {
  title?: string
  discount_value?: string
  start_at?: string
  end_at?: string
}

export const runtime = 'nodejs'

export default function OffersPage() {
  const { user, merchant, loading } = useAuth()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [offers, setOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [newFormOpen, setNewFormOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)
  const redirectingRef = useRef(false)
  const initialQueryHandled = useRef(false)
  const isSuspended = merchant?.subscription_status === 'suspended'

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
    [locale]
  )

  const formatDiscountValue = useCallback(
    (offer: Offer) => {
      if (offer.discount_type === 'percent') {
        return t('offers.discountPercent', { value: offer.discount_value })
      }
      return t('offers.discountFixed', { amount: currencyFormatter.format(offer.discount_value) })
    },
    [currencyFormatter, t]
  )

  const formatDiscountType = useCallback(
    (offer: Offer) =>
      offer.discount_type === 'percent'
        ? t('offers.discountTypePercent')
        : t('offers.discountTypeCoupon'),
    [t]
  )

  const formatDateRange = useCallback(
    (start?: string | null, end?: string | null) => {
      if (!start && !end) return t('offers.noDates')
      const placeholder = '—'
      const startLabel = start ? new Date(start).toLocaleDateString(locale) : placeholder
      const endLabel = end ? new Date(end).toLocaleDateString(locale) : placeholder
      return `${startLabel} → ${endLabel}`
    },
    [locale, t]
  )

  useEffect(() => {
    if (!loading && (!user || !merchant) && !redirectingRef.current) {
      redirectingRef.current = true
      router.replace('/')
    }
  }, [user, merchant, loading, router])

  const fetchOffers = useCallback(async () => {
    if (!merchant) return
    try {
      setOffersLoading(true)
      console.log('Fetching offers for merchant:', merchant.id)
      
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('deleted', false)
        .order('min_followers', { ascending: false })

      console.log('Fetched offers:', { data, error })

      if (error) throw error
      setOffers(data || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
      toast.error(t('offers.fetchError'))
    } finally {
      setOffersLoading(false)
    }
  }, [merchant, t])

  useEffect(() => {
    if (merchant) {
      fetchOffers()
    }
  }, [merchant, fetchOffers])

  useEffect(() => {
    if (isSuspended && formOpen) {
      setFormOpen(false)
      setEditingOffer(null)
    }
  }, [isSuspended, formOpen])

  const toggleOfferStatus = async (offerId: number, currentStatus: boolean) => {
    if (isSuspended) return
    try {
      setUpdating(offerId)
      const { error } = await supabase
        .from('offers')
        .update({ is_active: !currentStatus })
        .eq('id', offerId)

      if (error) throw error

      setOffers((prev) =>
        prev.map((offer) => (offer.id === offerId ? { ...offer, is_active: !currentStatus } : offer))
      )
      const statusLabel = t(!currentStatus ? 'offers.statusActivated' : 'offers.statusDeactivated')
      toast.success(t('offers.statusUpdated', { status: statusLabel }))
    } catch (error) {
      console.error('Error updating offer:', error)
      toast.error(t('offers.statusError'))
    } finally {
      setUpdating(null)
    }
  }

  const deleteOffer = async (offerId: number) => {
    if (isSuspended) return
    if (!confirm(t('offers.deleteConfirm'))) return

    try {
      console.log('Attempting to soft delete offer:', offerId)
      console.log('Current merchant:', merchant)
      console.log('Current user:', user)
      
      // Test the current_user_id function
      const { data: testUser, error: testError } = await supabase
        .rpc('current_user_id')
      
      console.log('Test current_user_id function:', { testUser, testError })
      
      // First, let's verify the offer exists and belongs to this merchant
      const { data: existingOffer, error: fetchError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .eq('merchant_id', merchant?.id)
        .single()

      console.log('Existing offer check:', { existingOffer, fetchError })

      if (fetchError || !existingOffer) {
        throw new Error('Offer not found or access denied')
      }

      // Now try the update
      const { data, error } = await supabase
        .from('offers')
        .update({ deleted: true })
        .eq('id', offerId)
        .eq('merchant_id', merchant?.id)
        .select()

      console.log('Delete response:', { data, error })

      if (error) {
        console.error('Supabase error details:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('No rows were updated')
      }

      setOffers((prev) => prev.filter((offer) => offer.id !== offerId))
      toast.success(t('offers.deleteSuccess'))
    } catch (error) {
      console.error('Error deleting offer:', error)
      toast.error(error instanceof Error ? error.message : t('offers.deleteError'))
    }
  }

  const openCreateForm = () => {
    if (isSuspended) return
    setEditingOffer(null)
    setFormOpen(true)
  }

  const openNewCreateForm = () => {
    if (isSuspended) return
    setNewFormOpen(true)
  }

  const openEditForm = (offer: Offer) => {
    if (isSuspended) return
    setEditingOffer(offer)
    setFormOpen(true)
  }

  const closeForm = () => {
    setEditingOffer(null)
    setFormOpen(false)
  }

  const closeNewForm = () => {
    setNewFormOpen(false)
  }

  useEffect(() => {
    if (initialQueryHandled.current) return
    initialQueryHandled.current = true

    if (typeof window === 'undefined' || isSuspended) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'create') {
      setEditingOffer(null)
      setNewFormOpen(true)
      router.replace('/dashboard/offers', { scroll: false })
    }
  }, [isSuspended, router])

  const hasOffers = offers.length > 0

  const isReady = !loading && !offersLoading && Boolean(user && merchant)

  if (!isReady) {
    return <OffersPageFallback />
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{t('offers.title')}</h1>
            <p className="text-gray-600">{t('offers.subtitle')}</p>
          </div>
          {!isSuspended && (
            <div className="hidden items-center gap-3 sm:flex">
              <button
                onClick={openNewCreateForm}
                className="btn btn-primary flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('offers.createOffer')}
              </button>
            </div>
          )}
        </header>

        {isSuspended && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {t('offers.suspendedNotice')}
          </div>
        )}

        {hasOffers ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderOffer')}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderType')}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderDiscount')}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderFollowers')}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderStatus')}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('offers.tableHeaderDates')}</th>
                      <th scope="col" className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {offers.map((offer) => (
                      <tr key={offer.id}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{offer.title}</div>
                          {offer.description ? (
                            <div className="text-sm text-gray-500">{offer.description}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {formatDiscountType(offer)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {formatDiscountValue(offer)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {numberFormatter.format(offer.min_followers || 0)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              offer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {offer.is_active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {formatDateRange(offer.start_at, offer.end_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditForm(offer)}
                              className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isSuspended}
                            >
                              {t('offers.edit')}
                            </button>
                            <button
                              onClick={() => toggleOfferStatus(offer.id, offer.is_active)}
                              className={`text-sm font-medium ${
                                offer.is_active ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                              disabled={updating === offer.id || isSuspended}
                            >
                              {updating === offer.id ? t('offers.formSaving') : offer.is_active ? t('offers.deactivate') : t('offers.activate')}
                            </button>
                            <button
                              onClick={() => deleteOffer(offer.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isSuspended}
                            >
                              {t('offers.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-gray-100 md:hidden">
                {offers.map((offer) => (
                  <div key={offer.id} className="space-y-4 px-4 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{offer.title}</p>
                        {offer.description ? (
                          <p className="text-sm text-gray-500">{offer.description}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          offer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {offer.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-gray-500">{t('offers.tableHeaderType')}</dt>
                        <dd className="font-medium text-gray-900">{formatDiscountType(offer)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">{t('offers.tableHeaderDiscount')}</dt>
                        <dd className="font-medium text-gray-900">{formatDiscountValue(offer)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">{t('offers.tableHeaderFollowers')}</dt>
                        <dd className="font-medium text-gray-900">{numberFormatter.format(offer.min_followers || 0)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-gray-500">{t('offers.tableHeaderDates')}</dt>
                        <dd className="font-medium text-gray-900">{formatDateRange(offer.start_at, offer.end_at)}</dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => openEditForm(offer)}
                        className="btn btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSuspended}
                      >
                        {t('offers.edit')}
                      </button>
                      <button
                        onClick={() => toggleOfferStatus(offer.id, offer.is_active)}
                        className={`btn flex-1 ${
                          offer.is_active ? 'btn-secondary bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'btn-primary'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        disabled={updating === offer.id || isSuspended}
                      >
                        {updating === offer.id ? t('offers.formSaving') : offer.is_active ? t('offers.deactivate') : t('offers.activate')}
                      </button>
                    </div>

                    <button
                      onClick={() => deleteOffer(offer.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSuspended}
                    >
                      {t('offers.delete')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState onCreate={openNewCreateForm} disabled={isSuspended} />
        )}
      </div>

      {formOpen && (
        <OfferForm
          offer={editingOffer}
          onClose={closeForm}
          onSuccess={() => {
            closeForm()
            fetchOffers()
          }}
        />
      )}

      {newFormOpen && (
        <NewOfferForm
          onClose={closeNewForm}
          onSuccess={() => {
            closeNewForm()
            fetchOffers()
          }}
        />
      )}
      {!isSuspended && !formOpen && !newFormOpen && (
        <button
          onClick={openNewCreateForm}
          className="fixed bottom-4 left-4 right-4 z-40 rounded-full bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:hidden"
        >
          {t('offers.createOffer')}
        </button>
      )}
    </DashboardLayout>
  )
}

function OffersPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary-600"></div>
    </div>
  )
}

interface OfferFormProps {
  offer: Offer | null
  onClose: () => void
  onSuccess: () => void
}

function OfferForm({ offer, onClose, onSuccess }: OfferFormProps) {
  const { merchant } = useAuth()
  const { t, locale } = useTranslation()
  const initialData: OfferFormData = useMemo(() => {
    const discountType = offer?.discount_type || 'percent'
    const fallbackValue = discountType === 'percent' ? 10 : 5
    return {
      title: offer?.title || '',
      description: offer?.description || '',
      discount_type: discountType,
      discount_value: offer?.discount_value ?? fallbackValue,
      min_followers: offer?.min_followers || 0,
      start_at: offer?.start_at ? offer.start_at.split('T')[0] : '',
      end_at: offer?.end_at ? offer.end_at.split('T')[0] : '',
      is_active: offer?.is_active ?? true
    }
  }, [offer])
  const [formData, setFormData] = useState<OfferFormData>(initialData)
  const [errors, setErrors] = useState<OfferFieldErrors>({})
  const [loading, setLoading] = useState(false)
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
    [locale]
  )

  const computeErrors = useCallback((data: OfferFormData): OfferFieldErrors => {
    const nextErrors: OfferFieldErrors = {}

    if (!data.title.trim()) {
      nextErrors.title = t('offers.validationTitle')
    }

    if (data.discount_type === 'percent') {
      if (data.discount_value < 5 || data.discount_value > 100 || data.discount_value % 5 !== 0) {
        nextErrors.discount_value = t('offers.validationPercentage')
      }
    } else if (data.discount_value < 1) {
      nextErrors.discount_value = t('offers.validationFixed')
    }

    if (data.start_at && data.end_at && data.start_at > data.end_at) {
      nextErrors.end_at = t('offers.validationDates')
    }

    return nextErrors
  }, [t])

  useEffect(() => {
    setFormData(initialData)
    setErrors(offer ? computeErrors(initialData) : {})
  }, [initialData, computeErrors, offer])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!merchant) return

    const nextErrors = computeErrors(formData)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      toast.error(t('auth.fixErrors'))
      return
    }

    setLoading(true)

    try {
      const payload = {
        merchant_id: merchant.id,
        title: formData.title.trim(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        min_followers: formData.min_followers,
        start_at: formData.start_at || null,
        end_at: formData.end_at || null,
        is_active: formData.is_active
      }

      if (offer) {
        const { error } = await supabase
          .from('offers')
          .update(payload)
          .eq('id', offer.id)

        if (error) throw error
        toast.success(t('offers.formUpdated'))
      } else {
        const { error } = await supabase
          .from('offers')
          .insert(payload)

        if (error) throw error
        toast.success(t('offers.formCreated'))
      }

      onSuccess()
    } catch (error: any) {
      console.error('Error saving offer:', error)
      toast.error(error?.message || t('offers.saveError'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = <K extends keyof OfferFormData>(field: K, value: OfferFormData[K]) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value
      }
      setErrors(computeErrors(next))
      return next
    })
  }

  const previewValue = useMemo(() => {
    if (formData.discount_type === 'percent') {
      return t('offers.discountPercent', { value: formData.discount_value })
    }
    return t('offers.discountFixed', { amount: currencyFormatter.format(formData.discount_value || 0) })
  }, [currencyFormatter, formData.discount_type, formData.discount_value, t])

  const previewBusiness = useMemo(
    () => merchant?.name || t('offers.previewBusinessFallback'),
    [merchant?.name, t]
  )
  const previewText = useMemo(
    () => t('offers.previewDescription', { value: previewValue, business: previewBusiness }),
    [previewBusiness, previewValue, t]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 hover:text-gray-700"
        >
          <span className="sr-only">{t('common.close')}</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            {offer ? t('offers.formEditTitle') : t('offers.formCreateTitle')}
          </h2>
          <p className="text-sm text-gray-500">{t('offers.formDescription')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label" htmlFor="title">{t('offers.formOfferTitle')}</label>
              <input
                id="title"
                type="text"
                className={`input ${errors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
                value={formData.title}
                onChange={(event) => handleChange('title', event.target.value)}
                placeholder={t('offers.formOfferPlaceholder')}
              />
              {errors.title ? <p className="form-error mt-1">{errors.title}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label className="form-label" htmlFor="description">{t('offers.formDescriptionLabel')}</label>
              <textarea
                id="description"
                rows={3}
                className="input"
                value={formData.description}
                onChange={(event) => handleChange('description', event.target.value)}
                placeholder={t('offers.formDescriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="discount_type">{t('offers.formDiscountType')}</label>
              <select
                id="discount_type"
                className="input"
                value={formData.discount_type}
                onChange={(event) => handleChange('discount_type', event.target.value as OfferFormData['discount_type'])}
              >
                <option value="percent">{t('offers.discountTypePercent')}</option>
                <option value="coupon">{t('offers.discountTypeCoupon')}</option>
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="discount_value">{t('offers.formDiscountValue')}</label>
              <input
                id="discount_value"
                type="number"
                min={formData.discount_type === 'percent' ? 5 : 1}
                max={formData.discount_type === 'percent' ? 100 : undefined}
                step={formData.discount_type === 'percent' ? 5 : 1}
                className={`input ${errors.discount_value ? 'border-red-500 focus:ring-red-500' : ''}`}
                value={formData.discount_value}
                onChange={(event) => handleChange('discount_value', Number(event.target.value) || 0)}
              />
              {errors.discount_value ? (
                <p className="form-error mt-1">{errors.discount_value}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {formData.discount_type === 'percent'
                    ? t('offers.validationPercentage')
                    : t('offers.validationFixed')}
                </p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="min_followers">{t('offers.formMinFollowers')}</label>
              <input
                id="min_followers"
                type="number"
                min={0}
                className="input"
                value={formData.min_followers}
                onChange={(event) => handleChange('min_followers', Number(event.target.value) || 0)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="start_at">{t('offers.formStartDate')}</label>
              <input
                id="start_at"
                type="date"
                className="input"
                value={formData.start_at}
                onChange={(event) => handleChange('start_at', event.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="end_at">{t('offers.formEndDate')}</label>
              <input
                id="end_at"
                type="date"
                className={`input ${errors.end_at ? 'border-red-500 focus:ring-red-500' : ''}`}
                value={formData.end_at}
                onChange={(event) => handleChange('end_at', event.target.value)}
              />
              {errors.end_at ? <p className="form-error mt-1">{errors.end_at}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <span className="form-label">{t('offers.formStatus')}</span>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formData.is_active ? t('common.active') : t('common.inactive')}</p>
                  <p className="text-xs text-gray-500">{formData.is_active ? t('offers.formStatusActive') : t('offers.formStatusInactive')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('is_active', !formData.is_active)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
                    formData.is_active ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      formData.is_active ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('offers.formSaving') : offer ? t('offers.formSave') : t('offers.formCreate')}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('offers.previewHeading')}</h3>
          <p className="mt-1 text-sm text-gray-600">{previewText}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onCreate, disabled = false }: { onCreate: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <div className="rounded-full bg-primary-50 p-4 text-primary-600">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </div>
      <h2 className="mt-6 text-xl font-semibold text-gray-900">{t('offers.emptyTitle')}</h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        {t('offers.emptyDescription')}
      </p>
      {!disabled ? (
        <button onClick={onCreate} className="btn btn-primary mt-6">
          {t('offers.emptyCta')}
        </button>
      ) : (
        <p className="mt-4 max-w-md text-sm text-yellow-700">{t('offers.suspendedNotice')}</p>
      )}
    </div>
  )
}
