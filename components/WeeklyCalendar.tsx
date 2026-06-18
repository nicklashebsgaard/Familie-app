'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addWeeks, subWeeks, format, isSameDay, parseISO, getISOWeek, startOfWeek, endOfWeek } from 'date-fns'
import { da } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Share2, Loader2, Bell, BellOff } from 'lucide-react'
import type { CalendarEvent, FamilyMember, ManagedMember } from '@/lib/types'
import EventPill from './EventPill'
import EventSheet from './EventSheet'
import Avatar from './Avatar'

interface WeatherData {
  tempMax: number
  rain: number
  wind: number
  code: number
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

interface Props {
  initialEvents: CalendarEvent[]
  members: FamilyMember[]
  managedMembers: ManagedMember[]
  weekDays: Date[]
  familyId: string | null
  currentUserId: string
}

function buildWeekDays(offset: number): Date[] {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const monday = new Date(base)
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const start =
    offset === 0 ? monday : offset > 0 ? addWeeks(monday, offset) : subWeeks(monday, -offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function WeeklyCalendar({
  initialEvents,
  members,
  managedMembers,
  weekDays: initialWeekDays,
  familyId,
  currentUserId,
}: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDays, setWeekDays] = useState(initialWeekDays)
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [filteredPersonId, setFilteredPersonId] = useState<string | null>(null)
  const [weather, setWeather] = useState<Record<string, WeatherData>>({})
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [sharing, setSharing] = useState(false)
  const [notifState, setNotifState] = useState<'unknown' | 'subscribed' | 'denied' | 'unsupported'>('unknown')
  const weekGridRef = useRef<HTMLDivElement>(null)

  const isAdmin = members.find((m) => m.id === currentUserId)?.role === 'admin'
  const membersById = new Map(members.map((m) => [m.id, m]))
  const managedById = new Map(managedMembers.map((m) => [m.id, m]))

  function rowToEvent(row: Record<string, unknown>): CalendarEvent {
    const rawParticipants = (row.participants as string[] | null) ?? []
    const participants = rawParticipants
      .map((pid) => {
        const [type, id] = pid.split(':')
        return type === 'auth' ? membersById.get(id) : managedById.get(id)
      })
      .filter(Boolean) as (FamilyMember | ManagedMember)[]

    return {
      id: row.id as string,
      familyId: row.family_id as string,
      userId: row.user_id as string,
      managedMemberId: row.managed_member_id as string | undefined,
      title: row.title as string,
      description: row.description as string | undefined,
      location: row.location as string | undefined,
      startAt: parseISO(row.start_at as string),
      endAt: parseISO(row.end_at as string),
      allDay: row.all_day as boolean,
      source: row.source as 'manual' | 'aula',
      member: membersById.get(row.user_id as string),
      managedMember: row.managed_member_id
        ? managedById.get(row.managed_member_id as string)
        : undefined,
      participants: participants.length > 0 ? participants : undefined,
    }
  }

  // Re-fetch events whenever week changes
  useEffect(() => {
    const days = buildWeekDays(weekOffset)
    setWeekDays(days)

    if (weekOffset === 0) {
      setEvents(initialEvents)
      return
    }

    if (!familyId) return
    setLoading(true)

    const from = startOfWeek(days[0], { weekStartsOn: 1 }).toISOString()
    const to = endOfWeek(days[6], { weekStartsOn: 1 }).toISOString()

    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((rows: Record<string, unknown>[]) => setEvents(rows.map(rowToEvent)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, familyId])

  // Realtime subscription
  useEffect(() => {
    if (!familyId) return
    const supabase = createClient()
    const channel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Record<string, unknown>
            const newEvent = rowToEvent(row)
            if (weekDays.some((d) => isSameDay(newEvent.startAt, d))) {
              setEvents((prev) => [...prev, newEvent])
            }
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Record<string, unknown>
            setEvents((prev) => prev.map((e) => (e.id === row.id ? rowToEvent(row) : e)))
          }
          if (payload.eventType === 'DELETE') {
            setEvents((prev) =>
              prev.filter((e) => e.id !== (payload.old as Record<string, unknown>).id)
            )
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, members, managedMembers, weekDays])

  // Fetch weather once on mount — covers past 7 + next 14 days
  useEffect(() => {
    function loadWeather(lat: number, lon: number) {
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,precipitation_sum,windspeed_10m_max,weathercode` +
        `&timezone=auto&past_days=7&forecast_days=14`
      )
        .then((r) => r.json())
        .then((data) => {
          if (!data.daily) return
          const map: Record<string, WeatherData> = {}
          ;(data.daily.time as string[]).forEach((date: string, i: number) => {
            map[date] = {
              tempMax: Math.round(data.daily.temperature_2m_max[i]),
              rain: data.daily.precipitation_sum[i] ?? 0,
              wind: Math.round(data.daily.windspeed_10m_max[i] ?? 0),
              code: data.daily.weathercode?.[i] ?? 0,
            }
          })
          setWeather(map)
        })
        .catch(() => {})
    }

    try {
      const cached = localStorage.getItem('famille-coords')
      if (cached) {
        const { lat, lon } = JSON.parse(cached)
        loadWeather(lat, lon)
        return
      }
    } catch {}

    if (!navigator.geolocation) { loadWeather(55.67, 12.57); return }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        try { localStorage.setItem('famille-coords', JSON.stringify(c)) } catch {}
        loadWeather(c.lat, c.lon)
      },
      () => loadWeather(55.67, 12.57),
      { timeout: 5000 }
    )
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return
    const dx = touchStartX - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 50 && dy < 60) {
      setWeekOffset((o) => o + (dx > 0 ? 1 : -1))
    }
    setTouchStartX(null)
    setTouchStartY(null)
  }

  // Check push notification status on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setNotifState('denied'); return }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setNotifState(sub ? 'subscribed' : 'unknown')
      })
    ).catch(() => setNotifState('unsupported'))
  }, [])

  async function handleNotification() {
    if (notifState === 'subscribed') {
      // Unsubscribe
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', { method: 'DELETE' })
      }
      setNotifState('unknown')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { setNotifState('denied'); return }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as any,
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    setNotifState('subscribed')
  }

  async function handleShare() {
    if (!weekGridRef.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(weekGridRef.current, {
        scale: 2,
        backgroundColor: '#f9fafb',
        useCORS: true,
        logging: false,
      })
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
      const file = new File([blob], `uge-${weekNumber}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Familiekalender — Uge ${weekNumber}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `uge-${weekNumber}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // Share cancelled or failed — no-op
    } finally {
      setSharing(false)
    }
  }

  function isForPerson(event: CalendarEvent, personId: string): boolean {
    if (event.participants?.length) {
      return event.participants.some((p) => p.id === personId)
    }
    return event.userId === personId || event.managedMemberId === personId
  }

  const allPeople = [...members, ...managedMembers]
  const displayedEvents = filteredPersonId
    ? events.filter((e) => isForPerson(e, filteredPersonId))
    : events

  const weekNumber = getISOWeek(weekDays[0])
  const weekLabel = (() => {
    const start = weekDays[0]
    const end = weekDays[6]
    if (start.getMonth() !== end.getMonth()) {
      return `${format(start, 'd. MMM', { locale: da })} – ${format(end, 'd. MMM', { locale: da })}`
    }
    if (weekOffset === 0) return 'Denne uge'
    if (weekOffset === 1) return 'Næste uge'
    if (weekOffset === -1) return 'Forrige uge'
    return format(start, 'MMMM yyyy', { locale: da })
  })()

  return (
    <div className="pt-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Forrige uge"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>

        <div className="text-center flex-1">
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest block">
            Uge {weekNumber}
          </span>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{weekLabel}</h1>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="mt-0.5 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors inline-block"
            >
              I dag ↑
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {notifState !== 'unsupported' && (
            <button
              onClick={handleNotification}
              title={notifState === 'subscribed' ? 'Slå notifikationer fra' : 'Aktiver notifikationer'}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Notifikationer"
            >
              {notifState === 'subscribed'
                ? <Bell size={18} className="text-indigo-600" />
                : <BellOff size={18} className="text-gray-400" />
              }
            </button>
          )}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-40"
            aria-label="Del uge som billede"
          >
            {sharing
              ? <Loader2 size={18} className="text-gray-500 animate-spin" />
              : <Share2 size={18} className="text-gray-500" />
            }
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Næste uge"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Day columns */}
      <div
        ref={weekGridRef}
        className={`grid grid-cols-7 gap-1 transition-opacity duration-150 ${loading ? 'opacity-40' : 'opacity-100'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date())
          const dayEvents = displayedEvents.filter((e) => isSameDay(e.startAt, day))
          const showMonth = day.getDate() === 1 || idx === 0
          const w = weather[format(day, 'yyyy-MM-dd')]

          return (
            <div key={day.toISOString()} className="flex flex-col group/day">

              {/* Day header */}
              <div className="text-center mb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase block leading-none mb-1">
                  {format(day, 'EEE', { locale: da })}
                </span>
                <a
                  href={`/dag?date=${format(day, 'yyyy-MM-dd')}`}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-lg font-bold transition-colors ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-900 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  {format(day, 'd')}
                </a>
                <span className={`text-xs font-medium block leading-none mt-0.5 ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                  {showMonth ? format(day, 'MMM', { locale: da }) : ' '}
                </span>
              </div>

              {/* Weather strip */}
              <div
                className="flex flex-col items-center mb-2 min-h-[42px]"
                title={w ? `${w.tempMax}° · ${w.rain.toFixed(1)} mm nedbør · ${w.wind} km/h vind` : ''}
              >
                {w && (
                  <>
                    <span className="text-base leading-none">{weatherEmoji(w.code)}</span>
                    <span className="text-xs font-bold text-gray-700 mt-0.5 leading-none">{w.tempMax}°</span>
                    {w.rain > 0.5 && (
                      <span className="text-[10px] font-semibold text-blue-500 leading-none mt-0.5">{w.rain.toFixed(0)}mm</span>
                    )}
                  </>
                )}
              </div>

              {/* Events + hover add button */}
              <div className="flex flex-col gap-1.5 min-h-[60px]">
                {dayEvents.map((event) => (
                  <EventPill key={event.id} event={event} onClick={setSelectedEvent} tooltipSide={idx >= 4 ? 'right' : 'left'} />
                ))}
                <a
                  href={`/tilfoej?date=${format(day, 'yyyy-MM-dd')}`}
                  className="flex items-center justify-center py-0.5 opacity-0 group-hover/day:opacity-100 transition-opacity"
                  aria-label="Tilføj begivenhed"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 hover:bg-indigo-200 transition-colors">
                    <Plus size={11} className="text-indigo-600" />
                  </span>
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {!loading && displayedEvents.length === 0 && familyId && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 mb-3">
            {filteredPersonId ? 'Ingen begivenheder for denne person' : 'Ingen begivenheder denne uge'}
          </p>
          {!filteredPersonId && (
            <a
              href="/tilfoej"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus size={15} />
              Tilføj begivenhed
            </a>
          )}
        </div>
      )}

      {/* Member legend — click to filter by person */}
      {allPeople.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 px-1 items-center">
          {filteredPersonId && (
            <button
              onClick={() => setFilteredPersonId(null)}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Alle
            </button>
          )}
          {allPeople.map((m) => {
            const isSelected = filteredPersonId === m.id
            const isDimmed = !!filteredPersonId && !isSelected
            return (
              <button
                key={m.id}
                onClick={() => setFilteredPersonId(isSelected ? null : m.id)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all ${
                  isSelected
                    ? 'border-current font-semibold'
                    : isDimmed
                    ? 'border-transparent opacity-30'
                    : 'border-transparent hover:bg-gray-100'
                }`}
                style={{ color: isSelected ? m.color : isDimmed ? '#9ca3af' : '#4b5563' }}
              >
                <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} size={18} />
                {m.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Event detail sheet */}
      {selectedEvent && (
        <EventSheet
          event={selectedEvent}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedEvent(null)}
          onDeleted={(id) => {
            setEvents((prev) => prev.filter((e) => e.id !== id))
            setSelectedEvent(null)
          }}
        />
      )}
    </div>
  )
}
