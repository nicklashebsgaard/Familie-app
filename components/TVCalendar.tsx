'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format, isSameDay, parseISO, startOfWeek, endOfWeek,
  getISOWeek, addWeeks,
} from 'date-fns'
import { da } from 'date-fns/locale'
import { X, Trash2, Plus, Clock, MapPin } from 'lucide-react'
import Avatar from './Avatar'

interface Member {
  id: string
  name: string
  color: string
  avatar_url?: string | null
}

interface RawEvent {
  id: string
  family_id: string
  user_id: string
  managed_member_id?: string | null
  title: string
  description?: string | null
  location?: string | null
  start_at: string
  end_at: string
  all_day: boolean
  participants?: string[] | null
}

interface TVEvent extends RawEvent {
  color: string
  participantIds: string[]
  participantNames: string[]
}

interface Props {
  familyId: string
  familyName: string
  currentUserId: string
  isAdmin: boolean
  initialEvents: RawEvent[]
  members: Member[]
  managedMembers: Member[]
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

function buildWeek(anchor: Date): Date[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function TVCalendar({
  familyId, familyName, currentUserId, isAdmin,
  initialEvents, members, managedMembers,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [events, setEvents] = useState<RawEvent[]>(initialEvents)
  const [weather, setWeather] = useState<Record<string, { tempMax: number; rain: number; code: number }>>({})
  const [filteredPersonId, setFilteredPersonId] = useState<string | null>(null)

  // Add event sheet
  const [addSheet, setAddSheet] = useState<Date | null>(null)
  const [addVisible, setAddVisible] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addAllDay, setAddAllDay] = useState(false)
  const [addStart, setAddStart] = useState('08:00')
  const [addEnd, setAddEnd] = useState('09:00')
  const [addParticipants, setAddParticipants] = useState<string[]>([])
  const [addLoading, setAddLoading] = useState(false)

  // Detail sheet
  const [detailEvent, setDetailEvent] = useState<TVEvent | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const allPeople: Array<Member & { pid: string }> = [
    ...members.map((m) => ({ ...m, pid: `auth:${m.id}` })),
    ...managedMembers.map((m) => ({ ...m, pid: `managed:${m.id}` })),
  ]
  const membersById = new Map([...members, ...managedMembers].map((m) => [m.id, m]))

  function resolveEvent(raw: RawEvent): TVEvent {
    const pids = raw.participants ?? []
    const resolved = pids.map((pid) => {
      const [type, id] = pid.split(':')
      return type === 'auth' ? membersById.get(id) : membersById.get(id)
    }).filter(Boolean) as Member[]

    const primary = resolved[0]
      ?? (raw.managed_member_id ? membersById.get(raw.managed_member_id) : null)
      ?? membersById.get(raw.user_id)

    const participantIds = pids.map((pid) => pid.split(':')[1])

    return {
      ...raw,
      color: primary?.color ?? '#6366f1',
      participantIds,
      participantNames: resolved.length > 0 ? resolved.map((m) => m.name) : (primary ? [primary.name] : []),
    }
  }

  function isForPerson(event: RawEvent, personId: string): boolean {
    const pids = event.participants ?? []
    if (pids.length > 0) return pids.some((p) => p.split(':')[1] === personId)
    return event.user_id === personId || event.managed_member_id === personId
  }

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch events when week changes
  useEffect(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    fetch(`/api/events?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`)
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setEvents(rows) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getISOWeek(now)])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const channel = supabase
      .channel('tv-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as RawEvent
            const d = parseISO(row.start_at)
            if (d >= weekStart && d <= weekEnd) setEvents((p) => [...p, row])
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawEvent
            setEvents((p) => p.map((e) => (e.id === row.id ? row : e)))
          }
          if (payload.eventType === 'DELETE') {
            setEvents((p) => p.filter((e) => e.id !== (payload.old as RawEvent).id))
          }
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId])

  // Weather
  useEffect(() => {
    const coords = (() => {
      try { const c = localStorage.getItem('famille-coords'); return c ? JSON.parse(c) : { lat: 55.67, lon: 12.57 } }
      catch { return { lat: 55.67, lon: 12.57 } }
    })()
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto&past_days=0&forecast_days=7`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.daily) return
        const map: Record<string, { tempMax: number; rain: number; code: number }> = {}
        ;(data.daily.time as string[]).forEach((date: string, i: number) => {
          map[date] = { tempMax: Math.round(data.daily.temperature_2m_max[i]), rain: data.daily.precipitation_sum[i] ?? 0, code: data.daily.weathercode?.[i] ?? 0 }
        })
        setWeather(map)
      }).catch(() => {})
  }, [])

  function openAddSheet(day: Date) {
    setAddSheet(day)
    setAddTitle('')
    setAddAllDay(false)
    setAddStart('08:00')
    setAddEnd('09:00')
    setAddParticipants([`auth:${currentUserId}`])
    requestAnimationFrame(() => {
      setAddVisible(true)
      setTimeout(() => titleInputRef.current?.focus(), 350)
    })
  }

  function closeAddSheet() {
    setAddVisible(false)
    setTimeout(() => setAddSheet(null), 300)
  }

  function openDetailSheet(event: TVEvent) {
    setDetailEvent(event)
    setDeleteConfirm(false)
    requestAnimationFrame(() => setDetailVisible(true))
  }

  function closeDetailSheet() {
    setDetailVisible(false)
    setTimeout(() => { setDetailEvent(null); setDeleteConfirm(false) }, 300)
  }

  function toggleParticipant(pid: string) {
    setAddParticipants((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    )
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addSheet || !addTitle.trim() || addParticipants.length === 0) return
    setAddLoading(true)

    const dateStr = format(addSheet, 'yyyy-MM-dd')
    const startAt = addAllDay
      ? new Date(`${dateStr}T00:00:00`).toISOString()
      : new Date(`${dateStr}T${addStart}:00`).toISOString()
    const endAt = addAllDay
      ? new Date(`${dateStr}T23:59:59`).toISOString()
      : new Date(`${dateStr}T${addEnd}:00`).toISOString()

    const firstAuth = addParticipants.find((p) => p.startsWith('auth:'))
    const firstManaged = addParticipants.find((p) => p.startsWith('managed:'))
    const userId = firstAuth ? firstAuth.split(':')[1] : currentUserId
    const managedMemberId = firstManaged ? firstManaged.split(':')[1] : null

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        family_id: familyId,
        user_id: userId,
        managed_member_id: managedMemberId,
        participants: addParticipants,
        title: addTitle.trim(),
        start_at: startAt,
        end_at: endAt,
        all_day: addAllDay,
        source: 'manual',
      }),
    })
    setAddLoading(false)
    closeAddSheet()
  }

  async function handleDelete() {
    if (!detailEvent) return
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleteLoading(true)
    await fetch(`/api/events?id=${detailEvent.id}`, { method: 'DELETE' })
    setEvents((p) => p.filter((e) => e.id !== detailEvent.id))
    setDeleteLoading(false)
    closeDetailSheet()
  }

  const isLateWeek = now.getDay() === 0 && now.getHours() >= 18
  const displayDays = isLateWeek ? buildWeek(addWeeks(now, 1)) : buildWeek(now)
  const weekNum = getISOWeek(now)
  const resolvedEvents = events.map(resolveEvent)
  const displayedEvents = filteredPersonId
    ? resolvedEvents.filter((e) => isForPerson(e, filteredPersonId))
    : resolvedEvents

  const canDeleteEvent = (event: TVEvent) =>
    isAdmin || event.user_id === currentUserId

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-indigo-600 tracking-tight">Familiekalender</span>
          <span className="text-gray-300 text-2xl">·</span>
          <span className="text-2xl font-bold text-gray-800">{familyName}</span>
          <span className="text-sm font-semibold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">
            Uge {weekNum}
          </span>
          {filteredPersonId && (
            <button
              onClick={() => setFilteredPersonId(null)}
              className="text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors"
            >
              <X size={13} /> Alle
            </button>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900 tabular-nums">{format(now, 'HH:mm:ss')}</div>
          <div className="text-sm font-semibold text-gray-500 capitalize mt-0.5">
            {format(now, 'EEEE d. MMMM yyyy', { locale: da })}
          </div>
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 min-h-0">
        {displayDays.map((day) => {
          const isToday = isSameDay(day, now)
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayEvents = displayedEvents
            .filter((e) => isSameDay(parseISO(e.start_at), day))
            .sort((a, b) => {
              if (a.all_day && !b.all_day) return -1
              if (!a.all_day && b.all_day) return 1
              return a.start_at.localeCompare(b.start_at)
            })
          const w = weather[dayKey]

          return (
            <div
              key={dayKey}
              className={`flex flex-col overflow-hidden cursor-pointer ${isToday ? 'bg-indigo-50' : 'hover:bg-gray-50'} transition-colors`}
              onClick={() => openAddSheet(day)}
            >
              {/* Day header */}
              <div className={`px-3 pt-3 pb-2 flex-shrink-0 border-b ${isToday ? 'border-indigo-200' : 'border-gray-100'}`}>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                  {format(day, 'EEE', { locale: da })}
                </div>
                <div className={`text-3xl font-black leading-none ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </div>
                <div className="text-xs text-gray-400 font-medium mt-0.5 capitalize">
                  {format(day, 'MMM', { locale: da })}
                </div>
                {w && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-base leading-none">{weatherEmoji(w.code)}</span>
                    <span className="text-sm font-bold text-gray-600">{w.tempMax}°</span>
                    {w.rain > 0.5 && <span className="text-xs text-blue-500 font-semibold">{w.rain.toFixed(0)}mm</span>}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-300">
                  <Plus size={11} />
                  <span>Tilføj</span>
                </div>
              </div>

              {/* Events */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); openDetailSheet(event) }}
                    className="w-full rounded-lg p-2 text-white text-left leading-snug active:opacity-80 transition-opacity"
                    style={{ backgroundColor: event.color }}
                  >
                    <div className="font-bold text-sm truncate">{event.title}</div>
                    <div className="opacity-80 mt-0.5 text-xs">
                      {event.all_day ? 'Hele dagen' : format(parseISO(event.start_at), 'HH:mm')}
                    </div>
                    {event.participantNames.length > 0 && (
                      <div className="opacity-75 truncate mt-0.5 text-xs">
                        {event.participantNames.join(', ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer — person filter */}
      <div className="flex items-center gap-4 px-8 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
        {allPeople.map((m) => {
          const isSelected = filteredPersonId === m.id
          const isDimmed = !!filteredPersonId && !isSelected
          return (
            <button
              key={m.id}
              onClick={() => setFilteredPersonId(isSelected ? null : m.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all active:scale-95 ${
                isSelected ? 'border-current shadow-sm' : isDimmed ? 'opacity-30 border-transparent' : 'border-transparent hover:bg-gray-100'
              }`}
              style={{ color: isSelected ? m.color : undefined }}
            >
              <Avatar name={m.name} color={m.color} avatarUrl={m.avatar_url} size={28} />
              <span className={`text-sm font-semibold ${isSelected ? '' : 'text-gray-600'}`}>{m.name}</span>
            </button>
          )
        })}
        <div className="ml-auto text-xs text-gray-300 font-medium">famille-app-omega.vercel.app/tv</div>
      </div>

      {/* Add event sheet */}
      {addSheet && (
        <>
          <div
            className={`fixed inset-0 z-[60] bg-black transition-opacity duration-300 ${addVisible ? 'opacity-50' : 'opacity-0'}`}
            onClick={closeAddSheet}
          />
          <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={closeAddSheet}>
            <form
              onSubmit={handleAddSubmit}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${addVisible ? 'translate-y-0' : 'translate-y-full'}`}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-6 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest capitalize">
                      {format(addSheet, 'EEEE', { locale: da })}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                      {format(addSheet, 'd. MMMM', { locale: da })}
                    </h3>
                  </div>
                  <button type="button" onClick={closeAddSheet} className="p-2 rounded-full hover:bg-gray-100">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                {/* Title */}
                <input
                  ref={titleInputRef}
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="Hvad sker der?"
                  className="w-full text-2xl font-bold text-gray-900 placeholder-gray-300 outline-none border-b-2 border-gray-100 focus:border-indigo-400 pb-2 mb-5 transition-colors"
                  required
                />

                {/* All day toggle */}
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => setAddAllDay((v) => !v)}
                >
                  <span className="text-base font-semibold text-gray-700">Hele dagen</span>
                  <div className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${addAllDay ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${addAllDay ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {/* Times */}
                {!addAllDay && (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Start</label>
                      <input type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)}
                        className="w-full text-xl font-bold text-gray-900 outline-none border-b-2 border-gray-100 focus:border-indigo-400 pb-1 transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Slut</label>
                      <input type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)}
                        className="w-full text-xl font-bold text-gray-900 outline-none border-b-2 border-gray-100 focus:border-indigo-400 pb-1 transition-colors" />
                    </div>
                  </div>
                )}

                {/* Participants */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">For hvem</label>
                  <div className="flex flex-wrap gap-2">
                    {allPeople.map((p) => {
                      const active = addParticipants.includes(p.pid)
                      return (
                        <button
                          key={p.pid}
                          type="button"
                          onClick={() => toggleParticipant(p.pid)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 ${active ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                          style={active ? { backgroundColor: p.color } : {}}
                        >
                          <Avatar name={p.name} color={p.color} avatarUrl={p.avatar_url} size={22} />
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={addLoading || !addTitle.trim() || addParticipants.length === 0}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors active:scale-[0.98]"
                >
                  {addLoading ? 'Gemmer...' : 'Tilføj begivenhed'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Event detail sheet */}
      {detailEvent && (
        <>
          <div
            className={`fixed inset-0 z-[60] bg-black transition-opacity duration-300 ${detailVisible ? 'opacity-50' : 'opacity-0'}`}
            onClick={closeDetailSheet}
          />
          <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={closeDetailSheet}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${detailVisible ? 'translate-y-0' : 'translate-y-full'}`}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Colored header */}
              <div className="px-6 pt-4 pb-5" style={{ backgroundColor: `${detailEvent.color}18` }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="text-2xl font-black text-gray-900 leading-snug">{detailEvent.title}</h3>
                    <div className="flex items-center gap-2 mt-2 text-gray-500">
                      <Clock size={15} />
                      <span className="text-base font-semibold">
                        {format(parseISO(detailEvent.start_at), 'EEEE d. MMMM', { locale: da })}
                        {' · '}
                        {detailEvent.all_day ? 'Hele dagen' : `${format(parseISO(detailEvent.start_at), 'HH:mm')} – ${format(parseISO(detailEvent.end_at), 'HH:mm')}`}
                      </span>
                    </div>
                    {detailEvent.location && (
                      <div className="flex items-center gap-2 mt-1 text-gray-500">
                        <MapPin size={15} />
                        <span className="text-base">{detailEvent.location}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={closeDetailSheet} className="p-2 rounded-full hover:bg-black/10 transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                {/* Participants */}
                {detailEvent.participantNames.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex -space-x-2">
                      {detailEvent.participantIds.slice(0, 5).map((id) => {
                        const m = membersById.get(id)
                        return m ? <Avatar key={id} name={m.name} color={m.color} avatarUrl={m.avatar_url} size={32} /> : null
                      })}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {detailEvent.participantNames.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-5 flex gap-3">
                <a
                  href={`/tilfoej?edit=${detailEvent.id}`}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Rediger
                </a>
                {canDeleteEvent(detailEvent) && (
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all disabled:opacity-50 ${
                      deleteConfirm ? 'bg-red-500 text-white' : 'border-2 border-gray-200 text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 size={17} />
                    {deleteConfirm ? 'Bekræft sletning' : 'Slet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
