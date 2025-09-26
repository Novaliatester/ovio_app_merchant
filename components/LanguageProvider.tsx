'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LANGUAGE_OPTIONS, LanguageCode, localeMap, translations } from '@/lib/i18n'
import { useAuth } from './AuthProvider'

interface TranslationParams {
  [key: string]: string | number
}

interface LanguageContextValue {
  language: LanguageCode
  locale: string
  setLanguage: (code: LanguageCode) => void
  t: (key: string, replacements?: TranslationParams) => string
  options: typeof LANGUAGE_OPTIONS
}

const STORAGE_KEY = 'ovio-language'
const DEFAULT_LANGUAGE: LanguageCode = 'en'

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGE_OPTIONS.some((option) => option.code === value)
}

function resolveTranslation(code: LanguageCode, key: string): string | undefined {
  const segments = key.split('.')
  let current: any = translations[code]

  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment]
    } else {
      return undefined
    }
  }

  return typeof current === 'string' ? current : undefined
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { merchant } = useAuth()
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE)
  const initialisedRef = useRef(false)

  // Initialise language from storage or merchant profile
  useEffect(() => {
    if (initialisedRef.current) return

    let initial = DEFAULT_LANGUAGE

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored && isLanguageCode(stored)) {
        initial = stored
      }
    }

    if (initial === DEFAULT_LANGUAGE && merchant?.preferred_language && isLanguageCode(merchant.preferred_language)) {
      initial = merchant.preferred_language
    }

    setLanguageState(initial)
    initialisedRef.current = true
  }, [merchant])

  // Keep html lang attribute in sync
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, code)
    }

    if (
      merchant &&
      Object.prototype.hasOwnProperty.call(merchant, 'preferred_language') &&
      merchant.preferred_language !== code
    ) {
      supabase
        .from('merchants')
        .update({ preferred_language: code })
        .eq('id', merchant.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating preferred language', error)
          }
        })
    }
  }, [merchant])

  const translate = useCallback(
    (key: string, replacements?: TranslationParams) => {
      const direct = resolveTranslation(language, key)
      const fallback = language === DEFAULT_LANGUAGE ? undefined : resolveTranslation(DEFAULT_LANGUAGE, key)
      const template = direct ?? fallback ?? key

      if (!replacements) {
        return template
      }

      return template.replace(/\{\{(\w+)\}\}/g, (_, token) => {
        const value = replacements[token]
        return value !== undefined ? String(value) : ''
      })
    },
    [language]
  )

  const contextValue = useMemo<LanguageContextValue>(() => ({
    language,
    locale: localeMap[language],
    setLanguage,
    t: translate,
    options: LANGUAGE_OPTIONS,
  }), [language, setLanguage, translate])

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
