'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { FamilyMember, ManagedMember, CalendarEvent } from '@/lib/types'

interface Props {
  members: FamilyMember[]
  managedMembers: ManagedMember[]
  familyId: string
  currentUserId: string
  editEvent?: CalendarEvent | null
}

export default function AddEventForm({
  members,
  managedMembers,
  familyId,
  currentUserId,
  editEvent,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!editEvent
  const today = new Date().toISOString().split('T')[0]

  // Derive default person value from editEvent
  const defaultPerson = (() => {
    if (!editEvent) return `auth:${currentUserId}`
    if (editEvent.managedMemberId) return `managed:${editEvent.managedMemberId}`
    return `auth:${editEvent.userId}`
  })()

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

    const personValue = form.get('person') as string
    const [personType, personId] = personValue.split(':')

    const body = {
      ...(isEdit ? { id: editEvent!.id } : {}),
      family_id: familyId,
      user_id: personType === 'auth' ? personId : currentUserId,
      managed_member_id: personType === 'managed' ? personId : null,
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

  const defaultDate = editEvent
    ? format(editEvent.startAt, 'yyyy-MM-dd')
    : today
  const defaultStartTime = editEvent && !editEvent.allDay
    ? format(editEvent.startAt, 'HH:mm')
    : '08:00'
  const defaultEndTime = editEvent && !editEvent.allDay
    ? format(editEvent.endAt, 'HH:mm')
    : '09:00'

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

      {/* Person */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Person <span className="text-red-500">*</span>
        </label>
        <select
          name="person"
          defaultValue={defaultPerson}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {members.map((m) => (
            <option key={m.id} value={`auth:${m.id}`}>{m.name}</option>
          ))}
          {managedMembers.length > 0 && (
            <optgroup label="Børn">
              {managedMembers.map((m) => (
                <option key={m.id} value={`managed:${m.id}`}>{m.name}</option>
              ))}
            </optgroup>
          )}
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
          defaultValue={defaultDate}
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
        disabled={loading}
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
