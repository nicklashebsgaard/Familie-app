'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}

async function getActiveRegistration(): Promise<ServiceWorkerRegistration> {
  // Use a simple push-only SW with no workbox dependencies — committed to git
  const reg = await navigator.serviceWorker.register('/push-sw.js')
  if (reg.active) return reg

  // SW is installing/waiting — wait for activation (skipWaiting is set so it activates fast)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Service worker tog for lang tid. Genindlæs appen og prøv igen.')),
      15000
    )

    function checkWorker(worker: ServiceWorker) {
      if (worker.state === 'activated') {
        clearTimeout(timeout)
        resolve(reg)
      } else if (worker.state === 'redundant') {
        clearTimeout(timeout)
        reject(new Error('Service worker fejlede. Genindlæs appen.'))
      }
    }

    const worker = reg.installing ?? reg.waiting
    if (worker) {
      checkWorker(worker)
      worker.addEventListener('statechange', () => checkWorker(worker))
    } else {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing!
        w.addEventListener('statechange', () => checkWorker(w))
      })
    }
  })
}

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    setSupported(true)

    // Register SW + check existing subscription on mount
    navigator.serviceWorker.register('/push-sw.js').then((reg) => {
      reg.pushManager?.getSubscription().then((sub) => setSubscribed(!!sub))
    }).catch(() => {})
  }, [])

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.register('/push-sw.js')
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
        const permission = await Notification.requestPermission()
        if (permission === 'denied') {
          setError('Tillad notifikationer under Indstillinger → Familie Kalender → Notifikationer.')
          return
        }
        if (permission !== 'granted') return

        const reg = await getActiveRegistration()

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })

        const key = sub.getKey('p256dh')
        const auth = sub.getKey('auth')
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: key ? btoa(String.fromCharCode(...Array.from(new Uint8Array(key)))) : '',
            auth: auth ? btoa(String.fromCharCode(...Array.from(new Uint8Array(auth)))) : '',
          }),
        })
        setSubscribed(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.')
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

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
            {loading ? 'Vent…' : subscribed ? 'Notifikationer aktiveret' : 'Aktiver notifikationer'}
          </p>
          <p className="text-xs text-gray-500">
            {subscribed ? 'Tryk for at slå fra' : 'Daglig oversigt kl. 8 + påmindelser kl. 7'}
          </p>
        </div>
        <div className={`ml-auto w-10 h-6 rounded-full transition-colors flex-shrink-0 ${subscribed ? 'bg-indigo-600' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${subscribed ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </button>
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
    </div>
  )
}
