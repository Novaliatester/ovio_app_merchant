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

export interface Offer {
  id: number
  merchant_id: number
  title: string
  description?: string
  discount_type: 'percent' | 'coupon'
  discount_value: number
  min_followers: number
  start_at?: string
  end_at?: string
  is_active: boolean
  created_at: string
  deleted: boolean
}

export interface OfferClaim {
  id: number
  offer_id: number
  student_id: number
  status: 'activated' | 'proof_uploaded' | 'validated' | 'expired' | 'canceled'
  proof_image_url?: string
  proof_verified?: boolean
  qr_code?: string
  qr_expires_at?: string
  created_at: string
}

export interface Redemption {
  id: number
  claim_id: number
  redeemed_by_user_id?: number
  redeemed_at: string
}

export interface AuthUser extends User {
  user_metadata: {
    role?: 'merchant' | 'admin' | 'student'
  }
}

type SupabaseSignUpResponse = Awaited<ReturnType<typeof supabase.auth.signUp>>

export interface SignUpResult {
  auth: SupabaseSignUpResponse['data']
  merchantId?: number
}

export async function signUp(email: string, password: string, businessData: Partial<Merchant>): Promise<SignUpResult> {
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

  let createdMerchantId: number | undefined

  if (data.user) {
    // First create user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        role: 'merchant',
        auth_user_id: data.user.id
      })
      .select()
      .single()

    if (userError) throw userError

    // Then create merchant profile
    const { data: merchantRow, error: merchantError } = await supabase
      .from('merchants')
      .insert({
        owner_user_id: userData.id,
        name: businessData.name || '',
        legal_name: businessData.legal_name,
        vat_number: businessData.vat_number,
        logo_url: businessData.logo_url,
        address: businessData.address,
        contact_email: businessData.contact_email,
        preferred_language: businessData.preferred_language || 'en'
      })
      .select('id')
      .single()

    if (merchantError) throw merchantError
    createdMerchantId = merchantRow?.id
  }

  return { auth: data, merchantId: createdMerchantId }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error

  if (data.user) {
    // Get user record to check role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', data.user.id)
      .single()

    if (userError || userData?.role !== 'merchant') {
      await supabase.auth.signOut()
      throw new Error('Unauthorized: Only merchants can access this application')
    }
  }

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

export async function getMerchantProfile(authUserId: string): Promise<Merchant | null> {
  try {
    // First get the user record to get the user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return null
    }

    if (!userData) {
      console.log('No user data found for auth_user_id:', authUserId)
      return null
    }

    // Get the merchant profile using the user ID
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('owner_user_id', userData.id)
      .single()

    if (error) {
      console.error('Error fetching merchant profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error in getMerchantProfile:', error)
    return null
  }
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
