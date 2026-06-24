'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, RefreshCw } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}

type State = 'loading' | 'unsupported' | 'needs-reload' | 'idle' | 'subscribed'

export default function PushNotificationToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }

    navigator.serviceWorker.getRegistration('/').then((reg) => {
      // SW not controlling the page yet — need a reload first
      if (!reg?.active || !navigator.serviceWorker.controller) {
        setState('needs-reload')
        return
      }
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'idle')
      })
    })
  }, [])

  async function subscribe() {
    setBusy(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        setError('Gå til Indstillinger → Familie Kalender → Notifikationer og tillad dem.')
        return
      }
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.getRegistration('/')
      if (!reg?.active) {
        setState('needs-reload')
        return
      }

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
      setState('subscribed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.')
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('idle')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null

  if (state === 'unsupported') return (
    <div className="px-4 py-3 rounded-xl bg-gray-50 text-sm text-gray-500">
      Notifikationer understøttes ikke. Installér appen på hjemmeskærmen og prøv igen.
    </div>
  )

  if (state === 'needs-reload') return (
    <div className="space-y-2">
      <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <p className="font-semibold mb-1">Genindlæsning nødvendig</p>
        <p className="text-xs">Luk appen helt og åbn den igen for at aktivere notifikationer.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 transition-colors"
      >
        <RefreshCw size={16} />
        Genindlæs nu
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      <button
        onClick={state === 'subscribed' ? unsubscribe : subscribe}
        disabled={busy}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {state === 'subscribed'
          ? <Bell size={20} className="text-indigo-600 flex-shrink-0" />
          : <BellOff size={20} className="text-gray-400 flex-shrink-0" />
        }
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">
            {state === 'subscribed' ? 'Notifikationer aktiveret' : 'Aktiver notifikationer'}
          </p>
          <p className="text-xs text-gray-500">
            {state === 'subscribed' ? 'Tryk for at slå fra' : 'Daglig oversigt kl. 8 + påmindelser kl. 7'}
          </p>
        </div>
        <div className={`ml-auto w-10 h-6 rounded-full transition-colors flex-shrink-0 ${state === 'subscribed' ? 'bg-indigo-600' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${state === 'subscribed' ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </button>
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
    </div>
  )
}
