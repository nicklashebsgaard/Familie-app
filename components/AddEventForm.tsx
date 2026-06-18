'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { FamilyMember, ManagedMember, CalendarEvent } from '@/lib/types'
import Avatar from './Avatar'

interface Props {
  members: FamilyMember[]
  managedMembers: ManagedMember[]
  familyId: string
  currentUserId: string
  defaultDate?: string
  editEvent?: CalendarEvent | null
}

export default function AddEventForm({
  members,
  managedMembers,
  familyId,
  currentUserId,
  defaultDate,
  editEvent,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!editEvent
  const today = defaultDate ?? new Date().toISOString().split('T')[0]

  // Build the full people list for chips
  const allPeople = [
    ...members.map((m) => ({ value: `auth:${m.id}`, name: m.name, color: m.color, avatarUrl: m.avatarUrl })),
    ...managedMembers.map((m) => ({ value: `managed:${m.id}`, name: m.name, color: m.color, avatarUrl: m.avatarUrl })),
  ]

  // Initial participants from editEvent or default to current user
  const initialParticipants = (() => {
    if (!editEvent) return [`auth:${currentUserId}`]
    if (editEvent.participants?.length) {
      return editEvent.participants.map((p) =>
        'familyId' in p ? `managed:${p.id}` : `auth:${p.id}`
      )
    }
    if (editEvent.managedMemberId) return [`managed:${editEvent.managedMemberId}`]
    return [`auth:${editEvent.userId}`]
  })()

  const [participants, setParticipants] = useState<string[]>(initialParticipants)

  function toggle(value: string) {
    setParticipants((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function selectAll() {
    setParticipants(allPeople.map((p) => p.value))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (participants.length === 0) {
      setError('Vælg mindst én person')
      return
    }
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

    // Derive user_id and managed_member_id from participants for backward compat
    const firstAuth = participants.find((p) => p.startsWith('auth:'))
    const firstManaged = participants.find((p) => p.startsWith('managed:'))
    const userId = firstAuth ? firstAuth.split(':')[1] : currentUserId
    const managedMemberId = firstManaged ? firstManaged.split(':')[1] : null

    const body = {
      ...(isEdit ? { id: editEvent!.id } : {}),
      family_id: familyId,
      user_id: userId,
      managed_member_id: managedMemberId,
      participants,
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
      method: isEdit ? 'PATCH' : 'POST',
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

  const defaultStartDate = editEvent ? format(editEvent.startAt, 'yyyy-MM-dd') : today
  const defaultStartTime = editEvent && !editEvent.allDay ? format(editEvent.startAt, 'HH:mm') : '08:00'
  const defaultEndTime = editEvent && !editEvent.allDay ? format(editEvent.endAt, 'HH:mm') : '09:00'

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
          defaultValue={editEvent?.title}
          placeholder="fx Fodboldtræning"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Participants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            For hvem? <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-indigo-600 hover:underline"
          >
            Vælg alle
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {allPeople.map((p) => {
            const active = participants.includes(p.value)
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => toggle(p.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 text-sm font-medium transition-all ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                }`}
                style={active ? { backgroundColor: p.color } : {}}
              >
                <Avatar name={p.name} color={p.color} avatarUrl={p.avatarUrl} size={18} />
                {p.name}
              </button>
            )
          })}
        </div>
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
          defaultValue={defaultStartDate}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* All day */}
      <div className="flex items-center gap-2">
        <input
          id="all_day"
          name="all_day"
          type="checkbox"
          defaultChecked={editEvent?.allDay}
          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        />
        <label htmlFor="all_day" className="text-sm font-medium text-gray-700">
          Hele dagen
        </label>
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
          <input
            name="start_time"
            type="time"
            defaultValue={defaultStartTime}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slut</label>
          <input
            name="end_time"
            type="time"
            defaultValue={defaultEndTime}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sted</label>
        <input
          name="location"
          type="text"
          defaultValue={editEvent?.location}
          placeholder="fx Hallen, Skole..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Transport */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kørsel / transport</label>
        <input
          name="transport"
          type="text"
          defaultValue={editEvent?.transport}
          placeholder="fx Hentes kl. 16:00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bemærkninger</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={editEvent?.description}
          placeholder="Valgfri beskrivelse..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || participants.length === 0}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Gemmer...' : isEdit ? 'Opdater begivenhed' : 'Tilføj begivenhed'}
      </button>

      {isEdit && (
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Annullér
        </button>
      )}
    </form>
  )
}
