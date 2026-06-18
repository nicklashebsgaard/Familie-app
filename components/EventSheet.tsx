'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'
import { X, Pencil, Trash2, MapPin, Clock, Truck } from 'lucide-react'
import type { CalendarEvent } from '@/lib/types'
import Avatar from './Avatar'

interface Props {
  event: CalendarEvent
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onDeleted: (id: string) => void
}

export default function EventSheet({ event, currentUserId, isAdmin, onClose, onDeleted }: Props) {
  const [visible, setVisible] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const allParticipants = event.participants?.length
    ? event.participants
    : [event.managedMember ?? event.member].filter(Boolean) as (typeof event.member)[]
  const person = allParticipants[0]
  const canEdit = isAdmin || event.userId === currentUserId

  const dateStr = format(event.startAt, 'EEEE d. MMMM', { locale: da })
  const timeStr = event.allDay
    ? 'Hele dagen'
    : `${format(event.startAt, 'HH:mm')} – ${format(event.endAt, 'HH:mm')}`

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' })
    onDeleted(event.id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ backgroundColor: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
        onClick={close}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden transition-all duration-200"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
          }}
        >
          {/* Colored header */}
          <div
            className="px-5 pt-5 pb-4 relative"
            style={{ backgroundColor: person?.color ? `${person.color}22` : '#f3f4f6' }}
          >
            <button
              onClick={close}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/10 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>

            <div className="flex items-center gap-3 mb-3 pr-8">
              <div className="flex -space-x-1.5">
                {allParticipants.slice(0, 4).map((p, i) => p && (
                  <Avatar
                    key={i}
                    name={p.name}
                    color={p.color}
                    avatarUrl={'avatarUrl' in p ? p.avatarUrl : undefined}
                    size={allParticipants.length > 1 ? 32 : 40}
                  />
                ))}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-snug">
                  {allParticipants.map((p) => p?.name).filter(Boolean).join(', ') || 'Ukendt'}
                </p>
                {event.source === 'aula' && (
                  <span className="text-xs text-indigo-600 font-semibold">Aula</span>
                )}
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 leading-snug">{event.title}</h2>
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <Row icon={<Clock size={16} className="text-gray-400" />}>
              <span className="font-semibold text-gray-900 capitalize text-sm">{dateStr}</span>
              <span className="text-gray-500 text-sm">{timeStr}</span>
            </Row>
            {event.location && (
              <Row icon={<MapPin size={16} className="text-gray-400" />}>
                <span className="text-gray-800 text-sm">{event.location}</span>
              </Row>
            )}
            {event.transport && (
              <Row icon={<Truck size={16} className="text-gray-400" />}>
                <span className="text-gray-800 text-sm">{event.transport}</span>
              </Row>
            )}
            {event.description && (
              <p className="text-sm text-gray-600 pl-6 leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="px-5 pb-5 pt-1 flex gap-2">
              <a
                href={`/tilfoej?edit=${event.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil size={15} />
                Rediger
              </a>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  confirming
                    ? 'bg-red-500 text-white'
                    : 'border-2 border-gray-200 text-red-500 hover:bg-red-50'
                }`}
              >
                <Trash2 size={15} />
                {confirming ? 'Bekræft' : 'Slet'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">{children}</div>
    </div>
  )
}
