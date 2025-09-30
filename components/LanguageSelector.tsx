'use client'

import { useEffect, useRef, useState } from 'react'
import { LANGUAGE_OPTIONS } from '@/lib/i18n'
import { useTranslation } from './LanguageProvider'

interface LanguageSelectorProps {
  align?: 'left' | 'right'
  compact?: boolean
  className?: string
}

export default function LanguageSelector({ align = 'right', compact = false, className }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      window.addEventListener('mousedown', handleClick)
    }

    return () => {
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const current = LANGUAGE_OPTIONS.find((option) => option.code === language)

  const buttonClasses = compact
    ? 'inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 h-12 text-sm font-medium text-gray-600 hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500'
    : 'inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 h-12 text-sm font-medium text-gray-600 hover:border-primary-200 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClasses}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden className="text-lg">🌐</span>
        {!compact && <span className="hidden sm:inline">{t('language.select')}:</span>}
        <span className="font-semibold text-gray-900">{current?.label ?? language.toUpperCase()}</span>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = option.code === language
            return (
              <button
                key={option.code}
                onClick={() => {
                  setLanguage(option.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-primary-50 font-semibold text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{option.name}</span>
                <span className="text-xs font-semibold text-gray-400">{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
