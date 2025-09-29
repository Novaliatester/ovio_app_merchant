'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import LoginPage from '@/components/LoginPage'
import DashboardPageContent from "@/app/dashboard/page";
import DashboardLayout from "@/components/DashboardLayout";

export default function HomePage() {
  const { user, userRecord, merchant, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout>(0 as unknown as NodeJS.Timeout)
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current || isRedirecting) return

    if (!loading) {
      if (user && userRecord) {
        console.log('User is authenticated:', user, userRecord)
        if (userRecord.role === 'merchant') {
          if (merchant) {
            // Only redirect if we're actually on the home page (not coming from a dashboard redirect)
            if (pathname === '/') {
              console.log('Redirecting authenticated user to dashboard...')
              setIsRedirecting(true)
              hasRedirectedRef.current = true
              router.replace('/dashboard')
            }
          } else {
            // User has merchant role but no merchant profile - redirect to unauthorized
            console.error('User has merchant role but no merchant profile')
            setIsRedirecting(true)
            hasRedirectedRef.current = true
            router.replace('/unauthorized')
          }
        } else {
          // User is not a merchant
          setIsRedirecting(true)
          hasRedirectedRef.current = true
          router.replace('/unauthorized')
        }
      }
      // If no user or userRecord, stay on login page (no redirect needed)
    }
  }, [user, userRecord, merchant, loading, router, isRedirecting])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">
            {loading ? 'Loading...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    )
  }

  if (user && userRecord) {
    if (userRecord.role === 'merchant' && merchant) {
      return null
    } else {
      return null // Will redirect to unauthorized
    }
  }

  return <LoginPage />
}
