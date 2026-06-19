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
  const [allDay, setAllDay] = useState(editEvent?.allDay ?? false)
  const [recurringFreq, setRecurringFreq] = useState<'none' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>(
    (editEvent?.recurring?.freq as 'WEEKLY' | 'MONTHLY' | 'YEARLY') ?? 'none'
  )
  const [recurringUntil, setRecurringUntil] = useState(editEvent?.recurring?.until ?? '')

  const isEdit = !!editEvent
  const isRecurringSeries = isEdit && !!editEvent?.recurringGroupId
  const [editScope, setEditScope] = useState<'single' | 'this_and_following' | 'all'>('single')
  const today = defaultDate ?? new Date().toISOString().split('T')[0]

  const allPeople = [
    ...members.map((m) => ({ value: `auth:${m.id}`, name: m.name, color: m.color, avatarUrl: m.avatarUrl })),
    ...managedMembers.map((m) => ({ value: `managed:${m.id}`, name: m.name, color: m.color, avatarUrl: m.avatarUrl })),
  ]

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
    if (participants.length === 0) { setError('Vælg mindst én person'); return }
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const isAllDay = allDay
    const startDate = form.get('start_date') as string
    const startTime = (form.get('start_time') as string) || '00:00'
    const endTime = (form.get('end_time') as string) || '23:59'

    const startAt = isAllDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString()
    const endAt = isAllDay
      ? new Date(`${startDate}T23:59:59`).toISOString()
      : new Date(`${startDate}T${endTime}:00`).toISOString()

    const firstAuth = participants.find((p) => p.startsWith('auth:'))
    const firstManaged = participants.find((p) => p.startsWith('managed:'))
    const userId = firstAuth ? firstAuth.split(':')[1] : currentUserId
    const managedMemberId = firstManaged ? firstManaged.split(':')[1] : null

    const body = {
      ...(isEdit ? { id: editEvent!.id } : {}),
      ...(isEdit && isRecurringSeries ? { editScope } : {}),
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
      all_day: isAllDay,
      source: 'manual',
      recurring: recurringFreq !== 'none'
        ? { freq: recurringFreq, ...(recurringUntil ? { until: recurringUntil } : {}) }
        : null,
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
    <form onSubmit={handleSubmit} className="space-y-3 pb-6">

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Scope picker — only shown when editing a recurring series */}
      {isRecurringSeries && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-3">
            Rediger gentagende begivenhed
          </p>
          <div className="flex flex-col gap-2">
            {(
              [
                { value: 'single',            label: 'Kun denne',              sub: 'Ændrer kun denne ene begivenhed' },
                { value: 'this_and_following', label: 'Denne og fremtidige',    sub: 'Ændrer fra denne dato og frem' },
                { value: 'all',               label: 'Alle i serien',          sub: 'Ændrer titel, sted og deltagere på alle' },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="editScope"
                  value={opt.value}
                  checked={editScope === opt.value}
                  onChange={() => setEditScope(opt.value)}
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  <span className="text-sm font-semibold text-gray-800 block">{opt.label}</span>
                  <span className="text-xs text-gray-500">{opt.sub}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Titel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
          Titel <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          type="text"
          required
          defaultValue={editEvent?.title}
          placeholder="fx Fodboldtræning"
          className="w-full text-gray-900 text-base placeholder-gray-300 outline-none"
        />
      </div>

      {/* For hvem */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            For hvem <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-indigo-600 font-semibold"
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
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
                  active ? 'text-white' : 'bg-gray-100 text-gray-600'
                }`}
                style={active ? { backgroundColor: p.color } : {}}
              >
                <Avatar name={p.name} color={p.color} avatarUrl={p.avatarUrl} size={20} />
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Hvornår */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">

        {/* Dato */}
        <div className="px-4 py-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
            Dato <span className="text-red-400">*</span>
          </label>
          <input
            name="start_date"
            type="date"
            required
            defaultValue={defaultStartDate}
            className="w-full text-gray-900 text-base outline-none"
          />
        </div>

        {/* Hele dagen toggle */}
        <div
          className="px-4 py-4 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setAllDay((v) => !v)}
        >
          <span className="text-base text-gray-800 font-medium">Hele dagen</span>
          <div className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${allDay ? 'bg-indigo-600' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${allDay ? 'left-6' : 'left-1'}`} />
          </div>
        </div>

        {/* Tidspunkter */}
        {!allDay && (
          <div className="px-4 py-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Start</label>
              <input
                name="start_time"
                type="time"
                defaultValue={defaultStartTime}
                className="w-full text-gray-900 text-base outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Slut</label>
              <input
                name="end_time"
                type="time"
                defaultValue={defaultEndTime}
                className="w-full text-gray-900 text-base outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Gentag */}
      {!isEdit && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">
            Gentager sig
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['none', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((freq) => {
              const labels = { none: 'Aldrig', WEEKLY: 'Ugentlig', MONTHLY: 'Månedlig', YEARLY: 'Hvert år' }
              const active = recurringFreq === freq
              return (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setRecurringFreq(freq)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                    active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {labels[freq]}
                </button>
              )
            })}
          </div>
          {recurringFreq !== 'none' && (
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Gentag til (valgfrit)
              </label>
              <input
                type="date"
                value={recurringUntil}
                onChange={(e) => setRecurringUntil(e.target.value)}
                min={today}
                className="w-full text-gray-900 text-base outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Detaljer */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        <div className="px-4 py-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Sted</label>
          <input
            name="location"
            type="text"
            defaultValue={editEvent?.location}
            placeholder="fx Hallen, Skole..."
            className="w-full text-gray-900 text-base placeholder-gray-300 outline-none"
          />
        </div>
        <div className="px-4 py-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Kørsel / transport</label>
          <input
            name="transport"
            type="text"
            defaultValue={editEvent?.transport}
            placeholder="fx Hentes kl. 16:00"
            className="w-full text-gray-900 text-base placeholder-gray-300 outline-none"
          />
        </div>
        <div className="px-4 py-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Bemærkninger</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={editEvent?.description}
            placeholder="Valgfri beskrivelse..."
            className="w-full text-gray-900 text-base placeholder-gray-300 outline-none resize-none"
          />
        </div>
      </div>

      {/* Knapper */}
      <button
        type="submit"
        disabled={loading || participants.length === 0}
        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
      >
        {loading ? 'Gemmer...' : isEdit ? 'Opdater begivenhed' : 'Tilføj begivenhed'}
      </button>

      {isEdit && (
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full py-4 border border-gray-200 text-gray-600 rounded-2xl text-base font-medium hover:bg-gray-50 transition-colors"
        >
          Annullér
        </button>
      )}
    </form>
  )
}
