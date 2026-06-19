'use client'

import { useState } from 'react'
import { sendLoginCode } from './actions'

export default function MagicLinkForm({ next }: { next: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const result = await sendLoginCode(email.trim(), next)
    if (result.error) {
      setError('Kunne ikke sende e-mail. Prøv igen.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm space-y-2">
          <p className="font-semibold">Tjek din e-mail!</p>
          <p>Vi har sendt et login-link til <span className="font-mono">{email}</span>.</p>
          <p className="text-green-700">Vigtigt: Åbn linket i <strong>samme browser</strong> som du bruger nu — ikke inde fra Gmail-appen.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={() => { setSent(false); setError(null) }}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
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
        {loading ? 'Sender…' : 'Send login-link'}
      </button>
    </div>
  )
}
