'use client'

import { useEffect, useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'auto'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // Auto: follow OS
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
  try {
    if (theme === 'auto') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', theme)
    }
  } catch {}
}

export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('auto')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function select(t: Theme) {
    setTheme(t)
    applyTheme(t)
  }

  const options: { value: Theme; label: string; emoji: string }[] = [
    { value: 'auto', label: 'Auto', emoji: '⚙️' },
    { value: 'light', label: 'Lys', emoji: '☀️' },
    { value: 'dark', label: 'Mørk', emoji: '🌙' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3">
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Udseende</p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all border-2 ${
                active
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className="text-lg leading-none">{opt.emoji}</span>
              {opt.label}
            </button>
          )
        })}
      </div>
      {theme === 'auto' && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Følger telefonens indstilling</p>
      )}
    </div>
  )
}
