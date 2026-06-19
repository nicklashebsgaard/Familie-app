'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { sendLoginCode } from './actions'

export default function MagicLinkForm({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSend() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const result = await sendLoginCode(email.trim(), next)
    if (result.error) {
      setError('Kunne ikke sende kode. Prøv igen.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  async function handleVerifyCode() {
    if (code.trim().length < 6) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    if (err) {
      setError('Forkert kode. Prøv igen eller bed om et nyt link.')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          Tjek din e-mail — vi har sendt dig et link og en 6-cifret kode.
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Indtast 6-cifret kode fra e-mailen
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={handleVerifyCode}
            disabled={code.length < 6 || loading}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificerer…' : 'Log ind'}
          </button>
        </div>

        <button
          onClick={() => { setSent(false); setCode(''); setError(null) }}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          ← Prøv en anden e-mail
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        placeholder="din@email.dk"
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={handleSend}
        disabled={!email.trim() || loading}
        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Sender…' : 'Send login-kode'}
      </button>
    </div>
  )
}
