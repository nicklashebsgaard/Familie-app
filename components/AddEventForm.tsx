'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyMember } from '@/lib/types'

interface Props {
  members: FamilyMember[]
  familyId: string
  currentUserId: string
  isAdmin: boolean
}

export default function AddEventForm({ members, familyId, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const allDay = form.get('all_day') === 'on'

    const startDate = form.get('start_date') as string
    const startTime = form.get('start_time') as string
    const endTime = form.get('end_time') as string

    const startAt = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString()
    const endAt = allDay
      ? new Date(`${startDate}T23:59:59`).toISOString()
      : new Date(`${startDate}T${endTime}:00`).toISOString()

    const body = {
      family_id: familyId,
      user_id: form.get('user_id') as string,
      title: form.get('title') as string,
      description: (form.get('description') as string) || null,
      location: (form.get('location') as string) || null,
      transport: (form.get('transport') as string) || null,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      source: 'manual',
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Noget gik galt')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Titel <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="fx Fodboldtræning"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Person */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Person <span className="text-red-500">*</span>
        </label>
        <select
          name="user_id"
          defaultValue={currentUserId}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Dato <span className="text-red-500">*</span>
        </label>
        <input
          name="start_date"
          type="date"
          required
          defaultValue={today}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* All day toggle */}
      <div className="flex items-center gap-2">
        <input
          id="all_day"
          name="all_day"
          type="checkbox"
          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        />
        <label htmlFor="all_day" className="text-sm font-medium text-gray-700">
          Hele dagen
        </label>
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start
          </label>
          <input
            name="start_time"
            type="time"
            defaultValue="08:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slut
          </label>
          <input
            name="end_time"
            type="time"
            defaultValue="09:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sted
        </label>
        <input
          name="location"
          type="text"
          placeholder="fx Hallen, Skole..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Transport */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kørsel / transport
        </label>
        <input
          name="transport"
          type="text"
          placeholder="fx Hentes kl. 16:00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bemærkninger
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="Valgfri beskrivelse..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Gemmer...' : 'Tilføj begivenhed'}
      </button>
    </form>
  )
}
