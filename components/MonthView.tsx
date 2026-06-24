'use client'

import { useState, useEffect, forwardRef } from 'react'
import {
  format, isSameDay, isSameMonth, parseISO,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
} from 'date-fns'
import { da } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CalendarEvent, FamilyMember, ManagedMember } from '@/lib/types'

interface Props {
  initialEvents: CalendarEvent[]
  members: FamilyMember[]
  managedMembers: ManagedMember[]
  familyId: string | null
  filteredPersonId: string | null
  selectedEvent?: CalendarEvent | null
  onDayWithEvents: (date: Date, events: CalendarEvent[]) => void
  onMonthChange?: (label: string) => void
}

const MonthView = forwardRef<HTMLDivElement, Props>(function MonthView({
  initialEvents,
  members,
  managedMembers,
  familyId,
  filteredPersonId,
  onDayWithEvents,
  onMonthChange,
}, ref) {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (!familyId) return
    const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    setLoading(true)
    fetch(`/api/events?from=${gridStart.toISOString()}&to=${gridEnd.toISOString()}`)
      .then((r) => r.json())
      .then((rows: Record<string, unknown>[]) => setEvents(rows.map(rowToEvent)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, familyId])

  // Build grid days (full weeks from Mon to Sun)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    days.push(new Date(cur))
    cur = addDays(cur, 1)
  }

  function isForPerson(event: CalendarEvent, personId: string): boolean {
    if (event.participants?.length) {
      return event.participants.some((p) => p.id === personId)
    }
    return event.userId === personId || event.managedMemberId === personId
  }

  const displayedEvents = filteredPersonId
    ? events.filter((e) => isForPerson(e, filteredPersonId))
    : events

  const today = new Date()
  const isThisMonth = isSameMonth(currentDate, today)
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: da })

  function navigate(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
    setCurrentDate(next)
    onMonthChange?.(format(next, 'MMMM yyyy', { locale: da }))
  }

  function handleDayClick(day: Date, dayEvents: CalendarEvent[], dateStr: string) {
    if (!isSameMonth(day, currentDate)) return
    if (dayEvents.length === 0) {
      window.location.href = `/tilfoej?date=${dateStr}`
      return
    }
    onDayWithEvents(day, dayEvents)
  }

  return (
    <div ref={ref} className={`transition-opacity duration-150 ${loading ? 'opacity-50' : 'opacity-100'}`}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Forrige måned"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 capitalize">
            {monthLabel}
          </h2>
          {!isThisMonth && (
            <button
              onClick={() => {
                const d = new Date(); d.setDate(1)
                setCurrentDate(d)
                onMonthChange?.(format(d, 'MMMM yyyy', { locale: da }))
              }}
              className="mt-0.5 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors inline-block"
            >
              I dag ↑
            </button>
          )}
        </div>

        <button
          onClick={() => navigate(1)}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Næste måned"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1 px-0.5">
        {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map((d) => (
          <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-1 tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          const inMonth = isSameMonth(day, currentDate)
          const dayEvents = displayedEvents.filter((e) => isSameDay(e.startAt, day))

          // One dot per event (max 5), colored by primary participant
          const dots = dayEvents.slice(0, 5).map((event) => {
            const ps = event.participants?.length
              ? event.participants
              : event.member
              ? [event.member]
              : []
            return ps[0] && 'color' in ps[0] ? (ps[0] as FamilyMember | ManagedMember).color : '#6366f1'
          })

          // Show up to 2 event titles on larger screens
          const previewEvents = dayEvents.slice(0, 2)

          const dateStr = format(day, 'yyyy-MM-dd')

          return (
            <div
              key={day.toISOString()}
              className={`relative bg-white group/day ${!inMonth ? 'opacity-25 pointer-events-none' : ''}`}
            >
              {/* Main cell */}
              <button
                onClick={() => handleDayClick(day, dayEvents, dateStr)}
                className={`w-full p-1 sm:p-1.5 min-h-[60px] sm:min-h-[80px] flex flex-col items-center transition-colors ${
                  inMonth ? 'hover:bg-indigo-50 active:bg-indigo-100' : ''
                }`}
              >
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-0.5 flex-shrink-0 ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {format(day, 'd')}
                </span>

                {/* Event dots (mobile) — one dot per event */}
                {dots.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center sm:hidden">
                    {dots.map((color, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}

                {/* Event titles (desktop) */}
                <div className="hidden sm:flex flex-col gap-0.5 w-full mt-0.5">
                  {previewEvents.map((event) => {
                    const ps = event.participants?.length
                      ? event.participants
                      : event.member
                      ? [event.member]
                      : []
                    const color = ps.length > 0 && 'color' in ps[0] ? ps[0].color : '#6366f1'
                    return (
                      <span
                        key={event.id}
                        className="text-[10px] font-semibold leading-tight truncate rounded px-1 py-0.5 text-white"
                        style={{ backgroundColor: color }}
                      >
                        {event.title}
                      </span>
                    )
                  })}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-gray-400 font-medium pl-1">
                      +{dayEvents.length - 2} mere
                    </span>
                  )}
                </div>
              </button>

              {/* "+" add button — visible on hover */}
              {inMonth && (
                <a
                  href={`/tilfoej?date=${dateStr}`}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-1 right-1 opacity-0 group-hover/day:opacity-100 transition-opacity"
                  aria-label="Tilføj begivenhed"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 hover:bg-indigo-200 transition-colors">
                    <Plus size={11} className="text-indigo-600" />
                  </span>
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default MonthView
