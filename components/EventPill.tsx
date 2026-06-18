import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
  tooltipSide?: 'left' | 'right'
}

export default function EventPill({ event, onClick, tooltipSide = 'left' }: Props) {
  const allParticipants = event.participants?.length
    ? event.participants
    : [event.managedMember ?? event.member].filter(Boolean)

  const primaryPerson = allParticipants[0]
  const color = primaryPerson?.color ?? '#6366f1'
  const time = event.allDay ? null : format(event.startAt, 'HH:mm')
  const timeRange = event.allDay
    ? 'Hele dagen'
    : `${format(event.startAt, 'HH:mm')} – ${format(event.endAt, 'HH:mm')}`

  const initials = allParticipants
    .slice(0, 3)
    .map((p) => p?.name?.[0]?.toUpperCase() ?? '?')

  return (
    <div className="relative group/pill w-full">
      <button
        type="button"
        onClick={() => onClick?.(event)}
        className="w-full text-left rounded-xl overflow-hidden active:scale-95 transition-transform"
        style={{ backgroundColor: color }}
      >
        <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 relative">
          {time && (
            <span className="text-white/80 block text-[11px] sm:text-xs leading-none mb-1 font-semibold tracking-tight">
              {time}
            </span>
          )}
          <span className="text-white text-[13px] sm:text-[14px] font-bold leading-snug block pr-5 truncate">
            {event.title}
          </span>
          <div className="absolute bottom-2 right-2 flex flex-row-reverse">
            {initials.map((initial, i) => (
              <span
                key={i}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/30 flex items-center justify-center text-white text-[8px] sm:text-[9px] font-bold leading-none -ml-1 first:ml-0 border border-white/20"
              >
                {initial}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Hover tooltip — desktop only */}
      <div
        className={`pointer-events-none absolute bottom-full mb-2 z-50 w-56
          opacity-0 group-hover/pill:opacity-100 transition-opacity duration-150
          hidden sm:block
          ${tooltipSide === 'right' ? 'right-0' : 'left-0'}`}
      >
        <div className="bg-gray-900 rounded-2xl p-4 shadow-2xl ring-1 ring-white/10">
          <p className="text-white font-bold text-sm leading-snug mb-1">{event.title}</p>
          <p className="text-white/60 text-xs mb-2">{timeRange}</p>

          {event.location && (
            <p className="text-white/70 text-xs flex items-center gap-1.5 mb-1">
              <span>📍</span>
              <span className="truncate">{event.location}</span>
            </p>
          )}

          {event.transport && (
            <p className="text-white/70 text-xs flex items-center gap-1.5 mb-1">
              <span>🚗</span>
              <span className="truncate">{event.transport}</span>
            </p>
          )}

          {allParticipants.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/10">
              {allParticipants.slice(0, 5).map((p, i) => p && (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name[0].toUpperCase()}
                </div>
              ))}
              <span className="text-white/50 text-[10px] truncate">
                {allParticipants.map((p) => p?.name).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
        {/* Arrow */}
        <div
          className={`absolute top-full w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[6px] border-t-gray-900
            ${tooltipSide === 'right' ? 'right-3' : 'left-3'}`}
        />
      </div>
    </div>
  )
}
