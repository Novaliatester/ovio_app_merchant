/**
 * Loading state manager to prevent race conditions and infinite loading screens
 */

interface LoadingState {
  auth: boolean
  data: boolean
  navigation: boolean
}

class LoadingStateManager {
  private state: LoadingState = {
    auth: true,
    data: false,
    navigation: false
  }

  private listeners: Set<(state: LoadingState) => void> = new Set()

  getState(): LoadingState {
    return { ...this.state }
  }

  isAnyLoading(): boolean {
    return Object.values(this.state).some(loading => loading)
  }

  setAuthLoading(loading: boolean): void {
    this.state.auth = loading
    this.notifyListeners()
  }

  setDataLoading(loading: boolean): void {
    this.state.data = loading
    this.notifyListeners()
  }

  setNavigationLoading(loading: boolean): void {
    this.state.navigation = loading
    this.notifyListeners()
  }

  subscribe(listener: (state: LoadingState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('Error in loading state listener:', error)
      }
    })
  }

  // Reset all loading states (useful for error recovery)
  reset(): void {
    this.state = {
      auth: false,
      data: false,
      navigation: false
    }
    this.notifyListeners()
  }
}

// Singleton instance
export const loadingStateManager = new LoadingStateManager()

// React hook for using loading state
export function useLoadingState() {
  const [state, setState] = React.useState(loadingStateManager.getState())

  React.useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe(setState)
    return unsubscribe
  }, [])

  return {
    ...state,
    isAnyLoading: loadingStateManager.isAnyLoading()
  }
}

// Import React for the hook
import React from 'react'
