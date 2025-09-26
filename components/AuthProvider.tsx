'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthUser, Merchant, UserRecord, getMerchantProfile, getUserRecord } from '@/lib/auth'
import { getMerchantLogoUrl } from '@/lib/storage'

interface AuthContextType {
  user: AuthUser | null
  userRecord: UserRecord | null
  merchant: Merchant | null
  loading: boolean
  signOut: () => Promise<void>
  refreshMerchant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingDataRef = useRef(false)
  const isMountedRef = useRef(true)

  const loadAuthData = useCallback(async (authUser: AuthUser) => {
    if (loadingDataRef.current) {
      console.log('Auth data loading already in progress, skipping...')
      return
    }

    loadingDataRef.current = true
    
    try {
      console.log('Loading auth data for user:', authUser.id)
      const [userData, merchantProfile] = await Promise.all([
        getUserRecord(authUser.id),
        getMerchantProfile(authUser.id)
      ])

      if (!isMountedRef.current) return

      let enhancedMerchant = merchantProfile

      if (merchantProfile?.logo_url && !merchantProfile.logo_url.startsWith('http')) {
        try {
          const signed = await getMerchantLogoUrl(merchantProfile.logo_url)
          enhancedMerchant = { ...merchantProfile, logo_signed_url: signed }
        } catch (error) {
          console.error('Error generating merchant logo URL:', error)
        }
      }

      setUserRecord(userData)
      setMerchant(enhancedMerchant)
      console.log('Auth data loaded successfully')
    } catch (error) {
      console.error('Error loading auth data:', error)
      // Continue with user set but no merchant data
    } finally {
      loadingDataRef.current = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    isMountedRef.current = true

    // Get initial session with Vercel-optimized approach
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...')
        
        // Add timeout protection for Vercel
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 8000)
        )
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ])
        
        if (error) {
          console.error('Session error:', error)
          // Clear potentially corrupted session
          await supabase.auth.signOut()
          if (isMounted) {
            setLoading(false)
          }
          return
        }
        
        if (!isMounted) return

        if (session?.user) {
          const authUser = session.user as AuthUser
          console.log('Initial session found, setting user:', authUser.id)
          setUser(authUser)
          
          // Defer auth data loading to prevent blocking
          setTimeout(() => {
            if (isMounted) {
              loadAuthData(authUser).catch(error => {
                console.error('Error loading initial auth data:', error)
                // Don't fail completely, just log the error
              })
            }
          }, 100) // Slightly longer delay for Vercel
        } else {
          console.log('No initial session found')
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
        // On error, clear any potentially corrupted state
        if (isMounted) {
          setUser(null)
          setUserRecord(null)
          setMerchant(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Add a small delay for Vercel hydration
    const initTimer = setTimeout(() => {
      getInitialSession()
    }, 50)

    // Listen for auth changes - CRITICAL: No async operations in callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id)
        
        if (!isMounted) return

        if (session?.user) {
          const authUser = session.user as AuthUser
          setUser(authUser)
          
          // Defer async operations to prevent deadlocks
          setTimeout(() => {
            if (isMounted) {
              loadAuthData(authUser).catch(error => {
                console.error('Error loading auth data on state change:', error)
              })
            }
          }, 100)
        } else {
          setUser(null)
          setUserRecord(null)
          setMerchant(null)
        }
        
        if (isMounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(initTimer)
      isMounted = false
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [loadAuthData])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserRecord(null)
      setMerchant(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [])

  const refreshMerchant = useCallback(async () => {
    if (!user) return
    
    try {
      const merchantProfile = await getMerchantProfile(user.id)
      if (merchantProfile?.logo_url && !merchantProfile.logo_url.startsWith('http')) {
        try {
          const signed = await getMerchantLogoUrl(merchantProfile.logo_url)
          setMerchant({ ...merchantProfile, logo_signed_url: signed })
          return
        } catch (error) {
          console.error('Error refreshing merchant logo URL:', error)
        }
      }
      setMerchant(merchantProfile)
    } catch (error) {
      console.error('Error refreshing merchant:', error)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, userRecord, merchant, loading, signOut, refreshMerchant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
