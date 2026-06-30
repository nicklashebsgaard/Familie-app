import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns'
import { da } from 'date-fns/locale'
import { createServiceClient } from '@/lib/supabase/service'
import { Calendar } from 'lucide-react'

interface Params {
  params: { token: string }
}

interface GuestEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  transport: string | null
  start_at: string
  end_at: string
  all_day: boolean
}

interface GuestLink {
  family_id: string
  expires_at: string
  date_from: string | null
  date_to: string | null
  label: string | null
}

interface Week {
  weekStart: Date
  days: {
    date: Date
    events: (GuestEvent & { memberColor: string; memberName: string })[]
  }[]
}

function groupByWeek(
  events: (GuestEvent & { memberColor: string; memberName: string })[],
  dateFrom: string | null,
  dateTo: string | null,
): Week[] {
  if (events.length === 0) return []

  const firstEvent = parseISO(events[0].start_at)
  const lastEvent = parseISO(events[events.length - 1].start_at)

  const rangeStart = dateFrom ? parseISO(dateFrom) : firstEvent
  const rangeEnd = dateTo ? parseISO(dateTo) : lastEvent

  const weekStart = startOfWeek(rangeStart, { weekStartsOn: 1 })
  const weeks: Week[] = []

  let current = weekStart
  while (current <= rangeEnd) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(current, i)
      const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), date))
      return { date, events: dayEvents }
    })
    const hasEvents = days.some((d) => d.events.length > 0)
    if (hasEvents) {
      weeks.push({ weekStart: current, days })
    }
    current = addDays(current, 7)
  }

  return weeks
}

export default async function GuestPage({ params }: Params) {
  const { token } = params
  const supabase = createServiceClient()

  // Validate token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link, error: linkError } = await (supabase as any)
    .from('guest_links')
    .select('family_id, expires_at, date_from, date_to, label')
    .eq('token', token)
    .single() as { data: GuestLink | null; error: unknown }

  if (linkError || !link) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Calendar size={48} className="text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-1">Link ikke fundet</h1>
          <p className="text-gray-500 text-sm">Dette invitationslink eksisterer ikke.</p>
        </div>
      </div>
    )
  }

  if (new Date(link.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Calendar size={48} className="text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-1">Link udløbet</h1>
          <p className="text-gray-500 text-sm">
            Dette invitationslink udløb den{' '}
            {format(new Date(link.expires_at), 'd. MMMM yyyy', { locale: da })}.
          </p>
        </div>
      </div>
    )
  }

  // Fetch events directly from Supabase (no internal HTTP fetch)
  let eventsQuery = supabase
    .from('events')
    .select('id, title, description, location, transport, start_at, end_at, all_day, user_id, managed_member_id')
    .eq('family_id', link.family_id)
    .order('start_at', { ascending: true })

  if (link.date_from) eventsQuery = eventsQuery.gte('start_at', link.date_from)
  if (link.date_to) eventsQuery = eventsQuery.lte('start_at', link.date_to + 'T23:59:59+01:00')

  const [eventsRes, membersRes, managedRes] = await Promise.all([
    eventsQuery,
    supabase.from('users').select('id, name, color').eq('family_id', link.family_id),
    supabase.from('managed_members').select('id, name, color').eq('family_id', link.family_id),
  ])

  const memberMap = new Map((membersRes.data ?? []).map((m) => [m.id, m]))
  const managedMap = new Map((managedRes.data ?? []).map((m) => [m.id, m]))

  const events = (eventsRes.data ?? []).map((e) => {
    const member = e.managed_member_id
      ? managedMap.get(e.managed_member_id)
      : memberMap.get(e.user_id)
    return {
      ...e,
      memberColor: member?.color ?? '#6366f1',
      memberName: member?.name ?? '',
    }
  })

  const weeks = groupByWeek(events, link.date_from, link.date_to)

  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-0.5">
            <Calendar size={18} className="text-indigo-500" />
            <h1 className="text-base font-bold text-gray-900">
              {link.label ?? 'Familiekalender'}
            </h1>
          </div>
          <p className="text-xs text-gray-400 ml-6">
            {link.date_from && link.date_to
              ? `${format(parseISO(link.date_from), 'd. MMM', { locale: da })} – ${format(parseISO(link.date_to), 'd. MMM yyyy', { locale: da })}`
              : link.date_from
              ? `Fra ${format(parseISO(link.date_from), 'd. MMM yyyy', { locale: da })}`
              : link.date_to
              ? `Til ${format(parseISO(link.date_to), 'd. MMM yyyy', { locale: da })}`
              : 'Alle begivenheder'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {weeks.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Ingen begivenheder i denne periode</p>
          </div>
        ) : (
          weeks.map((week) => (
            <div key={week.weekStart.toISOString()}>
              {/* Week label */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Uge {format(week.weekStart, 'w', { locale: da })} ·{' '}
                {format(week.weekStart, 'd. MMM', { locale: da })} –{' '}
                {format(addDays(week.weekStart, 6), 'd. MMM', { locale: da })}
              </p>

              <div className="space-y-1.5">
                {week.days.map(({ date, events: dayEvents }) => {
                  if (dayEvents.length === 0) return null
                  const dayIdx = (date.getDay() + 6) % 7
                  const isToday = isSameDay(date, new Date())

                  return (
                    <div key={date.toISOString()} className="flex gap-3">
                      {/* Day column */}
                      <div className="w-10 flex-shrink-0 pt-1 text-center">
                        <p className="text-[10px] text-gray-400 leading-none">{dayNames[dayIdx]}</p>
                        <div
                          className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                            isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                          }`}
                        >
                          {date.getDate()}
                        </div>
                      </div>

                      {/* Events */}
                      <div className="flex-1 space-y-1.5">
                        {dayEvents.map((event) => {
                          const timeStr = event.all_day
                            ? 'Hele dagen'
                            : `${format(parseISO(event.start_at), 'HH:mm')} – ${format(parseISO(event.end_at), 'HH:mm')}`

                          return (
                            <div
                              key={event.id}
                              className="rounded-xl px-3 py-2.5"
                              style={{ backgroundColor: event.memberColor }}
                            >
                              <p className="text-white font-bold text-sm leading-snug">{event.title}</p>
                              <p className="text-white/70 text-xs mt-0.5">{timeStr}</p>
                              {event.location && (
                                <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                                  <span>📍</span>
                                  <span>{event.location}</span>
                                </p>
                              )}
                              {event.memberName && (
                                <p className="text-white/50 text-[10px] mt-1">{event.memberName}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          Delt med Famille-app · Udløber {format(new Date(link.expires_at), 'd. MMMM yyyy', { locale: da })}
        </p>
      </div>
    </div>
  )
}
