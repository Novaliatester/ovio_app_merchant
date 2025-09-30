'use client'

import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'

export default function DebugPage() {
  const { user, userRecord, merchant, loading } = useAuth()
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null)

  const checkDatabase = useCallback(async () => {
    try {
      // Check if user exists in users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user!.id)

      // Check if merchant profile exists
      let merchantData = null
      let merchantError = null
      if (usersData && usersData.length > 0) {
        const { data: merchantResult, error: merchantErr } = await supabase
          .from('merchants')
          .select('*')
          .eq('owner_user_id', usersData[0].id)

        merchantData = merchantResult
        merchantError = merchantErr
      }

      setDebugInfo({
        authUser: {
          id: user!.id,
          email: user!.email,
          role: user!.user_metadata?.role
        },
        usersTable: {
          data: usersData,
          error: usersError
        },
        merchantsTable: {
          data: merchantData,
          error: merchantError
        },
        authProvider: {
          userRecord,
          merchant
        }
      })
    } catch (error) {
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [user, userRecord, merchant])

  useEffect(() => {
    if (user) {
      checkDatabase()
    }
  }, [user, checkDatabase])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please log in to see debug information</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  )
}
