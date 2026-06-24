'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format, isSameDay, parseISO, startOfWeek, endOfWeek,
  getISOWeek, isSameWeek, addWeeks,
} from 'date-fns'
import { da } from 'date-fns/locale'
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
  start_at: string
  end_at: string
  all_day: boolean
  participants?: string[] | null
}

interface TVEvent extends RawEvent {
  color: string
  participantNames: string[]
}

interface Props {
  familyId: string
  familyName: string
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

export default function TVCalendar({ familyId, familyName, initialEvents, members, managedMembers }: Props) {
  const [now, setNow] = useState(() => new Date())
  const [events, setEvents] = useState<RawEvent[]>(initialEvents)
  const [weather, setWeather] = useState<Record<string, { tempMax: number; rain: number; code: number }>>({})

  const membersById = new Map([...members, ...managedMembers].map((m) => [m.id, m]))

  function resolveEvent(raw: RawEvent): TVEvent {
    const pids = raw.participants ?? []
    const resolved = pids
      .map((pid) => {
        const [type, id] = pid.split(':')
        return type === 'auth' ? membersById.get(id) : membersById.get(id)
      })
      .filter(Boolean) as Member[]

    const primary = resolved[0]
      ?? (raw.managed_member_id ? membersById.get(raw.managed_member_id) : null)
      ?? membersById.get(raw.user_id)

    return {
      ...raw,
      color: primary?.color ?? '#6366f1',
      participantNames: resolved.length > 0 ? resolved.map((m) => m.name) : (primary ? [primary.name] : []),
    }
  }

  // Live clock — updates every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch events when the week changes (midnight on Monday)
  useEffect(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

    fetch(`/api/events?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`)
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setEvents(rows) })
      .catch(() => {})
  // Re-fetch when week number changes (i.e. on Monday)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getISOWeek(now)])

  // Realtime subscription
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
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId])

  // Weather
  useEffect(() => {
    const coords = (() => {
      try {
        const c = localStorage.getItem('famille-coords')
        return c ? JSON.parse(c) : { lat: 55.67, lon: 12.57 }
      } catch { return { lat: 55.67, lon: 12.57 } }
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
          map[date] = {
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            rain: data.daily.precipitation_sum[i] ?? 0,
            code: data.daily.weathercode?.[i] ?? 0,
          }
        })
        setWeather(map)
      })
      .catch(() => {})
  }, [])

  const weekDays = buildWeek(now)
  const resolvedEvents = events.map(resolveEvent)

  const timeStr = format(now, 'HH:mm:ss')
  const dateStr = format(now, 'EEEE d. MMMM yyyy', { locale: da })
  const weekNum = getISOWeek(now)

  // Check if we should show next week (Sunday evening after 18:00)
  const isLateWeek = now.getDay() === 0 && now.getHours() >= 18
  const displayDays = isLateWeek ? buildWeek(addWeeks(now, 1)) : weekDays

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
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900 tabular-nums">{timeStr}</div>
          <div className="text-sm font-semibold text-gray-500 capitalize mt-0.5">{dateStr}</div>
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 min-h-0">
        {displayDays.map((day) => {
          const isToday = isSameDay(day, now)
          const isThisWeek = isSameWeek(day, now, { weekStartsOn: 1 })
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayEvents = resolvedEvents
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
              className={`flex flex-col overflow-hidden ${isToday ? 'bg-indigo-50' : ''} ${!isThisWeek ? 'opacity-50' : ''}`}
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
                    {w.rain > 0.5 && (
                      <span className="text-xs text-blue-500 font-semibold">{w.rain.toFixed(0)}mm</span>
                    )}
                  </div>
                )}
              </div>

              {/* Events */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg p-2 text-white text-xs leading-snug"
                    style={{ backgroundColor: event.color }}
                  >
                    <div className="font-bold text-sm truncate">{event.title}</div>
                    <div className="opacity-80 mt-0.5">
                      {event.all_day ? 'Hele dagen' : format(parseISO(event.start_at), 'HH:mm')}
                    </div>
                    {event.participantNames.length > 0 && (
                      <div className="opacity-75 truncate mt-0.5">
                        {event.participantNames.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer — member legend */}
      <div className="flex items-center gap-4 px-8 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
        {[...members, ...managedMembers].map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar name={m.name} color={m.color} avatarUrl={m.avatar_url} size={24} />
            <span className="text-sm font-semibold text-gray-600">{m.name}</span>
          </div>
        ))}
        <div className="ml-auto text-xs text-gray-300 font-medium">
          familie-app.vercel.app/tv
        </div>
      </div>
    </div>
  )
}
