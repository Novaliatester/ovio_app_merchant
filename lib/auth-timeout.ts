/**
 * Authentication timeout protection to prevent infinite loading screens
 */

const AUTH_TIMEOUT_MS = 10000 // 10 seconds
const MAX_RETRIES = 3

class AuthTimeoutManager {
  private timeouts = new Map<string, NodeJS.Timeout>()
  private retryCounts = new Map<string, number>()

  /**
   * Set a timeout for an auth operation
   */
  setTimeout(operationId: string, callback: () => void): void {
    this.clearTimeout(operationId)
    
    const timeout = setTimeout(() => {
      console.warn(`Auth operation ${operationId} timed out after ${AUTH_TIMEOUT_MS}ms`)
      callback()
      this.timeouts.delete(operationId)
    }, AUTH_TIMEOUT_MS)
    
    this.timeouts.set(operationId, timeout)
  }

  /**
   * Clear a timeout for an auth operation
   */
  clearTimeout(operationId: string): void {
    const timeout = this.timeouts.get(operationId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(operationId)
    }
  }

  /**
   * Check if an operation should be retried
   */
  shouldRetry(operationId: string): boolean {
    const retryCount = this.retryCounts.get(operationId) || 0
    return retryCount < MAX_RETRIES
  }

  /**
   * Increment retry count for an operation
   */
  incrementRetry(operationId: string): number {
    const current = this.retryCounts.get(operationId) || 0
    const newCount = current + 1
    this.retryCounts.set(operationId, newCount)
    return newCount
  }

  /**
   * Reset retry count for an operation
   */
  resetRetry(operationId: string): void {
    this.retryCounts.delete(operationId)
  }

  /**
   * Clear all timeouts and retry counts
   */
  clearAll(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.retryCounts.clear()
  }
}

export const authTimeoutManager = new AuthTimeoutManager()

/**
 * Hook to manage auth operation timeouts
 */
export function useAuthTimeout() {
  const [isTimedOut, setIsTimedOut] = React.useState(false)

  const startTimeout = React.useCallback((operationId: string, onTimeout: () => void) => {
    setIsTimedOut(false)
    authTimeoutManager.setTimeout(operationId, () => {
      setIsTimedOut(true)
      onTimeout()
    })
  }, [])

  const clearTimeout = React.useCallback((operationId: string) => {
    authTimeoutManager.clearTimeout(operationId)
    setIsTimedOut(false)
  }, [])

  const shouldRetry = React.useCallback((operationId: string) => {
    return authTimeoutManager.shouldRetry(operationId)
  }, [])

  const incrementRetry = React.useCallback((operationId: string) => {
    return authTimeoutManager.incrementRetry(operationId)
  }, [])

  const resetRetry = React.useCallback((operationId: string) => {
    authTimeoutManager.resetRetry(operationId)
  }, [])

  React.useEffect(() => {
    return () => {
      // Clean up on unmount
      authTimeoutManager.clearAll()
    }
  }, [])

  return {
    isTimedOut,
    startTimeout,
    clearTimeout,
    shouldRetry,
    incrementRetry,
    resetRetry
  }
}

// Import React for the hook
import React from 'react'
