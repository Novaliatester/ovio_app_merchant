import { supabase } from './supabase'

export const MERCHANT_BUCKET = 'merchant-logos'
export const STUDENT_BUCKET = 'student-proofs'

const safeRandomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const extractFileExtension = (file: File) => {
  const nameParts = file.name.split('.').filter(Boolean)
  return nameParts.length > 0 ? nameParts[nameParts.length - 1].toLowerCase() : undefined
}

export async function uploadMerchantLogo(file: File, merchantId: number) {
  const extension = extractFileExtension(file) || 'png'
  const fileName = `${Date.now()}-${safeRandomId()}.${extension}`
  const filePath = `${merchantId}/${fileName}`

  const { error } = await supabase.storage
    .from(MERCHANT_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || `image/${extension}`,
    })

  if (error) {
    throw error
  }

  const signedUrl = await getMerchantLogoUrl(filePath)

  return {
    path: filePath,
    signedUrl,
  }
}

export async function uploadStudentProof(file: File, userId: number) {
  const extension = extractFileExtension(file) || 'jpg'
  const fileName = `${Date.now()}-${safeRandomId()}.${extension}`
  const filePath = `${userId}/${fileName}`

  const { error } = await supabase.storage
    .from(STUDENT_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${extension}`,
    })

  if (error) {
    throw error
  }

  return {
    path: filePath,
  }
}

export async function createStudentProofSignedUrl(path: string, expiresInSeconds = 60 * 60) {
  const { data, error } = await supabase.storage
    .from(STUDENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error) {
    throw error
  }

  return data.signedUrl
}

export async function getMerchantLogoUrl(path: string, expiresInSeconds = 60 * 60) {
  const { data, error } = await supabase.storage
    .from(MERCHANT_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error) {
    throw error
  }

  return data.signedUrl
}
