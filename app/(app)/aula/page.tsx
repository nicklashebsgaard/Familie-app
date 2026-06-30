import { createClient } from '@/lib/supabase/server'
import ManualSyncButton from '@/components/ManualSyncButton'
import FeedCard from '@/components/FeedCard'

interface Feed {
  id: string
  child_name: string
  ics_url: string
  last_synced_at: string | null
  last_event_count: number | null
  last_error: string | null
  user_id: string
  managed_member_id: string | null
}

interface PersonGroup {
  key: string
  name: string
  color: string
  feeds: Feed[]
}

export default async function FeedsPage() {
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

  const [feedsRes, membersRes, managedRes] = await Promise.all([
    profile?.family_id
      ? supabase
          .from('aula_feeds')
          .select('*')
          .eq('family_id', profile.family_id)
          .order('child_name')
      : Promise.resolve({ data: [] as Feed[] }),
    profile?.family_id
      ? supabase.from('users').select('id, name, color').eq('family_id', profile.family_id)
      : Promise.resolve({ data: [] }),
    profile?.family_id
      ? supabase
          .from('managed_members')
          .select('id, name, color')
          .eq('family_id', profile.family_id)
      : Promise.resolve({ data: [] }),
  ])

  const feeds = (feedsRes.data ?? []) as Feed[]
  const memberMap = new Map(
    ((membersRes.data ?? []) as { id: string; name: string; color: string }[]).map((m) => [m.id, m])
  )
  const managedMap = new Map(
    ((managedRes.data ?? []) as { id: string; name: string; color: string }[]).map((m) => [m.id, m])
  )
  const isAdmin = profile?.role === 'admin'

  // Group feeds by person (managed member or user)
  const groupMap = new Map<string, PersonGroup>()
  for (const feed of feeds) {
    const key = feed.managed_member_id
      ? `managed:${feed.managed_member_id}`
      : `user:${feed.user_id}`
    if (!groupMap.has(key)) {
      const person = feed.managed_member_id
        ? managedMap.get(feed.managed_member_id)
        : memberMap.get(feed.user_id)
      groupMap.set(key, {
        key,
        name: person?.name ?? feed.child_name,
        color: person?.color ?? '#6366f1',
        feeds: [],
      })
    }
    groupMap.get(key)!.feeds.push(feed)
  }
  const groups = Array.from(groupMap.values())

  const totalFeeds = feeds.length
  const totalEvents = feeds.reduce((sum, f) => sum + (f.last_event_count ?? 0), 0)

  return (
    <div className="pt-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kalenderfeeds</h1>
          {totalFeeds > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {totalFeeds} feed{totalFeeds !== 1 ? 's' : ''} · {totalEvents} begivenheder i alt
            </p>
          )}
        </div>
        {isAdmin && <ManualSyncButton />}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Ingen feeds tilføjet</p>
          {isAdmin ? (
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Tilføj feeds under Indstillinger.</p>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Bed en admin om at tilføje feeds.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{group.name}</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {group.feeds.length} feed{group.feeds.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {group.feeds.map((feed) => (
                  <FeedCard key={feed.id} feed={feed} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-400">
        <p className="font-semibold mb-1">Automatisk sync</p>
        <p>
          Kalenderne hentes automatisk hver time. Begivenheder vises med det samme på alle enheder.
        </p>
      </div>

      {/* Guide: how to get ICS URLs */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <details className="group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors select-none">
            <div className="flex items-center gap-2">
              <span className="text-base">❓</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sådan finder du din kalender-URL
              </span>
            </div>
            <svg
              className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">

            {/* Aula */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🏫</span>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Aula</h3>
              </div>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Log ind på <span className="font-mono text-indigo-600 dark:text-indigo-400">aula.dk</span></li>
                <li>Gå til <strong className="text-gray-700 dark:text-gray-300">Kalender</strong> i venstre menu</li>
                <li>Klik på tandhjulet (⚙️) øverst til højre i kalenderen</li>
                <li>Vælg <strong className="text-gray-700 dark:text-gray-300">Kalenderlink</strong> eller <strong className="text-gray-700 dark:text-gray-300">Eksportér</strong></li>
                <li>Kopiér URL&apos;en der slutter på <span className="font-mono text-indigo-600 dark:text-indigo-400">.ics</span> eller indeholder <span className="font-mono text-indigo-600 dark:text-indigo-400">feed=</span></li>
              </ol>
            </div>

            {/* Google Kalender */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📅</span>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Google Kalender</h3>
              </div>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Åbn <span className="font-mono text-indigo-600 dark:text-indigo-400">calendar.google.com</span> på en computer</li>
                <li>Klik på tandhjulet (⚙️) → <strong className="text-gray-700 dark:text-gray-300">Indstillinger</strong></li>
                <li>Klik på den ønskede kalender i venstre panel</li>
                <li>Scroll ned til <strong className="text-gray-700 dark:text-gray-300">Integrering af kalender</strong></li>
                <li>Kopiér <strong className="text-gray-700 dark:text-gray-300">Hemmelig adresse i iCal-format</strong></li>
              </ol>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Brug den <em>hemmelige</em> adresse — den offentlige virker ikke til privat indhold.
              </p>
            </div>

            {/* iCloud */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">☁️</span>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">iCloud Kalender</h3>
              </div>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Åbn <strong className="text-gray-700 dark:text-gray-300">Kalender</strong>-appen på din Mac</li>
                <li>Højreklik på kalenderen i sidepanelet</li>
                <li>Vælg <strong className="text-gray-700 dark:text-gray-300">Del kalender…</strong></li>
                <li>Sæt hak ved <strong className="text-gray-700 dark:text-gray-300">Offentlig kalender</strong></li>
                <li>Kopiér linket og udskift <span className="font-mono text-indigo-600 dark:text-indigo-400">webcal://</span> med <span className="font-mono text-indigo-600 dark:text-indigo-400">https://</span></li>
              </ol>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                Alternativt: icloud.com → Kalender → klik på delingsikonet ud for kalenderen.
              </p>
            </div>

          </div>
        </details>
      </div>

      <div className="pb-4" />
    </div>
  )
}
