'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addWeeks, subWeeks, format, isSameDay, parseISO, getISOWeek, startOfWeek, endOfWeek } from 'date-fns'
import { da } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CalendarEvent, FamilyMember, ManagedMember } from '@/lib/types'
import EventPill from './EventPill'
import EventSheet from './EventSheet'
import Avatar from './Avatar'

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
      // Initial data from server is already correct for week 0
      setEvents(initialEvents)
      return
    }

    if (!familyId) return
    setLoading(true)

    const from = startOfWeek(days[0], { weekStartsOn: 1 }).toISOString()
    const to = endOfWeek(days[6], { weekStartsOn: 1 }).toISOString()

    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((rows: Record<string, unknown>[]) => {
        setEvents(rows.map(rowToEvent))
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, familyId])

  // Realtime subscription — reflects live changes for the visible week
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
            // Only add if it falls in the currently displayed week
            if (weekDays.some((d) => isSameDay(newEvent.startAt, d))) {
              setEvents((prev) => [...prev, newEvent])
            }
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Record<string, unknown>
            setEvents((prev) =>
              prev.map((e) => (e.id === row.id ? rowToEvent(row) : e))
            )
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

  const weekNumber = getISOWeek(weekDays[0])

  const weekLabel = (() => {
    const start = weekDays[0]
    const end = weekDays[6]
    // If week spans two months, show both
    if (start.getMonth() !== end.getMonth()) {
      return `${format(start, 'd. MMM', { locale: da })} – ${format(end, 'd. MMM', { locale: da })}`
    }
    if (weekOffset === 0) return 'Denne uge'
    if (weekOffset === 1) return 'Næste uge'
    if (weekOffset === -1) return 'Forrige uge'
    return format(start, 'MMMM yyyy', { locale: da })
  })()

  const totalEvents = events.length

  return (
    <div className="pt-4">
      {/* Week navigation header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Forrige uge"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest block">
            Uge {weekNumber}
          </span>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{weekLabel}</h1>
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Næste uge"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Day columns */}
      <div className={`grid grid-cols-7 gap-1 transition-opacity duration-150 ${loading ? 'opacity-40' : 'opacity-100'}`}>
        {weekDays.map((day, idx) => {
          const isToday = isSameDay(day, new Date())
          const dayEvents = events.filter((e) => isSameDay(e.startAt, day))
          // Show month label on the 1st of a month, or on Monday if week starts in a new month vs prev week
          const showMonth = day.getDate() === 1 || idx === 0

          return (
            <div key={day.toISOString()} className="flex flex-col group/day">
              {/* Day header */}
              <div className="text-center mb-2 relative">
                <span className="text-xs font-semibold text-gray-400 uppercase block leading-none mb-1">
                  {format(day, 'EEE', { locale: da })}
                </span>
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-bold ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-900'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <span className={`text-[11px] font-medium block leading-none mt-0.5 ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                  {showMonth ? format(day, 'MMM', { locale: da }) : ' '}
                </span>
                <a
                  href={`/tilfoej?date=${format(day, 'yyyy-MM-dd')}`}
                  className="absolute top-0 right-0 opacity-0 group-hover/day:opacity-100 transition-opacity p-0.5 rounded-full bg-indigo-100 hover:bg-indigo-200"
                  aria-label="Tilføj begivenhed"
                >
                  <Plus size={11} className="text-indigo-600" />
                </a>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-1 min-h-[60px]">
                {dayEvents.map((event) => (
                  <EventPill key={event.id} event={event} onClick={setSelectedEvent} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {!loading && totalEvents === 0 && familyId && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 mb-3">Ingen begivenheder denne uge</p>
          <a
            href="/tilfoej"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <Plus size={15} />
            Tilføj begivenhed
          </a>
        </div>
      )}

      {/* Member legend */}
      {(members.length > 0 || managedMembers.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-3 px-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} size={18} />
              {m.name}
            </div>
          ))}
          {managedMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} size={18} />
              {m.name}
            </div>
          ))}
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
