'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const COLORS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Grøn', value: '#22c55e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Rød', value: '#ef4444' },
  { label: 'Gul', value: '#eab308' },
  { label: 'Lilla', value: '#a855f7' },
]

interface Props {
  token: string
  tokenId: string
  familyId: string
  familyName: string
  defaultName: string
}

export default function JoinForm({ tokenId, familyId, familyName, defaultName }: Props) {
  const [name, setName] = useState(defaultName)
  const [color, setColor] = useState('#ec4899')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleJoin() {
    if (!name.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Upsert user profile with name, color and family
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      name: name.trim(),
      color,
      family_id: familyId,
      role: 'member',
    }, { onConflict: 'id' })

    // Mark token as used
    await supabase
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenId)

    router.push('/')
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">👨‍👩‍👧‍👦</div>
        <h1 className="text-xl font-bold text-gray-900">Bliv en del af {familyName}</h1>
        <p className="text-gray-500 text-sm mt-1">Vælg dit navn og din kalenderfarve</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Dit navn</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="fx Camilla"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Din kalenderfarve</label>
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`h-10 rounded-xl transition-all ${
                  color === c.value ? 'ring-2 ring-offset-2 ring-gray-800 scale-95' : 'hover:scale-95'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div>
            <p className="text-sm font-medium text-gray-900">{name || '…'}</p>
            <p className="text-xs text-gray-500">{familyName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleJoin}
          disabled={!name.trim() || loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Tilmelder…' : 'Acceptér invitation'}
        </button>
      </div>
    </div>
  )
}
