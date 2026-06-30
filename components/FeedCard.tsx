'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, CheckCircle, AlertCircle, Clock, RefreshCw, X, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { da } from 'date-fns/locale'
import { updateAulaFeed, deleteAulaFeed } from '@/app/(app)/indstillinger/actions'

interface Feed {
  id: string
  child_name: string
  ics_url: string
  last_synced_at: string | null
  last_event_count: number | null
  last_error: string | null
}

function detectSource(url: string) {
  if (url.includes('aula.dk')) return 'Aula'
  if (url.includes('google.com')) return 'Google'
  if (url.includes('icloud.com') || url.includes('apple.com')) return 'iCloud'
  return 'Kalender'
}

const SOURCE_EMOJI: Record<string, string> = {
  Aula: '🏫',
  Google: '📅',
  iCloud: '☁️',
  Kalender: '📆',
}

export default function FeedCard({ feed, isAdmin }: { feed: Feed; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(feed.child_name)
  const [url, setUrl] = useState(feed.ics_url)
  const [isPending, startTransition] = useTransition()

  const source = detectSource(feed.ics_url)
  const hasError = !!feed.last_error
  const hasSynced = !!feed.last_synced_at
  const syncedAt = hasSynced
    ? format(parseISO(feed.last_synced_at!), "d. MMM 'kl.' HH:mm", { locale: da })
    : null

  function handleSave() {
    startTransition(async () => {
      await updateAulaFeed(feed.id, name, url)
      setEditing(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAulaFeed(feed.id)
    })
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-500">Navn</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">ICS URL</label>
            <textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-1.5 text-[11px] font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              <Check size={13} />
              Gem
            </button>
            <button
              onClick={() => { setEditing(false); setName(feed.child_name); setUrl(feed.ics_url) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg"
            >
              <X size={13} />
              Annuller
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5 flex-shrink-0">{SOURCE_EMOJI[source]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-gray-900 text-sm">{feed.child_name}</span>
                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{source}</span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5 max-w-[200px]">
                {feed.ics_url}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1.5">
                {syncedAt && (
                  <span className="flex items-center gap-1">
                    <RefreshCw size={10} />
                    {syncedAt}
                  </span>
                )}
                {feed.last_event_count !== null && (
                  <span>
                    {feed.last_event_count} begivenhed{feed.last_event_count !== 1 ? 'er' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
              {hasError ? (
                <AlertCircle size={15} className="text-red-400 mr-0.5" />
              ) : hasSynced ? (
                <CheckCircle size={15} className="text-green-400 mr-0.5" />
              ) : (
                <Clock size={15} className="text-gray-300 mr-0.5" />
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  {confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDelete}
                        disabled={isPending}
                        className="px-2 py-1 text-[11px] font-medium bg-red-500 text-white rounded-lg disabled:opacity-50"
                      >
                        Slet
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2 py-1 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg"
                      >
                        Nej
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {hasError && (
            <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-600">
              {feed.last_error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
