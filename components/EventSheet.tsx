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
    setTimeout(onClose, 300)
  }

  const allParticipants = event.participants?.length
    ? event.participants
    : [event.managedMember ?? event.member].filter(Boolean) as (typeof event.member)[]

  const primaryColor = allParticipants[0]?.color ?? '#6366f1'
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
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ${visible ? 'opacity-50' : 'opacity-0'}`}
        onClick={close}
      />

      {/* Sheet container — bottom on mobile, centered on desktop */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-4">
        <div
          className={`pointer-events-auto w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-y-auto sm:overflow-hidden transition-all duration-300 ease-out max-h-[85vh] sm:max-h-none
            ${visible
              ? 'translate-y-0 opacity-100 sm:scale-100'
              : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'
            }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Colored header */}
          <div
            className="px-5 pt-4 pb-5 relative"
            style={{ backgroundColor: `${primaryColor}18` }}
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 p-2.5 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Luk"
            >
              <X size={18} className="text-gray-500" />
            </button>

            {/* Participants */}
            <div className="flex items-center gap-3 mb-4 pr-10">
              <div className="flex -space-x-2">
                {allParticipants.slice(0, 5).map((p, i) => p && (
                  <Avatar
                    key={i}
                    name={p.name}
                    color={p.color}
                    avatarUrl={'avatarUrl' in p ? p.avatarUrl : undefined}
                    size={allParticipants.length > 1 ? 36 : 44}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 leading-snug truncate">
                  {allParticipants.map((p) => p?.name).filter(Boolean).join(', ') || 'Ukendt'}
                </p>
                {event.source === 'aula' && (
                  <span className="text-xs text-indigo-600 font-semibold">
                    {event.feedLabel ?? 'Kalender'}
                  </span>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 leading-snug">{event.title}</h2>
          </div>

          {/* Details */}
          <div className="px-5 py-5 space-y-4">
            <Row icon={<Clock size={17} className="text-gray-400" />}>
              <span className="font-semibold text-gray-900 capitalize">{dateStr}</span>
              <span className="text-gray-500 text-sm">{timeStr}</span>
            </Row>
            {event.location && (
              <Row icon={<MapPin size={17} className="text-gray-400" />}>
                <span className="text-gray-800">{event.location}</span>
              </Row>
            )}
            {event.transport && (
              <Row icon={<Truck size={17} className="text-gray-400" />}>
                <span className="text-gray-800">{event.transport}</span>
              </Row>
            )}
            {event.description && (
              <p className="text-gray-600 leading-relaxed pl-7">{event.description}</p>
            )}
          </div>

          {/* Actions */}
          {canEdit ? (
            <div className="px-5 pb-4 pt-1 flex gap-3">
              <a
                href={`/tilfoej?edit=${event.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil size={15} />
                Rediger
              </a>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                  confirming
                    ? 'bg-red-500 text-white'
                    : 'border-2 border-gray-200 text-red-500 hover:bg-red-50'
                }`}
              >
                <Trash2 size={15} />
                {confirming ? 'Bekræft sletning' : 'Slet'}
              </button>
            </div>
          ) : (
            <div className="pb-2" />
          )}
          {/* Spacer so content clears the fixed bottom nav on mobile */}
          <div className="h-16 sm:h-0 flex-shrink-0" />
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
