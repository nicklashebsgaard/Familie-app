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
          <h1 className="text-xl font-bold text-gray-900">Kalenderfeeds</h1>
          {totalFeeds > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {totalFeeds} feed{totalFeeds !== 1 ? 's' : ''} · {totalEvents} begivenheder i alt
            </p>
          )}
        </div>
        {isAdmin && <ManualSyncButton />}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600 text-sm font-medium">Ingen feeds tilføjet</p>
          {isAdmin ? (
            <p className="text-gray-400 text-xs mt-1">Tilføj feeds under Indstillinger.</p>
          ) : (
            <p className="text-gray-400 text-xs mt-1">Bed en admin om at tilføje feeds.</p>
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
                <h2 className="text-sm font-semibold text-gray-700">{group.name}</h2>
                <span className="text-xs text-gray-400">
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

      <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-semibold mb-1">Automatisk sync</p>
        <p>
          Kalenderne hentes automatisk hver time. Begivenheder vises med det samme på alle enheder.
        </p>
      </div>
    </div>
  )
}
