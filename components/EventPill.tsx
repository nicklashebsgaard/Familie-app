import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
}

export default function EventPill({ event, onClick }: Props) {
  const allParticipants = event.participants?.length
    ? event.participants
    : [event.managedMember ?? event.member].filter(Boolean)

  const primaryPerson = allParticipants[0]
  const color = primaryPerson?.color ?? '#6366f1'
  const time = event.allDay ? null : format(event.startAt, 'HH:mm')

  const initials = allParticipants
    .slice(0, 3)
    .map((p) => p?.name?.[0]?.toUpperCase() ?? '?')

  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className="w-full text-left rounded-lg overflow-hidden active:scale-95 transition-transform"
      style={{ backgroundColor: color }}
    >
      <div className="px-2 py-2 relative">
        {time && (
          <span className="text-white/80 block text-[11px] leading-none mb-0.5 font-semibold tracking-tight">
            {time}
          </span>
        )}
        <span className="text-white text-[13px] font-bold leading-tight block pr-5 truncate">
          {event.title}
        </span>
        <div className="absolute bottom-1.5 right-1.5 flex flex-row-reverse">
          {initials.map((initial, i) => (
            <span
              key={i}
              className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-white text-[8px] font-bold leading-none -ml-1 first:ml-0 border border-white/20"
            >
              {initial}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
