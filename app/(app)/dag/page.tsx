import { createClient } from '@/lib/supabase/server'
import { format, parseISO, isToday } from 'date-fns'
import { da } from 'date-fns/locale'
import { Clock, MapPin, Car } from 'lucide-react'
import Avatar from '@/components/Avatar'
import DayNavigator from '@/components/DayNavigator'

interface Props {
  searchParams: { date?: string }
}

export default async function DagPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  // Determine which day to show
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const dateStr = searchParams.date ?? todayStr

  const viewDate = new Date(dateStr + 'T00:00:00')
  const nextDay = new Date(dateStr + 'T00:00:00')
  nextDay.setDate(nextDay.getDate() + 1)

  const dateLabel = (() => {
    const label = format(viewDate, 'EEEE d. MMMM', { locale: da })
    return label.charAt(0).toUpperCase() + label.slice(1)
  })()

  const [eventsResult, membersResult, managedResult] = await Promise.all([
    profile?.family_id
      ? supabase
          .from('events')
          .select('*')
          .eq('family_id', profile.family_id)
          .gte('start_at', viewDate.toISOString())
          .lt('start_at', nextDay.toISOString())
          .order('start_at')
      : { data: [] },
    profile?.family_id
      ? supabase.from('users').select('id, name, color, avatar_url').eq('family_id', profile.family_id)
      : { data: [] },
    profile?.family_id
      ? supabase.from('managed_members').select('id, name, color, avatar_url').eq('family_id', profile.family_id)
      : { data: [] },
  ])

  const membersMap = new Map((membersResult.data ?? []).map((m) => [m.id, m]))
  const managedMap = new Map((managedResult.data ?? []).map((m) => [m.id, m]))
  const events = eventsResult.data ?? []

  return (
    <div className="pt-4">
      <DayNavigator currentDate={dateStr} dateLabel={dateLabel} isToday={isToday(viewDate)}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-base font-semibold text-gray-700">Fri dag!</p>
            <p className="text-sm text-gray-400 mt-1">Ingen begivenheder {isToday(viewDate) ? 'i dag' : 'denne dag'}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-28">
            {/* All-day events first */}
            {events.filter(e => e.all_day).map((event) => {
              const participants = resolveParticipants(event, membersMap, managedMap)
              const color = participants[0]?.color ?? '#6366f1'
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  participants={participants}
                  color={color}
                  allDay
                />
              )
            })}

            {/* Timed events */}
            {events.filter(e => !e.all_day).map((event) => {
              const participants = resolveParticipants(event, membersMap, managedMap)
              const color = participants[0]?.color ?? '#6366f1'
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  participants={participants}
                  color={color}
                />
              )
            })}
          </div>
        )}
      </DayNavigator>
    </div>
  )
}

type Person = { id: string; name: string; color: string; avatar_url?: string | null }

function resolveParticipants(
  event: Record<string, unknown>,
  membersMap: Map<string, Person>,
  managedMap: Map<string, Person>,
): Person[] {
  const raw = (event.participants as string[] | null) ?? []
  if (raw.length > 0) {
    return raw
      .map((pid) => {
        const [type, id] = pid.split(':')
        return type === 'auth' ? membersMap.get(id) : managedMap.get(id)
      })
      .filter(Boolean) as Person[]
  }
  // Fallback for old events
  const p = event.managed_member_id
    ? managedMap.get(event.managed_member_id as string)
    : membersMap.get(event.user_id as string)
  return p ? [p] : []
}

function EventCard({
  event,
  participants,
  color,
  allDay = false,
}: {
  event: Record<string, unknown>
  participants: Person[]
  color: string
  allDay?: boolean
}) {
  const startTime = allDay ? null : format(parseISO(event.start_at as string), 'HH:mm')
  const endTime = allDay ? null : format(parseISO(event.end_at as string), 'HH:mm')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Color top stripe */}
      <div className="h-1.5 flex-shrink-0" style={{ backgroundColor: color }} />

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-900 text-[17px] leading-snug flex-1">
            {event.title as string}
          </h3>
          {allDay ? (
            <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              Hele dagen
            </span>
          ) : (
            <span
              className="flex-shrink-0 text-xs font-bold text-white px-2.5 py-1 rounded-full"
              style={{ backgroundColor: color }}
            >
              {startTime}
            </span>
          )}
        </div>

        {/* Time */}
        {startTime && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock size={14} className="flex-shrink-0 text-gray-400" />
            <span>{startTime} – {endTime}</span>
          </div>
        )}

        {/* Location */}
        {(event.location as string | null) && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <MapPin size={14} className="flex-shrink-0 text-gray-400" />
            <span>{event.location as string}</span>
          </div>
        )}

        {/* Transport */}
        {(event.transport as string | null) && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Car size={14} className="flex-shrink-0 text-gray-400" />
            <span>{event.transport as string}</span>
          </div>
        )}

        {/* Description */}
        {(event.description as string | null) && (
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {event.description as string}
          </p>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-1">
            <div className="flex -space-x-1.5">
              {participants.slice(0, 5).map((p, i) => (
                <Avatar key={i} name={p.name} color={p.color} avatarUrl={p.avatar_url} size={26} />
              ))}
            </div>
            <span className="text-xs text-gray-500 font-medium truncate">
              {participants.map((p) => p.name).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
