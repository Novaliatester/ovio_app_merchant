'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import LoginPage from '@/components/LoginPage'

export default function LoginPageRoute() {
  const { user, userRecord, merchant, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (!loading && user && userRecord?.role === 'merchant' && merchant) {
      router.replace('/dashboard')
    }
  }, [user, userRecord, merchant, loading, router])

  // Show loading while checking auth
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: 'url(/1271722.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm text-white">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login form
  return <LoginPage />
}
