'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ManualSyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/aula/sync/manual', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResult(`Synkroniseret: ${data.synced}/${data.total} feeds`)
        router.refresh()
      } else {
        setResult(`Fejl: ${data.error}`)
      }
    } catch {
      setResult('Synkronisering mislykkedes')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Synkroniserer...' : 'Sync nu'}
      </button>
      {result && <p className="text-xs text-gray-500">{result}</p>}
    </div>
  )
}
