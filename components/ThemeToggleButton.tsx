'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggleButton() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  function toggle() {
    const goingDark = !document.documentElement.classList.contains('dark')
    if (goingDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
    setIsDark(goingDark)
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDark ? 'Skift til lys tilstand' : 'Skift til mørk tilstand'}
    >
      {isDark
        ? <Sun size={18} className="text-gray-400" />
        : <Moon size={18} className="text-gray-500 dark:text-gray-400" />
      }
    </button>
  )
}
