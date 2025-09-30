'use client'

import { useAuth } from '@/components/AuthProvider'
import DashboardLayout from '@/components/DashboardLayout'
import { useTranslation } from '@/components/LanguageProvider'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { callWebhook } from '@/lib/webhook-config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'

interface DailyChargePoint {
  date: string
  redemptions: number
  charges: number
}

interface BillingMetrics {
  monthlyRedemptions: number
  monthlyCharges: number
  dailySeries: DailyChargePoint[]
}

const CHARGE_PER_REDEMPTION = 1
const TOP_UP_AMOUNTS = [50, 100, 200] as const

type BillingActionType = 'manage subscription' | 'reactivate subscription' | 'new subscription' | 'top-up'

export const runtime = 'nodejs'

export default function BillingPage() {
  const { user, merchant, loading } = useAuth()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [metrics, setMetrics] = useState<BillingMetrics>({
    monthlyRedemptions: 0,
    monthlyCharges: 0,
    dailySeries: [],
  })
  const [billingLoading, setBillingLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<BillingActionType | null>(null)
  const [topUpAmount, setTopUpAmount] = useState<number>(TOP_UP_AMOUNTS[0])
  const redirectingRef = useRef(false)

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
    [locale]
  )

  useEffect(() => {
    if (!loading && (!user || !merchant) && !redirectingRef.current) {
      redirectingRef.current = true
      router.replace('/login')
    }
  }, [user, merchant, loading, router])

  const fetchBillingMetrics = useCallback(async () => {
    if (!merchant) return

    setBillingLoading(true)

    try {
      let monthlyRedemptions = 0
      const dailyCounts = new Map<string, number>()

      const { data: offers, error: offersError } = await supabase
        .from('offers')
        .select('id')
        .eq('merchant_id', merchant.id)

      if (offersError) {
        throw offersError
      }

      if (offers && offers.length > 0) {
        const offerIds = offers.map((offer: any) => offer.id)
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

        const {
          data: redemptionsData,
          count: redemptionsCount,
          error: redemptionsError,
        } = await supabase
          .from('redemptions')
          .select('id, redeemed_at', { count: 'exact' })
          .in('claim_id', offerIds)
          .gte('redeemed_at', startOfMonth)

        if (redemptionsError) {
          throw redemptionsError
        }

        monthlyRedemptions = redemptionsCount || 0

        if (redemptionsData) {
          for (const redemption of redemptionsData) {
            const redeemedAt = redemption.redeemed_at
            if (!redeemedAt) continue
            const dayKey = getDateKey(new Date(redeemedAt))
            dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1)
          }
        }
      }

      const now = new Date()
      const daysElapsed = now.getDate()
      const dailySeries: DailyChargePoint[] = Array.from({ length: daysElapsed }, (_, index) => {
        const currentDay = new Date(now.getFullYear(), now.getMonth(), index + 1)
        const key = getDateKey(currentDay)
        const dayRedemptions = dailyCounts.get(key) || 0
        return {
          date: key,
          redemptions: dayRedemptions,
          charges: dayRedemptions * CHARGE_PER_REDEMPTION,
        }
      })

      setMetrics({
        monthlyRedemptions,
        monthlyCharges: monthlyRedemptions * CHARGE_PER_REDEMPTION,
        dailySeries,
      })
    } catch (error) {
      console.error('Error fetching billing data:', error)
      toast.error(t('billing.fetchError'))
    } finally {
      setBillingLoading(false)
    }
  }, [merchant, t])

  useEffect(() => {
    if (merchant) {
      fetchBillingMetrics()
    }
  }, [merchant, fetchBillingMetrics])

  const triggerBillingAction = useCallback(
    async (action: BillingActionType, quantity?: number) => {
      if (!merchant) return

      // Use centralized webhook configuration

      if (!merchant.owner_user_id) {
        toast.error(t('billing.actionError'))
        return
      }

      if (action === 'top-up' && (!quantity || quantity <= 0)) {
        toast.error(t('billing.topUpMinimumError'))
        return
      }

      try {
        setPendingAction(action)

        const payload: Record<string, unknown> = {
          type: action,
          user_id: merchant.owner_user_id,
        }

        if (action === 'top-up') {
          payload.quantity = quantity
        }

        const webhookResult = await callWebhook('BILLING_WEBHOOK', payload)

        if (!webhookResult.success) {
          throw new Error(webhookResult.error || 'Webhook call failed')
        }

        const result = webhookResult.data

        if (result?.url) {
          toast.success(t('billing.actionRedirecting'))
          const opened = window.open(result.url as string, '_blank', 'noopener,noreferrer')

          if (!opened) {
            toast.error(t('billing.popupBlockedError'))
          }
          return
        }

        console.warn('Webhook response missing URL', result)
        toast.error(t('billing.actionMissingUrl'))
      } catch (error) {
        console.error('Error triggering billing action:', error)
        toast.error(t('billing.actionError'))
      } finally {
        setPendingAction(null)
      }
    },
    [merchant, t]
  )

  const handleTopUp = useCallback(() => {
    triggerBillingAction('top-up', topUpAmount)
  }, [topUpAmount, triggerBillingAction])

  if (loading || billingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !merchant) {
    return null
  }

  const subscriptionStatus = merchant.subscription_status ?? null
  const subscriptionValidUntil = merchant.subscription_valid_until
    ? new Date(merchant.subscription_valid_until)
    : null
  const isActive = subscriptionStatus === 'active'
  const isTrial = subscriptionStatus === 'trial'
  const hasValidPeriod = subscriptionValidUntil ? subscriptionValidUntil.getTime() > Date.now() : false
  const isExpired = !isActive && !isTrial && subscriptionValidUntil ? subscriptionValidUntil.getTime() <= Date.now() : false
  const hasHistory = Boolean(
    subscriptionValidUntil || merchant.last_payment_at || subscriptionStatus === 'canceled'
  )

  const statusLabel = isActive
    ? t('dashboard.statusActive')
    : isTrial
    ? t('dashboard.statusTrial')
    : subscriptionStatus === 'suspended'
    ? t('dashboard.statusSuspended')
    : subscriptionStatus === 'canceled'
    ? hasValidPeriod
      ? t('billing.statusCanceled')
      : t('billing.statusExpired')
    : isExpired
    ? t('billing.statusExpired')
    : t('common.inactive')

  const statusStyles = isActive
    ? 'bg-green-50 text-green-600'
    : isTrial || hasValidPeriod
    ? 'bg-yellow-50 text-yellow-700'
    : 'bg-red-50 text-red-600'

  const planCopy = isTrial
    ? t('billing.planDescriptionTrial')
    : isActive
    ? t('billing.planDescriptionActive')
    : hasHistory
    ? t('billing.planDescriptionInactive')
    : t('billing.planDescriptionNew')

  const formattedSubscriptionValidUntil = subscriptionValidUntil
    ? subscriptionValidUntil.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const subscriptionEndLabel = !isActive && !isTrial && formattedSubscriptionValidUntil && subscriptionValidUntil
    ? subscriptionValidUntil.getTime() > Date.now()
      ? t('billing.subscriptionWillEndOn', { date: formattedSubscriptionValidUntil })
      : t('billing.subscriptionEndedOn', { date: formattedSubscriptionValidUntil })
    : null

  const renewalLabel = subscriptionEndLabel
    ? subscriptionEndLabel
    : formattedSubscriptionValidUntil
    ? formattedSubscriptionValidUntil
    : hasHistory
    ? t('dashboard.noData')
    : t('billing.noRenewalYet')

  const planRateLabel = isActive
    ? t('billing.paidLabel')
    : isTrial
    ? t('billing.trialLabel')
    : hasHistory
    ? t('billing.planInactiveLabel')
    : t('billing.planNewLabel')

  const subscriptionDescription = isActive
    ? t('billing.subscriptionActionsDescription')
    : hasHistory
    ? t('billing.subscriptionActionsDescriptionInactive')
    : t('billing.subscriptionActionsDescriptionNew')

  const primaryAction: { label: string; type: BillingActionType } = isActive
    ? {
        label: t('billing.manageSubscriptionCta'),
        type: 'manage subscription',
      }
    : !isTrial && hasValidPeriod
    ? {
        label: t('billing.resumeSubscriptionCta'),
        type: 'reactivate subscription',
      }
    : {
        label: hasHistory ? t('billing.subscribeAgainCta') : t('billing.subscribeCta'),
        type: 'new subscription',
      }

  const balanceEuros = (merchant.balance_cents ?? 0) / 100

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-gray-900">{t('billing.title')}</h1>
          <p className="mt-2 text-gray-600">{t('billing.subtitle')}</p>
        </header>

        <section className="card flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles}`}>
              {statusLabel.toUpperCase()}
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">{statusLabel}</h2>
            <p className="mt-2 text-sm text-gray-500">{planCopy}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-6 py-4 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('billing.nextRenewal')}</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{renewalLabel}</p>
            <p className="text-sm text-gray-500">{planRateLabel}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('billing.topUpTitle')}</h3>
              <p className="mt-2 text-sm text-gray-500">{t('billing.topUpDescription')}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('billing.balanceLabel')}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {currencyFormatter.format(balanceEuros)}
                </p>
              </div>
              <p className="max-w-[200px] text-right text-xs text-gray-500">{t('billing.balanceDescription')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{t('billing.topUpAmountLabel')}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TOP_UP_AMOUNTS.map((amount) => {
                  const isSelected = topUpAmount === amount
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTopUpAmount(amount)}
                      aria-pressed={isSelected}
                      className={`rounded-lg border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-primary-200 hover:text-primary-700'
                      }`}
                    >
                      {currencyFormatter.format(amount)}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTopUp}
              className="btn btn-secondary w-full"
              disabled={pendingAction !== null}
            >
              {pendingAction === 'top-up' ? t('common.loading') : t('billing.topUpButton')}
            </button>
          </section>

          <section className="card flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('billing.subscriptionActionsTitle')}</h3>
              <p className="mt-2 text-sm text-gray-500">{subscriptionDescription}</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1 text-sm text-gray-600">
                {merchant.stripe_customer_id ? t('billing.paymentOnFile') : t('billing.paymentMissing')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerBillingAction(primaryAction.type)}
              className="btn btn-primary w-full"
              disabled={pendingAction !== null}
            >
              {pendingAction === primaryAction.type ? t('common.loading') : primaryAction.label}
            </button>
          </section>
        </div>

        <section className="card">
          <h3 className="text-lg font-semibold text-gray-900">{t('billing.chargesTitle')}</h3>
          <p className="mt-2 text-sm text-gray-500">{t('billing.chargesDescription', {
            amount: currencyFormatter.format(CHARGE_PER_REDEMPTION),
          })}</p>
          <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('billing.redemptions')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(metrics.monthlyRedemptions)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">{t('billing.amountBilled')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {currencyFormatter.format(metrics.monthlyCharges)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            {t('billing.chargesSummary', {
              count: numberFormatter.format(metrics.monthlyRedemptions),
              amount: currencyFormatter.format(metrics.monthlyCharges),
            })}
          </p>
        </section>

        <section className="card">
          <h3 className="text-lg font-semibold text-gray-900">{t('billing.historyTitle')}</h3>
          <p className="mt-2 text-sm text-gray-500">{t('billing.historyDescription')}</p>
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
            <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 font-medium text-gray-700">{t('billing.historyEmptyTitle')}</p>
            <p className="mt-1 max-w-sm">{t('billing.historyEmptyDescription')}</p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
