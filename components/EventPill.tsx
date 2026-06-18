import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'
import Avatar from './Avatar'

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

  const shown = allParticipants.slice(0, 3).filter(Boolean) as NonNullable<typeof primaryPerson>[]

  return (
    <div className="relative group/pill w-full">
      <button
        type="button"
        onClick={() => onClick?.(event)}
        className="w-full text-left rounded-xl overflow-hidden active:scale-95 transition-transform"
        style={{ backgroundColor: color }}
      >
        <div className="px-2.5 pt-2 pb-8 sm:px-3 sm:pt-2.5 sm:pb-9 relative min-h-[52px] sm:min-h-[60px]">
          {time && (
            <span className="text-white/80 block text-[11px] sm:text-xs leading-none mb-1 font-semibold tracking-tight">
              {time}
            </span>
          )}
          <span className="text-white text-[13px] sm:text-sm font-bold leading-snug block truncate">
            {event.title}
          </span>
        </div>

        {/* Avatars bottom-right */}
        <div className="absolute bottom-1.5 right-1.5 flex flex-row-reverse -space-x-1.5 space-x-reverse">
          {shown.map((p, i) => (
            <div key={i} className="ring-1 ring-white/40 rounded-full">
              <Avatar
                name={p.name}
                color={p.color}
                avatarUrl={'avatarUrl' in p ? p.avatarUrl : undefined}
                size={20}
                className="sm:!w-[22px] sm:!h-[22px]"
              />
            </div>
          ))}
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
              {(allParticipants.slice(0, 5) as NonNullable<typeof primaryPerson>[]).map((p, i) => (
                <Avatar
                  key={i}
                  name={p.name}
                  color={p.color}
                  avatarUrl={'avatarUrl' in p ? p.avatarUrl : undefined}
                  size={20}
                />
              ))}
              <span className="text-white/50 text-[10px] truncate ml-0.5">
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
