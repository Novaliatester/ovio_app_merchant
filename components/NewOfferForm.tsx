'use client'

import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/LanguageProvider'
import { useState, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'

interface NewOfferFormData {
  discount_type: 'percent' | 'coupon'
  discount_value: number
  min_followers: number
  start_at: string
  end_at: string
}

interface FollowerTier {
  label: string
  value: number
}

interface ScalingOffer {
  min_followers: number
  discount_value: number
  title: string
  selected: boolean
}

interface NewOfferFormProps {
  onClose: () => void
  onSuccess: () => void
}

const FOLLOWER_TIERS: FollowerTier[] = [
  { label: '500+', value: 500 },
  { label: '1,000+', value: 1000 },
  { label: '2,000+', value: 2000 },
  { label: '5,000+', value: 5000 },
  { label: '10,000+', value: 10000 },
  { label: '20,000+', value: 20000 },
  { label: '50,000+', value: 50000 },
  { label: '100,000+', value: 100000 },
]

const SCALING_RULES = {
  percent: {
    stepIncrease: 10, // +10% per tier
  },
  coupon: {
    stepIncrease: 5,  // +5€ per tier
    maxDiscount: 150, // Max 150€ discount (shows as "free")
  }
}

export default function NewOfferForm({ onClose, onSuccess }: NewOfferFormProps) {
  const { merchant } = useAuth()
  const { t, locale } = useTranslation()
  const [formData, setFormData] = useState<NewOfferFormData>({
    discount_type: 'percent',
    discount_value: 10,
    min_followers: 1000,
    start_at: new Date().toISOString().split('T')[0],
    end_at: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof NewOfferFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [showScalingModal, setShowScalingModal] = useState(false)
  const [scalingOffers, setScalingOffers] = useState<ScalingOffer[]>([])

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
    [locale]
  )

  const generateTitle = useCallback((discountType: string, discountValue: number, businessName: string) => {
    if (discountType === 'percent') {
      return `-${discountValue}% at ${businessName}`
    } else {
      if (discountValue >= 150) {
        return `Free at ${businessName}`
      } else {
        return `-${currencyFormatter.format(discountValue)} at ${businessName}`
      }
    }
  }, [currencyFormatter])

  const generateDescription = useCallback((discountType: string, discountValue: number) => {
    if (discountType === 'percent') {
      return `Show your QR and get -${discountValue}%`
    } else {
      if (discountValue >= 150) {
        return `Show your QR and get it free`
      } else {
        return `Show your QR and get -${currencyFormatter.format(discountValue)}`
      }
    }
  }, [currencyFormatter])

  const validateForm = useCallback((data: NewOfferFormData): Partial<Record<keyof NewOfferFormData, string>> => {
    const newErrors: Partial<Record<keyof NewOfferFormData, string>> = {}

    if (data.discount_type === 'percent') {
      if (data.discount_value < 5 || data.discount_value > 100 || data.discount_value % 5 !== 0) {
        newErrors.discount_value = t('offers.newFormValidationDiscount')
      }
    } else if (data.discount_value < 1) {
      newErrors.discount_value = t('offers.newFormValidationFixed')
    }

    if (!data.start_at) {
      newErrors.start_at = t('offers.newFormValidationStartDate')
    }

    if (data.start_at && data.end_at && data.start_at > data.end_at) {
      newErrors.end_at = t('offers.newFormValidationEndDate')
    }

    return newErrors
  }, [t])

  const generateScalingOffers = useCallback((baseOffer: NewOfferFormData): ScalingOffer[] => {
    if (!merchant) return []

    const currentTierIndex = FOLLOWER_TIERS.findIndex(tier => tier.value === baseOffer.min_followers)
    if (currentTierIndex === -1 || currentTierIndex === FOLLOWER_TIERS.length - 1) {
      return [] // No higher tiers available
    }

    const scalingRule = SCALING_RULES[baseOffer.discount_type]
    const offers: ScalingOffer[] = []

    for (let i = currentTierIndex + 1; i < FOLLOWER_TIERS.length; i++) {
      const tier = FOLLOWER_TIERS[i]
      const tierSteps = i - currentTierIndex
      
      let newDiscountValue
      if (baseOffer.discount_type === 'coupon') {
        // For fixed amounts, use the base offer amount as the increment
        newDiscountValue = baseOffer.discount_value + (tierSteps * baseOffer.discount_value)
      } else {
        // For percentages, use the fixed step increase
        newDiscountValue = baseOffer.discount_value + (tierSteps * scalingRule.stepIncrease)
      }
      
      // Cap at maximum discount for fixed amounts
      if (baseOffer.discount_type === 'coupon' && 'maxDiscount' in scalingRule && newDiscountValue > scalingRule.maxDiscount) {
        newDiscountValue = scalingRule.maxDiscount
      }

      const title = generateTitle(baseOffer.discount_type, newDiscountValue, merchant.name)
      
      offers.push({
        min_followers: tier.value,
        discount_value: newDiscountValue,
        title,
        selected: true
      })
    }

    return offers
  }, [merchant, generateTitle])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!merchant) return

    const validationErrors = validateForm(formData)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      toast.error(t('offers.newFormValidationError'))
      return
    }

    // Generate scaling offers
    const offers = generateScalingOffers(formData)
    
    if (offers.length > 0) {
      setScalingOffers(offers)
      setShowScalingModal(true)
    } else {
      await createOffers([formData])
    }
  }

  const createOffers = async (offersToCreate: (NewOfferFormData | ScalingOffer)[]) => {
    if (!merchant) return

    setLoading(true)
    try {
      const offersData = offersToCreate.map(offer => ({
        merchant_id: merchant.id,
        title: 'title' in offer ? offer.title : generateTitle(formData.discount_type, offer.discount_value, merchant.name),
        description: generateDescription(formData.discount_type, offer.discount_value),
        discount_type: formData.discount_type,
        discount_value: offer.discount_value,
        min_followers: offer.min_followers,
        start_at: formData.start_at || null,
        end_at: formData.end_at || null,
        is_active: true
      }))

      const { error } = await supabase
        .from('offers')
        .insert(offersData)

      if (error) throw error

      const count = offersToCreate.length
      const plural = count > 1 ? 's' : ''
      toast.success(t('offers.newFormSuccess', { count, plural }))
      onSuccess()
    } catch (error: any) {
      console.error('Error creating offers:', error)
      toast.error(error?.message || t('offers.newFormError'))
    } finally {
      setLoading(false)
    }
  }

  const handleScalingConfirm = async () => {
    const selectedOffers = scalingOffers.filter(offer => offer.selected)
    await createOffers([formData, ...selectedOffers])
    setShowScalingModal(false)
  }

  const handleScalingCancel = async () => {
    await createOffers([formData])
    setShowScalingModal(false)
  }

  const handleChange = <K extends keyof NewOfferFormData>(field: K, value: NewOfferFormData[K]) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      setErrors(validateForm(next))
      return next
    })
  }

  const toggleScalingOffer = (index: number) => {
    setScalingOffers(prev => 
      prev.map((offer, i) => 
        i === index ? { ...offer, selected: !offer.selected } : offer
      )
    )
  }

  const previewTitle = useMemo(() => {
    if (!merchant) return ''
    return generateTitle(formData.discount_type, formData.discount_value, merchant.name)
  }, [formData.discount_type, formData.discount_value, merchant, generateTitle])

  const previewDescription = useMemo(() => {
    return generateDescription(formData.discount_type, formData.discount_value)
  }, [formData.discount_type, formData.discount_value, generateDescription])

  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6 ${showScalingModal ? 'hidden' : ''}`}>
        <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">{t('offers.newFormClose')}</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">{t('offers.newFormTitle')}</h2>
            <p className="text-sm text-gray-500">{t('offers.newFormDescription')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="discount_type">{t('offers.newFormDiscountType')}</label>
                <select
                  id="discount_type"
                  className="input"
                  value={formData.discount_type}
                  onChange={(event) => handleChange('discount_type', event.target.value as 'percent' | 'coupon')}
                >
                  <option value="percent">{t('offers.discountTypePercent')}</option>
                  <option value="coupon">{t('offers.discountTypeCoupon')}</option>
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="discount_value">
                  {t('offers.newFormDiscountValue')}
                  {formData.discount_type === 'percent' ? ' (%)' : ' (€)'}
                </label>
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
                      ? t('offers.newFormValidationDiscount')
                      : t('offers.newFormValidationFixed')}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="min_followers">{t('offers.newFormMinFollowers')}</label>
                <select
                  id="min_followers"
                  className="input"
                  value={formData.min_followers}
                  onChange={(event) => handleChange('min_followers', Number(event.target.value))}
                >
                  {FOLLOWER_TIERS.map(tier => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label} {t('offers.newFormFollowers')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="start_at">{t('offers.newFormStartDate')} *</label>
                <input
                  id="start_at"
                  type="date"
                  className={`input ${errors.start_at ? 'border-red-500 focus:ring-red-500' : ''}`}
                  value={formData.start_at}
                  onChange={(event) => handleChange('start_at', event.target.value)}
                />
                {errors.start_at && <p className="form-error mt-1">{errors.start_at}</p>}
              </div>

              <div>
                <label className="form-label" htmlFor="end_at">{t('offers.newFormEndDate')}</label>
                <input
                  id="end_at"
                  type="date"
                  className={`input ${errors.end_at ? 'border-red-500 focus:ring-red-500' : ''}`}
                  value={formData.end_at}
                  onChange={(event) => handleChange('end_at', event.target.value)}
                />
                {errors.end_at && <p className="form-error mt-1">{errors.end_at}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                {t('offers.newFormCancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t('offers.newFormCreating') : t('offers.newFormCreate')}
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('offers.newFormPreview')}</h3>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">{previewTitle}</p>
              <p className="text-sm text-gray-600">{previewDescription}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scaling Modal */}
      {showScalingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 px-4 py-6">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">{t('offers.newFormScalingTitle')}</h3>
              <p className="text-sm text-gray-500">
                {t('offers.newFormScalingDescription')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-medium text-gray-900">{t('offers.newFormScalingBaseOffer')}</h4>
                  <p className="text-sm text-gray-600">{previewTitle}</p>
                  <p className="text-xs text-gray-500">{FOLLOWER_TIERS.find(t => t.value === formData.min_followers)?.label} {t('offers.newFormFollowers')}</p>
                </div>

                {scalingOffers.map((offer, index) => (
                  <div key={index} className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    offer.selected 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`} onClick={() => toggleScalingOffer(index)}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={offer.selected}
                        onChange={() => toggleScalingOffer(index)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{t('offers.newFormScalingAutoGenerated')}</h4>
                        <p className="text-sm text-gray-600">{offer.title}</p>
                        <p className="text-xs text-gray-500">{FOLLOWER_TIERS.find(t => t.value === offer.min_followers)?.label} {t('offers.newFormFollowers')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleScalingCancel}
                className="btn btn-secondary"
                disabled={loading}
              >
{t('offers.newFormScalingCancel')}
              </button>
              <button
                onClick={handleScalingConfirm}
                className="btn btn-primary"
                disabled={loading}
              >
{loading ? t('offers.newFormCreating') : t('offers.newFormScalingConfirm', { count: scalingOffers.filter(o => o.selected).length + 1 })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
