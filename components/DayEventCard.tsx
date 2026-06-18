'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Clock, MapPin, Car, Pencil, Trash2 } from 'lucide-react'
import Avatar from './Avatar'

interface Person {
  id: string
  name: string
  color: string
  avatar_url?: string | null
}

interface EventData {
  id: string
  title: string
  location?: string | null
  transport?: string | null
  description?: string | null
  start_at: string
  end_at: string
  all_day: boolean
}

interface Props {
  event: EventData
  participants: Person[]
  color: string
  canEdit: boolean
}

export default function DayEventCard({ event, participants, color, canEdit }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startTime = event.all_day ? null : format(parseISO(event.start_at), 'HH:mm')
  const endTime = event.all_day ? null : format(parseISO(event.end_at), 'HH:mm')

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Color top stripe */}
      <div className="h-1.5" style={{ backgroundColor: color }} />

      <div className="p-4 sm:p-5">
        {/* Title + time badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-900 text-[17px] sm:text-lg leading-snug flex-1">
            {event.title}
          </h3>
          {event.all_day ? (
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

        {startTime && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock size={14} className="flex-shrink-0 text-gray-400" />
            <span>{startTime} – {endTime}</span>
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <MapPin size={14} className="flex-shrink-0 text-gray-400" />
            <span>{event.location}</span>
          </div>
        )}

        {event.transport && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Car size={14} className="flex-shrink-0 text-gray-400" />
            <span>{event.transport}</span>
          </div>
        )}

        {event.description && (
          <p className="text-sm text-gray-600 leading-relaxed mb-3">{event.description}</p>
        )}

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

        {canEdit && (
          <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
            <a
              href={`/tilfoej?edit=${event.id}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Rediger
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                confirming
                  ? 'bg-red-500 text-white'
                  : 'border border-gray-200 text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 size={14} />
              {confirming ? 'Bekræft sletning' : 'Slet'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
