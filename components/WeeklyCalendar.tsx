'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addWeeks, subWeeks, format, isSameDay, parseISO } from 'date-fns'
import { da } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent, FamilyMember } from '@/lib/types'
import EventPill from './EventPill'

interface Props {
  initialEvents: CalendarEvent[]
  members: FamilyMember[]
  weekDays: Date[]
  familyId: string | null
  currentUserId: string
}

export default function WeeklyCalendar({
  initialEvents,
  members,
  weekDays: initialWeekDays,
  familyId,
  currentUserId,
}: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDays, setWeekDays] = useState(initialWeekDays)

  // Adjust week days when offset changes
  useEffect(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const monday = new Date(base)
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
    const start = weekOffset === 0 ? monday : (weekOffset > 0 ? addWeeks(monday, weekOffset) : subWeeks(monday, Math.abs(weekOffset)))
    setWeekDays(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    }))
  }, [weekOffset])

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    if (!familyId) return

    const supabase = createClient()
    const channel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Record<string, unknown>
            const member = members.find((m) => m.id === row.user_id)
            setEvents((prev) => [
              ...prev,
              {
                id: row.id as string,
                familyId: row.family_id as string,
                userId: row.user_id as string,
                title: row.title as string,
                description: row.description as string | undefined,
                location: row.location as string | undefined,
                startAt: parseISO(row.start_at as string),
                endAt: parseISO(row.end_at as string),
                allDay: row.all_day as boolean,
                source: row.source as 'manual' | 'aula',
                member,
              },
            ])
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Record<string, unknown>
            const member = members.find((m) => m.id === row.user_id)
            setEvents((prev) =>
              prev.map((e) =>
                e.id === row.id
                  ? {
                      ...e,
                      title: row.title as string,
                      startAt: parseISO(row.start_at as string),
                      endAt: parseISO(row.end_at as string),
                      allDay: row.all_day as boolean,
                      member,
                    }
                  : e
              )
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, members])

  const weekLabel = (() => {
    if (weekOffset === 0) return 'Denne uge'
    if (weekOffset === 1) return 'Næste uge'
    if (weekOffset === -1) return 'Forrige uge'
    const start = weekDays[0]
    return `${format(start, 'd. MMM', { locale: da })}`
  })()

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
        <h1 className="text-lg font-semibold text-gray-900">{weekLabel}</h1>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Næste uge"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date())
          const dayEvents = events.filter((e) => isSameDay(e.startAt, day))

          return (
            <div key={day.toISOString()} className="flex flex-col">
              {/* Day header */}
              <div className="text-center mb-1">
                <span className="text-xs text-gray-500 uppercase block">
                  {format(day, 'EEE', { locale: da })}
                </span>
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                    isToday
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-900'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-1 min-h-[60px]">
                {dayEvents.map((event) => (
                  <EventPill key={event.id} event={event} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Member legend */}
      {members.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 px-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: m.color }}
              />
              {m.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
