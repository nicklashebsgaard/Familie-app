import { createClient } from '@/lib/supabase/server'
import { format, isToday } from 'date-fns'
import { da } from 'date-fns/locale'
import DayNavigator from '@/components/DayNavigator'
import DayEventCard from '@/components/DayEventCard'

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
      ? supabase.from('users').select('id, name, color, role, avatar_url').eq('family_id', profile.family_id)
      : { data: [] },
    profile?.family_id
      ? supabase.from('managed_members').select('id, name, color, avatar_url').eq('family_id', profile.family_id)
      : { data: [] },
  ])

  const membersMap = new Map((membersResult.data ?? []).map((m) => [m.id, m]))
  const managedMap = new Map((managedResult.data ?? []).map((m) => [m.id, m]))
  const events = eventsResult.data ?? []

  const isAdmin = (membersResult.data ?? []).find((m) => m.id === user.id)?.role === 'admin'

  type Person = { id: string; name: string; color: string; avatar_url?: string | null }

  function resolveParticipants(event: Record<string, unknown>): Person[] {
    const raw = (event.participants as string[] | null) ?? []
    if (raw.length > 0) {
      return raw
        .map((pid) => {
          const [type, id] = pid.split(':')
          return type === 'auth' ? membersMap.get(id) : managedMap.get(id)
        })
        .filter(Boolean) as Person[]
    }
    const p = event.managed_member_id
      ? managedMap.get(event.managed_member_id as string)
      : membersMap.get(event.user_id as string)
    return p ? [p] : []
  }

  const allDayEvents = events.filter((e) => e.all_day)
  const timedEvents = events.filter((e) => !e.all_day)

  return (
    <div className="pt-4">
      <DayNavigator currentDate={dateStr} dateLabel={dateLabel} isToday={isToday(viewDate)}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-base font-semibold text-gray-700">Fri dag!</p>
            <p className="text-sm text-gray-400 mt-1">
              Ingen begivenheder {isToday(viewDate) ? 'i dag' : 'denne dag'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-28">
            {allDayEvents.map((event) => {
              const participants = resolveParticipants(event as Record<string, unknown>)
              const color = participants[0]?.color ?? '#6366f1'
              const canEdit = isAdmin || event.user_id === user.id
              return (
                <DayEventCard
                  key={event.id}
                  event={{
                    id: event.id,
                    title: event.title,
                    location: event.location,
                    transport: event.transport,
                    description: event.description,
                    start_at: event.start_at,
                    end_at: event.end_at,
                    all_day: event.all_day,
                  }}
                  participants={participants}
                  color={color}
                  canEdit={canEdit}
                />
              )
            })}

            {timedEvents.map((event) => {
              const participants = resolveParticipants(event as Record<string, unknown>)
              const color = participants[0]?.color ?? '#6366f1'
              const canEdit = isAdmin || event.user_id === user.id
              return (
                <DayEventCard
                  key={event.id}
                  event={{
                    id: event.id,
                    title: event.title,
                    location: event.location,
                    transport: event.transport,
                    description: event.description,
                    start_at: event.start_at,
                    end_at: event.end_at,
                    all_day: event.all_day,
                  }}
                  participants={participants}
                  color={color}
                  canEdit={canEdit}
                />
              )
            })}
          </div>
        )}
      </DayNavigator>
    </div>
  )
}
