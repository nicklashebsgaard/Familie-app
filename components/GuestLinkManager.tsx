'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Trash2, Link, Plus } from 'lucide-react'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { da } from 'date-fns/locale'

interface GuestLink {
  id: string
  token: string
  label: string | null
  expires_at: string
  date_from: string | null
  date_to: string | null
  created_at: string
}

const DURATIONS = [
  { label: '1 uge', days: 7 },
  { label: '1 måned', days: 30 },
  { label: '3 måneder', days: 90 },
  { label: '1 år', days: 365 },
]

const DATE_RANGES = [
  { label: 'Alle datoer', value: 'all' },
  { label: 'Denne uge', value: 'week' },
  { label: 'Næste 2 uger', value: '2weeks' },
  { label: 'Næste måned', value: 'month' },
  { label: 'Valgfri', value: 'custom' },
]

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export default function GuestLinkManager() {
  const [links, setLinks] = useState<GuestLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [label, setLabel] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [dateRangeMode, setDateRangeMode] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/guest/links')
      .then((r) => r.json())
      .then((d) => { setLinks(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate() {
    setCreating(true)
    const now = new Date()
    const expires_at = addDays(now, durationDays).toISOString()

    let date_from: string | null = null
    let date_to: string | null = null

    if (dateRangeMode === 'week') {
      date_from = format(now, 'yyyy-MM-dd')
      date_to = format(addWeeks(now, 1), 'yyyy-MM-dd')
    } else if (dateRangeMode === '2weeks') {
      date_from = format(now, 'yyyy-MM-dd')
      date_to = format(addWeeks(now, 2), 'yyyy-MM-dd')
    } else if (dateRangeMode === 'month') {
      date_from = format(now, 'yyyy-MM-dd')
      date_to = format(addMonths(now, 1), 'yyyy-MM-dd')
    } else if (dateRangeMode === 'custom') {
      date_from = dateFrom || null
      date_to = dateTo || null
    }

    const res = await fetch('/api/guest/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || null, expires_at, date_from, date_to }),
    })

    if (res.ok) {
      const newLink = await res.json()
      setLinks((prev) => [newLink, ...prev])
      setLabel('')
      setDurationDays(30)
      setDateRangeMode('all')
      setDateFrom('')
      setDateTo('')
      setShowForm(false)
    }
    setCreating(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/guest/links?id=${id}`, { method: 'DELETE' })
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  function copyLink(link: GuestLink) {
    const url = `${siteUrl}/g/${link.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function formatExpiry(expires_at: string) {
    return format(new Date(expires_at), "d. MMM yyyy", { locale: da })
  }

  function formatDateRange(link: GuestLink) {
    if (!link.date_from && !link.date_to) return 'Alle datoer'
    const from = link.date_from ? format(new Date(link.date_from), 'd. MMM', { locale: da }) : '–'
    const to = link.date_to ? format(new Date(link.date_to), 'd. MMM yyyy', { locale: da }) : '–'
    return `${from} – ${to}`
  }

  const isExpired = (expires_at: string) => new Date(expires_at) < new Date()

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Gæstelinks
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700"
          >
            <Plus size={14} />
            Nyt link
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 space-y-3 border border-indigo-100 rounded-xl p-3 bg-indigo-50/40">
          {/* Label */}
          <input
            type="text"
            placeholder="Navn på linket (valgfrit)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Duration */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Gyldigt i</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  onClick={() => setDurationDays(d.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    durationDays === d.days
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Synlige datoer</p>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setDateRangeMode(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dateRangeMode === r.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {dateRangeMode === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                  placeholder="Fra"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                  placeholder="Til"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60 font-medium"
            >
              {creating ? 'Opretter…' : 'Opret link'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Annuller
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Indlæser…</p>
      ) : links.length === 0 ? (
        <div className="text-center py-4">
          <Link size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Ingen gæstelinks endnu</p>
          <p className="text-xs text-gray-300 mt-0.5">Opret et link og del det med familie eller venner</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const expired = isExpired(link.expires_at)
            return (
              <div
                key={link.id}
                className={`rounded-xl border p-3 ${expired ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {link.label ?? 'Gæstelink'}
                      {expired && <span className="ml-1.5 text-xs text-red-400 font-normal">udløbet</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateRange(link)} · Udløber {formatExpiry(link.expires_at)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {!expired && (
                      <button
                        onClick={() => copyLink(link)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Kopiér link"
                      >
                        {copiedId === link.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Slet"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {!expired && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      readOnly
                      value={`${siteUrl}/g/${link.token}`}
                      className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 font-mono truncate text-gray-500"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
