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


export const runtime = 'nodejs'

export default function OffersPage() {
  const { user, merchant, loading } = useAuth()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [offers, setOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
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
    if (isSuspended && newFormOpen) {
      setNewFormOpen(false)
      setEditingOffer(null)
    }
  }, [isSuspended, newFormOpen])

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


  const openNewCreateForm = () => {
    if (isSuspended) return
    setEditingOffer(null)
    setNewFormOpen(true)
  }

  const openEditForm = (offer: Offer) => {
    if (isSuspended) return
    setEditingOffer(offer)
    setNewFormOpen(true)
  }

  const closeNewForm = () => {
    setEditingOffer(null)
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

      {newFormOpen && (
        <NewOfferForm
          offer={editingOffer}
          onClose={closeNewForm}
          onSuccess={() => {
            closeNewForm()
            fetchOffers()
          }}
        />
      )}
      {!isSuspended && !newFormOpen && (
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
