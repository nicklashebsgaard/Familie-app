import { createClient } from '@/lib/supabase/server'
import { format, parseISO, isSameDay } from 'date-fns'
import { da } from 'date-fns/locale'
import { Clock, MapPin, Car } from 'lucide-react'
import type { FamilyMember } from '@/lib/types'

export default async function DagPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const [eventsResult, membersResult] = await Promise.all([
    profile?.family_id
      ? supabase
          .from('events')
          .select('*')
          .eq('family_id', profile.family_id)
          .gte('start_at', today.toISOString())
          .lt('start_at', tomorrow.toISOString())
          .order('start_at')
      : { data: [] },
    profile?.family_id
      ? supabase
          .from('users')
          .select('id, name, color')
          .eq('family_id', profile.family_id)
      : { data: [] },
  ])

  const membersMap = new Map(
    (membersResult.data ?? []).map((m) => [m.id, m])
  )

  const events = eventsResult.data ?? []
  const todayLabel = format(today, "EEEE d. MMMM", { locale: da })
  // Capitalize first letter
  const todayFormatted = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

  return (
    <div className="pt-4">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{todayFormatted}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {events.length === 0
          ? 'Ingen begivenheder i dag'
          : `${events.length} begivenhed${events.length !== 1 ? 'er' : ''} i dag`}
      </p>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-sm">Fri dag!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const member = membersMap.get(event.user_id)
            const color = member?.color ?? '#6366f1'
            const startTime = event.all_day ? null : format(parseISO(event.start_at), 'HH:mm')
            const endTime = event.all_day ? null : format(parseISO(event.end_at), 'HH:mm')

            return (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="flex">
                  {/* Color bar */}
                  <div className="w-1 flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        {member && (
                          <span className="text-xs font-medium" style={{ color }}>
                            {member.name}
                          </span>
                        )}
                      </div>
                      {event.all_day && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Hele dagen
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1">
                      {startTime && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock size={14} className="flex-shrink-0" />
                          {startTime} – {endTime}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin size={14} className="flex-shrink-0" />
                          {event.location}
                        </div>
                      )}
                      {event.transport && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Car size={14} className="flex-shrink-0" />
                          {event.transport}
                        </div>
                      )}
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
