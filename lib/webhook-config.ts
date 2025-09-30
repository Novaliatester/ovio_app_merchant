/**
 * Webhook configuration and validation
 */

export interface WebhookConfig {
  url: string
  name: string
  description: string
  enabled: boolean
}

/**
 * Approved webhook endpoints
 */
export const APPROVED_WEBHOOKS: Record<string, WebhookConfig> = {
  SIGNUP_WEBHOOK: {
    url: 'https://prod.lucasaibot.uk/webhook/db983b11-8739-4f2d-8e97-097b82210e54',
    name: 'Signup Webhook',
    description: 'Handles new merchant signup notifications',
    enabled: true
  },
  BILLING_WEBHOOK: {
    url: 'https://prod.lucasaibot.uk/webhook/dee4390c-087a-41f1-9103-bf77934e4d3e',
    name: 'Billing Webhook',
    description: 'Handles billing and payment notifications',
    enabled: true
  }
}

/**
 * Get webhook URL by key
 */
export function getWebhookUrl(key: keyof typeof APPROVED_WEBHOOKS): string | null {
  const webhook = APPROVED_WEBHOOKS[key]
  return webhook?.enabled ? webhook.url : null
}

/**
 * Validate webhook URL against approved list
 */
export function isApprovedWebhook(url: string): boolean {
  return Object.values(APPROVED_WEBHOOKS).some(webhook => 
    webhook.enabled && webhook.url === url
  )
}

/**
 * Get all enabled webhook URLs
 */
export function getAllEnabledWebhooks(): WebhookConfig[] {
  return Object.values(APPROVED_WEBHOOKS).filter(webhook => webhook.enabled)
}

/**
 * Validate webhook response
 */
export function validateWebhookResponse(response: unknown): { isValid: boolean; error?: string } {
  if (!response) {
    return { isValid: false, error: 'Empty response' }
  }

  if (typeof response === 'object' && 'success' in response) {
    if (response.success === true) {
      return { isValid: true }
    } else {
      return { isValid: false, error: response.error || 'Webhook returned success: false' }
    }
  }

  // If no success field, assume it's valid if we got a response
  return { isValid: true }
}

/**
 * Make a secure webhook call
 */
export async function callWebhook(
  webhookKey: keyof typeof APPROVED_WEBHOOKS,
  data: Record<string, unknown>,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const webhookUrl = getWebhookUrl(webhookKey)
  
  if (!webhookUrl) {
    return { success: false, error: 'Webhook not configured or disabled' }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Ovio-Merchant-App/1.0',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    })

    if (!response.ok) {
      return { 
        success: false, 
        error: `Webhook responded with status ${response.status}: ${response.statusText}` 
      }
    }

    const result = await response.json()
    const validation = validateWebhookResponse(result)

    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    return { success: true, data: result }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown webhook error' 
    }
  }
}
