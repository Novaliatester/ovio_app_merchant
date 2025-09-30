'use client'

import { useAuth } from './AuthProvider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from './LanguageProvider'
import LanguageSelector from './LanguageSelector'
import { Merchant } from '@/lib/auth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const getIcon = (iconName: string, isActive: boolean) => {
  const base = 'w-5 h-5 transition-colors'
  const icons = {
    dashboard: (
      <svg className={`${base} ${isActive ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
      </svg>
    ),
    offers: (
      <svg className={`${base} ${isActive ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    billing: (
      <svg className={`${base} ${isActive ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    profile: (
      <svg className={`${base} ${isActive ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  }
  return icons[iconName as keyof typeof icons] || null
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { merchant, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const navigation = useMemo(
    () => [
      { name: t('navigation.dashboard'), href: '/dashboard', icon: 'dashboard' },
      { name: t('navigation.offers'), href: '/dashboard/offers', icon: 'offers' },
      { name: t('navigation.billing'), href: '/dashboard/billing', icon: 'billing' },
      { name: t('navigation.profile'), href: '/dashboard/profile', icon: 'profile' },
    ],
    [t]
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    if (profileMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profileMenuOpen])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const renderNavItems = (isMobile = false) => (
    <nav
      className={
        isMobile
          ? 'mt-5 px-4 space-y-1'
          : `mt-6 flex-1 space-y-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`
      }
    >
      {navigation.map((item) => {
        const isExactMatch = pathname === item.href
        const isPrefixMatch = pathname.startsWith(`${item.href}/`)
        const isActive = isExactMatch || (item.href !== '/dashboard' && isPrefixMatch)
        const linkClasses = [
          'group flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
          isMobile ? 'px-3' : isSidebarCollapsed ? 'justify-center px-2' : 'px-3',
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        ].join(' ')

        return (
          <Link
            key={item.name}
            href={item.href}
            className={linkClasses}
            onClick={() => setSidebarOpen(false)}
            title={!isMobile && isSidebarCollapsed ? item.name : undefined}
            aria-label={!isMobile && isSidebarCollapsed ? item.name : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            {getIcon(item.icon, isActive)}
            {(!isSidebarCollapsed || isMobile) && <span className="ml-3">{item.name}</span>}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 bg-gray-900/70 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`relative flex w-72 max-w-xs flex-col bg-white shadow-xl transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-4 pt-5">
            <div className="flex-1">
              <p className="text-lg font-semibold text-gray-900">Ovio Merchant</p>
              <p className="text-xs text-gray-500">{t('navigation.brandTagline')}</p>
            </div>
            <button
              type="button"
              className="rounded-md p-2 text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">{t('common.closeMenu')}</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pb-6">{renderNavItems(true)}</div>
        </div>
      </div>

      <div className="flex relative z-10">
        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white ${
            isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
          }`}
        >
          <div className={`flex h-16 items-center border-b border-gray-100 ${isSidebarCollapsed ? 'justify-center px-3' : 'px-4'}`}>
            {isSidebarCollapsed ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600">
                  O
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title={t('navigation.expandSidebar')}
                  aria-label={t('navigation.expandSidebar')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-900">Ovio Merchant</p>
                  <p className="text-xs text-gray-500">{t('navigation.brandTagline')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title={t('navigation.collapseSidebar')}
                  aria-label={t('navigation.collapseSidebar')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto pb-6">
            {renderNavItems()}
          </div>
        </aside>

        <div className={`flex min-h-screen w-full flex-1 flex-col ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
          <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <span className="sr-only">{t('common.openMenu')}</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <LanguageSelector />

                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((prev) => !prev)}
                    className="flex items-center rounded-full border border-gray-200 bg-white px-4 h-12 text-left transition hover:border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <div className="hidden pr-3 text-right text-sm text-gray-600 sm:block">
                      <p className="font-medium text-gray-900">{merchant?.name || t('navigation.profile')}</p>
                      <p className="text-xs text-gray-500">{t('navigation.profile')}</p>
                    </div>
                    <Avatar merchant={merchant} />
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 z-40 mt-3 w-48 origin-top-right rounded-lg border border-gray-100 bg-white p-1 shadow-lg">
                      <Link
                        href="/dashboard/profile"
                        className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        {t('navigation.profile')}
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        {t('navigation.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function Avatar({ merchant, collapsed = false }: { merchant: Merchant | null | undefined; collapsed?: boolean }) {
  const fallback = merchant?.name?.charAt(0).toUpperCase() || 'M'
  const logoSrc = merchant?.logo_signed_url || (merchant?.logo_url?.startsWith('http') ? merchant.logo_url : undefined)

  if (logoSrc) {
    const size = collapsed ? 32 : 40
    return (
      <div
        className={`relative overflow-hidden rounded-full border border-gray-200 bg-gray-100 ${
          collapsed ? 'h-8 w-8' : 'h-10 w-10'
        }`}
      >
        <Image
          src={logoSrc}
          alt={merchant?.name || 'Merchant logo'}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600 ${
        collapsed ? 'h-8 w-8' : 'h-10 w-10'
      }`}
    >
      {fallback}
    </div>
  )
}
