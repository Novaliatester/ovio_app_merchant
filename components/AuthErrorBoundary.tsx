'use client'

import React from 'react'
import { supabase } from '@/lib/supabase'

interface AuthErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
}

export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: AuthErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    // Check if this is an auth-related error
    const isAuthError = 
      error.message.includes('AuthApiError') ||
      error.message.includes('Invalid Refresh Token') ||
      error.message.includes('JWT') ||
      error.message.includes('session') ||
      error.message.includes('authentication')

    if (isAuthError) {
      return {
        hasError: true,
        error,
        retryCount: 0
      }
    }

    // Re-throw non-auth errors
    throw error
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Auth error boundary caught error:', error, errorInfo)
    
    // If this is a refresh token error, sign out the user
    if (error.message.includes('Invalid Refresh Token')) {
      this.handleRefreshTokenError()
    }
  }

  private handleRefreshTokenError = async () => {
    try {
      console.log('Handling refresh token error - signing out user')
      await supabase.auth.signOut()
      
      // Clear any cached data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
        sessionStorage.clear()
      }
      
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } catch (signOutError) {
      console.error('Error during sign out:', signOutError)
      // Force redirect even if sign out fails
      window.location.href = '/'
    }
  }

  private retry = () => {
    const { retryCount } = this.state
    const maxRetries = 3

    if (retryCount >= maxRetries) {
      console.log('Max retries reached, redirecting to login')
      window.location.href = '/'
      return
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultAuthErrorFallback
      return <FallbackComponent error={this.state.error!} retry={this.retry} />
    }

    return this.props.children
  }
}

function DefaultAuthErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-lg font-medium text-gray-900">Authentication Error</h3>
          <p className="mt-2 text-sm text-gray-500">
            There was a problem with your session. This usually happens when your session expires.
          </p>
          <div className="mt-6">
            <button
              onClick={retry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Try Again
            </button>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
