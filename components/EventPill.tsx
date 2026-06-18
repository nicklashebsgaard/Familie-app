import { format } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'

interface Props {
  event: CalendarEvent
  compact?: boolean
}

export default function EventPill({ event, compact = true }: Props) {
  const color = event.member?.color ?? '#6366f1'
  const time = event.allDay ? null : format(event.startAt, 'HH:mm')

  return (
    <div
      className="rounded px-1 py-0.5 text-white text-xs leading-tight overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
      style={{ backgroundColor: color }}
      title={`${event.title}${time ? ` · ${time}` : ''}${event.member ? ` · ${event.member.name}` : ''}`}
    >
      {time && (
        <span className="opacity-90 block text-[10px]">{time}</span>
      )}
      <span className="font-medium truncate block">{event.title}</span>
    </div>
  )
}
