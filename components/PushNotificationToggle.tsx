'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      })
    }
  }, [])

  async function toggle() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (subscribed) {
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
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
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
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
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
          {subscribed ? 'Tryk for at slå fra' : 'Daglig oversigt kl. 8 + påmindelser 1 time før'}
        </p>
      </div>
      <div className={`ml-auto w-10 h-6 rounded-full transition-colors ${subscribed ? 'bg-indigo-600' : 'bg-gray-300'}`}>
        <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${subscribed ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </button>
  )
}
