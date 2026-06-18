import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { da } from 'date-fns/locale'
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import ManualSyncButton from '@/components/ManualSyncButton'

export default async function AulaPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  const { data: feeds } = profile?.family_id
    ? await supabase
        .from('aula_feeds')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('child_name')
    : { data: [] }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Aula-sync</h1>
        {isAdmin && <ManualSyncButton />}
      </div>

      {(!feeds || feeds.length === 0) ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600 text-sm font-medium">Ingen Aula-feeds tilføjet</p>
          {isAdmin ? (
            <p className="text-gray-400 text-xs mt-1">
              Tilføj Aula .ics-URL under Indstillinger.
            </p>
          ) : (
            <p className="text-gray-400 text-xs mt-1">
              Bed en admin om at tilføje Aula-feeds.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => {
            const hasError = !!feed.last_error
            const hasSynced = !!feed.last_synced_at
            const syncedAt = hasSynced
              ? format(parseISO(feed.last_synced_at!), "d. MMM 'kl.' HH:mm", { locale: da })
              : null

            return (
              <div
                key={feed.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{feed.child_name}</h3>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-[200px] mt-0.5">
                      {feed.ics_url}
                    </p>
                  </div>
                  {hasError ? (
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                  ) : hasSynced ? (
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <Clock size={20} className="text-gray-400 flex-shrink-0" />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  {syncedAt && (
                    <span className="flex items-center gap-1">
                      <RefreshCw size={11} />
                      Sidst hentet {syncedAt}
                    </span>
                  )}
                  {feed.last_event_count !== null && (
                    <span>
                      {feed.last_event_count} begivenhed
                      {feed.last_event_count !== 1 ? 'er' : ''}
                    </span>
                  )}
                </div>

                {hasError && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-600">
                    {feed.last_error}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-semibold mb-1">Automatisk sync</p>
        <p>
          Aula-kalenderen hentes automatisk hver time via en planlagt opgave.
          Begivenheder vises med det samme på alle enhederne.
        </p>
      </div>
    </div>
  )
}
