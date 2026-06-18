'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [showIos, setShowIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Android/Chrome: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari: show manual instruction
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (isIos && !isStandalone && !dismissed) {
      setShowIos(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setShowIos(false)
    setDeferredPrompt(null)
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') setDeferredPrompt(null)
  }

  // Android install button
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-lg z-50 flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm">Installér appen</p>
          <p className="text-xs text-indigo-200 mt-0.5">
            Tilføj Familie Kalender til din hjemmeskærm
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={installAndroid}
            className="px-3 py-1.5 bg-white text-indigo-700 text-xs font-medium rounded-lg"
          >
            Installér
          </button>
          <button onClick={dismiss} className="p-1">
            <X size={16} className="text-indigo-200" />
          </button>
        </div>
      </div>
    )
  }

  // iOS manual instruction
  if (showIos) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-lg z-50">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm">Tilføj til hjemmeskærm</p>
            <p className="text-xs text-indigo-200 mt-1">
              Tryk på Del-knappen{' '}
              <span className="inline-block">
                (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="inline w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                )
              </span>{' '}
              og vælg &quot;Føj til hjemmeskærm&quot;
            </p>
          </div>
          <button onClick={dismiss} className="p-1 flex-shrink-0">
            <X size={16} className="text-indigo-200" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
