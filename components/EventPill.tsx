import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
}

export default function EventPill({ event, onClick }: Props) {
  const person = event.managedMember ?? event.member
  const color = person?.color ?? '#6366f1'
  const time = event.allDay ? null : format(event.startAt, 'HH:mm')
  const initial = person?.name?.[0]?.toUpperCase() ?? '?'

  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className="w-full text-left rounded-lg overflow-hidden active:scale-95 transition-transform"
      style={{ backgroundColor: color }}
    >
      <div className="px-1.5 py-1.5 relative">
        {time && (
          <span className="text-white/80 block text-[10px] leading-none mb-0.5 font-semibold tracking-tight">
            {time}
          </span>
        )}
        <span className="text-white text-[12px] font-bold leading-tight block pr-4 truncate">
          {event.title}
        </span>
        {/* Person initial */}
        <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-white text-[9px] font-bold leading-none">
          {initial}
        </span>
      </div>
    </button>
  )
}
