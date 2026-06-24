'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addWeeks, subWeeks, format, isSameDay, parseISO, getISOWeek, startOfWeek, endOfWeek } from 'date-fns'
import { da } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Share2, Loader2, Bell, BellOff, Check, X, Clock } from 'lucide-react'
import type { CalendarEvent, FamilyMember, ManagedMember } from '@/lib/types'
import EventPill from './EventPill'
import EventSheet from './EventSheet'
import Avatar from './Avatar'
import MonthView from './MonthView'

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

function vapidKeyToBuffer(base64Url: string): ArrayBuffer {
  const base64 = (base64Url + '===').replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const view = new DataView(buf)
  for (let i = 0; i < raw.length; i++) view.setUint8(i, raw.charCodeAt(i))
  return buf
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
  const [daySheet, setDaySheet] = useState<{ date: Date; events: CalendarEvent[] } | null>(null)
  const [daySheetVisible, setDaySheetVisible] = useState(false)
  const [filteredPersonId, setFilteredPersonId] = useState<string | null>(null)
  const [weather, setWeather] = useState<Record<string, WeatherData>>({})
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [notifState, setNotifState] = useState<'unknown' | 'subscribed' | 'denied' | 'unsupported'>('unknown')
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const weekGridRef = useRef<HTMLDivElement>(null)
  const monthGridRef = useRef<HTMLDivElement>(null)
  const [monthLabel, setMonthLabel] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
  })

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
    setEvents([]) // clear so skeletons show immediately

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

  function openDaySheet(date: Date, events: CalendarEvent[]) {
    setDaySheet({ date, events })
    requestAnimationFrame(() => setDaySheetVisible(true))
  }

  function closeDaySheet() {
    setDaySheetVisible(false)
    setTimeout(() => setDaySheet(null), 300)
  }

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
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setNotifState('denied'); return }
    const timer = setTimeout(() => setNotifState('unsupported'), 3000)
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        clearTimeout(timer)
        setNotifState(sub ? 'subscribed' : 'unknown')
      })
    ).catch(() => { clearTimeout(timer); setNotifState('unsupported') })
    return () => clearTimeout(timer)
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
      applicationServerKey: vapidKeyToBuffer(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    setNotifState('subscribed')
  }

  async function handleShare() {
    const captureEl = viewMode === 'month' ? monthGridRef.current : weekGridRef.current
    if (!captureEl) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default

      // Step 1: capture the calendar grid as-is
      const contentCanvas = await html2canvas(captureEl, {
        scale: 2,
        backgroundColor: '#f9fafb',
        useCORS: true,
        allowTaint: true,
        logging: false,
      })

      // Step 2: compose title + content onto a new canvas
      const S = 2 // scale
      const pad = 20 * S
      const titleH = 60 * S

      const label = viewMode === 'month'
        ? (monthLabel || captureEl.querySelector('h2')?.textContent?.trim() || '')
        : `Uge ${weekNumber} · ${weekLabel}`

      const W = contentCanvas.width + pad * 2
      const H = contentCanvas.height + titleH + pad * 2

      const final = document.createElement('canvas')
      final.width = W
      final.height = H
      const ctx = final.getContext('2d')!

      // Background
      ctx.fillStyle = '#f9fafb'
      ctx.fillRect(0, 0, W, H)

      // "FAMILIEKALENDER" label
      ctx.fillStyle = '#6366f1'
      ctx.font = `700 ${11 * S}px -apple-system,system-ui,sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('FAMILIEKALENDER', W / 2, pad + 14 * S)

      // Main title
      ctx.fillStyle = '#111827'
      ctx.font = `800 ${17 * S}px -apple-system,system-ui,sans-serif`
      ctx.fillText(label, W / 2, pad + 14 * S + 20 * S + 2 * S)

      // Divider line
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = S
      ctx.beginPath()
      ctx.moveTo(pad, titleH + pad - 8 * S)
      ctx.lineTo(W - pad, titleH + pad - 8 * S)
      ctx.stroke()

      // Calendar content
      ctx.drawImage(contentCanvas, pad, titleH + pad - 8 * S)

      // Step 3: share or download
      const filename = viewMode === 'month'
        ? `familie-${(label).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.png`
        : `familie-uge-${weekNumber}.png`

      const blob = await new Promise<Blob>((resolve) => final.toBlob((b) => resolve(b!), 'image/png'))
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Familiekalender — ${label}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        setShareSuccess(true)
        setTimeout(() => setShareSuccess(false), 2500)
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
      {/* Header — week nav only shown in week mode, toggle always visible */}
      <div className="flex items-center justify-between mb-4 px-1">
        {viewMode === 'week' ? (
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Forrige uge"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {viewMode === 'week' && (
          <div className="text-center flex-1">
            <span className="text-xs sm:text-sm font-semibold text-indigo-600 uppercase tracking-widest block">
              Uge {weekNumber}
            </span>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{weekLabel}</h1>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="mt-0.5 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors inline-block"
              >
                I dag ↑
              </button>
            )}
          </div>
        )}
        {viewMode === 'month' && <div className="flex-1" />}

        <div className="flex items-center gap-0.5">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-full p-0.5 mr-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Uge
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Måned
            </button>
          </div>
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
              : shareSuccess
              ? <Check size={18} className="text-green-500" />
              : <Share2 size={18} className="text-gray-500" />
            }
          </button>
          {viewMode === 'week' && (
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Næste uge"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <MonthView
          ref={monthGridRef}
          initialEvents={initialEvents}
          members={members}
          managedMembers={managedMembers}
          familyId={familyId}
          filteredPersonId={filteredPersonId}
          onDayWithEvents={openDaySheet}
          onMonthChange={setMonthLabel}
        />
      )}

      {/* Day columns */}
      {viewMode === 'week' && <div
        ref={weekGridRef}
        className="grid grid-cols-7 gap-1 sm:gap-2"
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
                <span className="text-xs sm:text-sm font-semibold text-gray-400 uppercase block leading-none mb-1">
                  {format(day, 'EEE', { locale: da })}
                </span>
                <a
                  href={`/dag?date=${format(day, 'yyyy-MM-dd')}`}
                  className={`inline-flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-full text-lg sm:text-2xl font-bold transition-colors ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-900 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  {format(day, 'd')}
                </a>
                <span className={`text-xs sm:text-sm font-medium block leading-none mt-0.5 ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                  {showMonth ? format(day, 'MMM', { locale: da }) : ' '}
                </span>
              </div>

              {/* Weather strip */}
              <div
                className="flex flex-col items-center justify-center mb-2 h-[48px] sm:h-[64px]"
                title={w ? `${w.tempMax}° · ${w.rain.toFixed(1)} mm nedbør · ${w.wind} km/h vind` : ''}
              >
                {w && (
                  <>
                    <span className="text-base sm:text-2xl leading-none">{weatherEmoji(w.code)}</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 mt-0.5 leading-none">{w.tempMax}°</span>
                    {w.rain > 0.5 && (
                      <span className="text-[10px] sm:text-xs font-semibold text-blue-500 leading-none mt-0.5">{w.rain.toFixed(0)}mm</span>
                    )}
                  </>
                )}
              </div>

              {/* Events + add button */}
              <div className="flex flex-col gap-1.5 sm:gap-2 min-h-[60px] sm:min-h-[80px]">
                {loading ? (
                  // Skeleton pills — scattered pattern across the week
                  [1, 2, 0, 1, 2, 1, 0][idx] > 0
                    ? Array.from({ length: [1, 2, 0, 1, 2, 1, 0][idx] }).map((_, si) => (
                        <div
                          key={si}
                          className={`rounded-lg bg-gray-200 animate-pulse ${si === 0 ? 'h-7' : 'h-5 opacity-50'}`}
                        />
                      ))
                    : null
                ) : (
                  <>
                    {dayEvents.map((event) => (
                      <EventPill key={event.id} event={event} onClick={setSelectedEvent} tooltipSide={idx >= 4 ? 'right' : 'left'} />
                    ))}
                    {/* Mobile: always visible; Desktop: appear on hover */}
                    <a
                      href={`/tilfoej?date=${format(day, 'yyyy-MM-dd')}`}
                      className="flex items-center justify-center py-0.5 sm:opacity-0 sm:group-hover/day:opacity-100 sm:transition-opacity"
                      aria-label="Tilføj begivenhed"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 sm:bg-indigo-100 sm:hover:bg-indigo-200 transition-colors">
                        <Plus size={11} className="text-gray-400 sm:text-indigo-600" />
                      </span>
                    </a>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>}

      {/* Empty state */}
      {viewMode === 'week' && !loading && displayedEvents.length === 0 && familyId && (
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

      {/* Day events sheet — rendered at top level to avoid stacking context issues */}
      {daySheet && (
        <>
          <div
            className={`fixed inset-0 z-[60] bg-black transition-opacity duration-300 ${daySheetVisible ? 'opacity-50' : 'opacity-0'}`}
            onClick={closeDaySheet}
          />
          {/* Outer layer is pointer-events-auto + closes on click outside */}
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center"
            onClick={closeDaySheet}
          >
            <div
              className={`w-full max-w-lg bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[80vh] flex flex-col ${
                daySheetVisible ? 'translate-y-0' : 'translate-y-full'
              }`}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-gray-100">
                <div>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest capitalize">
                    {format(daySheet.date, 'EEEE', { locale: da })}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 capitalize">
                    {format(daySheet.date, 'd. MMMM', { locale: da })}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/tilfoej?date=${format(daySheet.date, 'yyyy-MM-dd')}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl"
                  >
                    <Plus size={14} />
                    Tilføj
                  </a>
                  <button
                    onClick={closeDaySheet}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Event list */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {daySheet.events.map((event) => {
                  const ps = event.participants?.length
                    ? event.participants
                    : event.member ? [event.member] : []
                  const color = ps[0] && 'color' in ps[0] ? ps[0].color : '#6366f1'
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        closeDaySheet()
                        setTimeout(() => setSelectedEvent(event), 300)
                      }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{event.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500">
                            {event.allDay ? 'Hele dagen' : `${format(event.startAt, 'HH:mm')} – ${format(event.endAt, 'HH:mm')}`}
                          </span>
                        </div>
                        {event.location && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{event.location}</p>
                        )}
                      </div>
                      <div className="flex -space-x-1.5 flex-shrink-0">
                        {ps.slice(0, 3).map((p, i) => (
                          <Avatar key={i} name={p.name} color={'color' in p ? p.color : '#6366f1'} avatarUrl={'avatarUrl' in p ? p.avatarUrl : undefined} size={26} />
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
