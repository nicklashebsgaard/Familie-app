'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      })
    }
  }, [])

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
          setSubscribed(false)
        }
      } else {
        // Request permission immediately — iOS requires this directly from user gesture
        const permission = await Notification.requestPermission()
        if (permission === 'denied') {
          setError('Tilladelse afvist — gå til Indstillinger → Familie Kalender → Notifikationer og slå til.')
          return
        }
        if (permission !== 'granted') return

        // Get or register the service worker, then wait for it to be active
        let reg = await navigator.serviceWorker.getRegistration('/')
        if (!reg) reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

        // Wait for the SW to reach active state (iOS requires this before subscribing)
        if (!reg.active) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Service worker aktivering timeout — genindlæs appen')), 15000)
            const sw = reg!.installing ?? reg!.waiting
            if (!sw) { clearTimeout(timeout); resolve(); return }
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') { clearTimeout(timeout); resolve() }
            })
          })
        }

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })

        const key = sub.getKey('p256dh')
        const auth = sub.getKey('auth')
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: key ? btoa(String.fromCharCode(...Array.from(new Uint8Array(key)))) : '',
            auth: auth ? btoa(String.fromCharCode(...Array.from(new Uint8Array(auth)))) : '',
          }),
        })
        if (!res.ok) throw new Error('Kunne ikke gemme — prøv igen')
        setSubscribed(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.')
    } finally {
      setLoading(false)
    }
  }

  // Still loading — don't render yet
  if (supported === null) return null

  // Not supported
  if (!supported) {
    return (
      <div className="px-4 py-3 rounded-xl bg-gray-50 text-sm text-gray-500">
        Notifikationer understøttes ikke i denne browser. Installér appen på hjemmeskærmen og prøv igen.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {subscribed
          ? <Bell size={20} className="text-indigo-600 flex-shrink-0" />
          : <BellOff size={20} className="text-gray-400 flex-shrink-0" />
        }
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">
            {subscribed ? 'Notifikationer aktiveret' : 'Aktiver notifikationer'}
          </p>
          <p className="text-xs text-gray-500">
            {subscribed ? 'Tryk for at slå fra' : 'Daglig oversigt kl. 8 + påmindelser kl. 7'}
          </p>
        </div>
        <div className={`ml-auto w-10 h-6 rounded-full transition-colors flex-shrink-0 ${subscribed ? 'bg-indigo-600' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${subscribed ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </button>
      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}
    </div>
  )
}
