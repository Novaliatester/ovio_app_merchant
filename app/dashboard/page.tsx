'use client'

import {useAuth} from '@/components/AuthProvider'
import DashboardLayout from '@/components/DashboardLayout'
import {supabase} from '@/lib/supabase'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from '@/components/LanguageProvider'

interface DashboardStats {
    activeOffers: number
    totalRedemptions: number
    monthlyRedemptions: number
    subscriptionStatus: 'trial' | 'active' | 'suspended' | 'canceled' | 'inactive'
    renewalDate: string | null
    hasPaymentMethod: boolean
    subscriptionEnded: boolean
    subscriptionEndsSoon: boolean
}

export const runtime = 'nodejs'

export default function DashboardPageContent() {
    const {user, merchant, loadingContext} = useAuth()
    const router = useRouter()
    const {t, locale} = useTranslation()
    const [stats, setStats] = useState<DashboardStats>({
        activeOffers: 0,
        totalRedemptions: 0,
        monthlyRedemptions: 0,
        subscriptionStatus: 'trial',
        renewalDate: null,
        hasPaymentMethod: false,
        subscriptionEnded: false,
        subscriptionEndsSoon: false
    })
    const [statsLoading, setStatsLoading] = useState(true)
    const redirectingRef = useRef(false)

  useEffect(() => {
      console.log('Auth dasboard loading state changed:', loadingContext, user, merchant)
    if (!loadingContext && (!user || !merchant) && !redirectingRef.current) {
      redirectingRef.current = true
        console.log('User or merchant not found, redirecting to login page')
      router.replace('/login')
    }
  }, [user, merchant, loadingContext, router])

    const fetchDashboardStats = useCallback(async () => {
        try {
            const {count: activeOffers} = await supabase
                .from('offers')
                .select('*', {count: 'exact', head: true})
                .eq('merchant_id', merchant!.id)
                .eq('is_active', true)

            const {data: offers} = await supabase
                .from('offers')
                .select('id')
                .eq('merchant_id', merchant!.id)

            let totalRedemptions = 0
            let monthlyRedemptions = 0
            if (offers && offers.length > 0) {
                const offerIds = offers.map((offer: any) => offer.id)
                const {count} = await supabase
                    .from('redemptions')
                    .select('*', {count: 'exact', head: true})
                    .in('claim_id', offerIds)
                totalRedemptions = count || 0

                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
                const {count: monthlyCount} = await supabase
                    .from('redemptions')
                    .select('*', {count: 'exact', head: true})
                    .in('claim_id', offerIds)
                    .gte('redeemed_at', startOfMonth)
                monthlyRedemptions = monthlyCount || 0
            }

            const subscriptionStatus = merchant?.subscription_status ?? 'inactive'
            const renewalDate = merchant?.subscription_valid_until ?? null
            const hasPaymentMethod = Boolean(merchant?.stripe_customer_id)
            const subscriptionValidUntilDate = renewalDate ? new Date(renewalDate) : null
            const now = new Date()
            const subscriptionEnded = Boolean(
                subscriptionValidUntilDate && subscriptionValidUntilDate.getTime() < now.getTime()
            )
            const subscriptionEndsSoon = Boolean(
                subscriptionValidUntilDate &&
                subscriptionValidUntilDate.getTime() >= now.getTime() &&
                subscriptionValidUntilDate.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000
            )

            setStats({
                activeOffers: activeOffers || 0,
                totalRedemptions,
                monthlyRedemptions,
                subscriptionStatus,
                renewalDate,
                hasPaymentMethod,
                subscriptionEnded,
                subscriptionEndsSoon
            })
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setStatsLoading(false)
        }
    }, [merchant])

    useEffect(() => {
        if (merchant) {
            fetchDashboardStats()
        }
    }, [merchant, fetchDashboardStats])

    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])

    if (loadingContext || statsLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary-600"></div>
            </div>
        )
    }

    if (!user || !merchant) {
        return null
    }

    const renewalDate = stats.renewalDate
        ? new Date(stats.renewalDate).toLocaleDateString(locale, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
        : t('dashboard.noData')

    const subscriptionCardTone = stats.subscriptionStatus === 'active'
        ? 'bg-green-50 text-green-600'
        : stats.subscriptionStatus === 'trial'
            ? 'bg-yellow-50 text-yellow-700'
            : stats.subscriptionStatus === 'suspended'
                ? 'bg-red-50 text-red-600'
                : 'bg-gray-100 text-gray-600'

    const subscriptionHeadline = stats.subscriptionStatus === 'active'
        ? t('dashboard.statusActive')
        : stats.subscriptionStatus === 'trial'
            ? t('dashboard.statusTrial')
            : stats.subscriptionStatus === 'suspended'
                ? t('dashboard.statusSuspended')
                : t('common.inactive')

    const subscriptionMessage = (() => {
        if (stats.subscriptionStatus === 'trial') {
            return t('dashboard.subscriptionTrialMessage', {date: renewalDate})
        }

        if (stats.subscriptionStatus === 'active') {
            if (stats.subscriptionEndsSoon) {
                return t('dashboard.subscriptionEndingSoon', {date: renewalDate})
            }
            return t('dashboard.subscriptionActiveMessage', {date: renewalDate})
        }

        if (stats.subscriptionEnded) {
            return t('dashboard.subscriptionEndedMessage', {date: renewalDate})
        }

        if (stats.subscriptionStatus === 'suspended') {
            return t('dashboard.subscriptionSuspendedMessage')
        }

        return stats.hasPaymentMethod
            ? t('dashboard.subscriptionInactivePaymentOnFile')
            : t('dashboard.subscriptionInactiveNoPayment')
    })()

    const subscriptionPrimaryAction = stats.subscriptionStatus === 'active'
        ? {href: '/dashboard/billing', label: t('dashboard.manageSubscriptionLink')}
        : {href: '/dashboard/billing', label: t('billing.subscribeCta')}

    const subscriptionSecondaryAction = !stats.hasPaymentMethod
        ? {href: '/dashboard/billing', label: t('dashboard.addPaymentMethodLink')}
        : null

    const whatsNextItems = (() => {
        const items: { tone: 'primary' | 'warning' | 'muted'; label: string }[] = []

        if (stats.subscriptionStatus === 'trial') {
            items.push({tone: 'primary', label: t('dashboard.whatsNextTrial')})
        }

        if (stats.subscriptionEndsSoon) {
            items.push({tone: 'warning', label: t('dashboard.whatsNextRenewSoon', {date: renewalDate})})
        }

        if (stats.subscriptionEnded) {
            items.push({tone: 'warning', label: t('dashboard.whatsNextResume')})
        }

        if (stats.activeOffers === 0) {
            items.push({tone: 'primary', label: t('dashboard.whatsNextCreateOffer')})
        }

        if (stats.monthlyRedemptions === 0 && stats.activeOffers > 0) {
            items.push({tone: 'primary', label: t('dashboard.whatsNextPromoteOffer')})
        }

        if (!stats.hasPaymentMethod) {
            items.push({tone: 'muted', label: t('dashboard.whatsNextAddPayment')})
        }

        if (items.length === 0) {
            items.push({tone: 'primary', label: t('dashboard.whatsNextAllGood')})
        }

        return items.slice(0, 3)
    })()

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900">{t('navigation.dashboard')}</h1>
                        <p className="text-gray-600">{t('dashboard.welcome', {name: merchant.name})}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link
                            href={{pathname: '/dashboard/offers', query: {view: 'create'}}}
                            className="btn btn-primary flex items-center justify-center gap-2"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                            </svg>
                            {t('dashboard.createOffer')}
                        </Link>
                        <Link
                            href="/dashboard/billing"
                            className="btn btn-secondary flex items-center justify-center gap-2"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                            </svg>
                            {t('dashboard.goToBilling')}
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="card flex h-full flex-col justify-between gap-6">
                        <div className="space-y-4">
                            <div
                                className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                                {t('dashboard.activeOffers')}
                            </div>
                            <p className="text-4xl font-semibold text-gray-900">{numberFormatter.format(stats.activeOffers)}</p>
                            <p className="text-sm text-gray-500">{t('dashboard.activeOffersDescription')}</p>
                        </div>
                        <Link href="/dashboard/offers"
                              className="text-sm font-medium text-primary-600 hover:text-primary-700">
                            {t('dashboard.manageOffersLink')}
                        </Link>
                    </div>

                    <div className="card flex h-full flex-col justify-between gap-6">
                        <div className="space-y-4">
                            <div
                                className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                                {t('dashboard.redemptions')}
                            </div>
                            <div>
                                <p className="text-4xl font-semibold text-gray-900">{numberFormatter.format(stats.totalRedemptions)}</p>
                                <p className="text-sm text-gray-500">{t('dashboard.lifetimeRedemptions')}</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('dashboard.thisMonth')}</p>
                                <p className="mt-1 text-lg font-semibold text-gray-900">{numberFormatter.format(stats.monthlyRedemptions)}</p>
                            </div>
                        </div>
                        <Link href="/dashboard/offers"
                              className="text-sm font-medium text-primary-600 hover:text-primary-700">
                            {t('dashboard.viewPerformanceLink')}
                        </Link>
                    </div>

                    <div className="card flex h-full flex-col justify-between gap-6">
                        <div className="space-y-4">
                            <div
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${subscriptionCardTone}`}>
                                {t('dashboard.subscription')} · {subscriptionHeadline}
                            </div>
                            <div>
                                <p className="text-3xl font-semibold text-gray-900">{subscriptionHeadline}</p>
                                <p className="mt-2 text-sm text-gray-500">{subscriptionMessage}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Link
                                href={subscriptionPrimaryAction.href}
                                className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                                {subscriptionPrimaryAction.label}
                            </Link>
                            {subscriptionSecondaryAction && (
                                <Link
                                    href={subscriptionSecondaryAction.href}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                                >
                                    {subscriptionSecondaryAction.label}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.quickActions')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('dashboard.quickActionsDescription')}</p>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <Link
                                href="/dashboard/offers"
                                className="flex h-full flex-col justify-between rounded-xl border border-gray-200 p-4 transition hover:border-primary-200 hover:bg-primary-50/30"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                            </svg>
                                        </div>
                                        <span
                                            className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {t('dashboard.activeOffersCount', {count: numberFormatter.format(stats.activeOffers)})}
                    </span>
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-gray-900">{t('dashboard.manageOffers')}</h3>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">{t('dashboard.activeOffersDescription')}</p>
                            </Link>

                            <Link
                                href="/dashboard/billing"
                                className="flex h-full flex-col justify-between rounded-xl border border-gray-200 p-4 transition hover:border-primary-200 hover:bg-primary-50/30"
                            >
                                <div>
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                                        </svg>
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-gray-900">{t('navigation.billing')}</h3>
                                    <p className="mt-2 text-sm text-gray-500">{t('billing.subtitle')}</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="card h-full">
                        <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.whatsNext')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('dashboard.whatsNextDescription')}</p>
                        <ul className="mt-6 space-y-4 text-sm text-gray-600">
                            {whatsNextItems.map((item, index) => {
                                const toneClass = item.tone === 'primary' ? 'bg-primary-500' : item.tone === 'warning' ? 'bg-yellow-500' : 'bg-gray-300'
                                return (
                                    <li key={index} className="flex items-start gap-3">
                                        <span
                                            className={`mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${toneClass}`}></span>
                                        {item.label}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
