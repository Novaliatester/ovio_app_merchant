import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface UserRecord {
  id: number
  email: string
  role: 'student' | 'merchant' | 'admin'
  is_active: boolean
  created_at: string
  auth_user_id: string
}

export interface Merchant {
  id: number
  owner_user_id: number
  name: string
  legal_name?: string
  vat_number?: string
  stripe_customer_id?: string
  logo_url?: string
  logo_signed_url?: string
  address?: string | null
  contact_email?: string | null
  subscription_status?: 'trial' | 'active' | 'suspended' | 'canceled' | null
  subscription_valid_until?: string | null
  balance_cents?: number | null
  last_payment_at?: string | null
  preferred_language?: string | null
  is_visible: boolean
  created_at: string
}

export interface AuthUser extends User {
  user_metadata: {
    role?: 'merchant' | 'admin' | 'student'
  }
}

type SupabaseSignUpResponse = Awaited<ReturnType<typeof supabase.auth.signUp>>

export interface SignUpResult {
  auth: SupabaseSignUpResponse['data']
}

/**
 * Only creates the auth user.
 * public.users + merchants rows are created automatically by DB triggers.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'merchant'
      }
    }
  })

  if (error) throw error
  return { auth: data }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user as AuthUser | null
}

export async function getUserRecord(authUserId: string): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) return null
  return data
}

export async function getMerchantProfile(authUserId: string): Promise<Merchant | null> {
  // Fetch user first
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (userError || !userData) return null

  // Fetch merchant row
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('owner_user_id', userData.id)
    .maybeSingle()

  if (error) return null
  return data
}