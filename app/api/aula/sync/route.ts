import { createServiceClient } from '@/lib/supabase/service'
import { parseIcsToEvents } from '@/lib/ical'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: feeds, error: feedsError } = await supabase
    .from('aula_feeds')
    .select('*')

  if (feedsError) {
    return NextResponse.json({ error: feedsError.message }, { status: 500 })
  }

  if (!feeds || feeds.length === 0) {
    return NextResponse.json({ message: 'No feeds configured', synced: 0 })
  }

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const response = await fetch(feed.ics_url, {
          headers: { 'User-Agent': 'FamilieKalender/1.0' },
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${feed.ics_url}`)
        }

        const icsText = await response.text()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const managedMemberId = (feed as any).managed_member_id ?? null
        const parsed = parseIcsToEvents(icsText, feed.family_id, feed.user_id, managedMemberId)

        if (parsed.length > 0) {
          // Upsert events — on conflict (family_id, aula_uid) update title/times
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertError } = await (supabase.from('events') as any).upsert(
            parsed,
            { onConflict: 'family_id,aula_uid', ignoreDuplicates: false }
          )
          if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`)
        }

        // Delete events that are no longer in the feed (removed from Aula)
        const fetchedUids = parsed.map((e) => e.aula_uid)
        if (fetchedUids.length > 0) {
          await supabase
            .from('events')
            .delete()
            .eq('user_id', feed.user_id)
            .eq('source', 'aula')
            .not('aula_uid', 'in', `(${fetchedUids.map((u) => `"${u}"`).join(',')})`)
        } else {
          // Feed is empty — delete all aula events for this user
          await supabase
            .from('events')
            .delete()
            .eq('user_id', feed.user_id)
            .eq('source', 'aula')
        }

        // Update sync metadata
        await supabase
          .from('aula_feeds')
          .update({
            last_synced_at: new Date().toISOString(),
            last_event_count: parsed.length,
            last_error: null,
          })
          .eq('id', feed.id)

        return { id: feed.id, child: feed.child_name, count: parsed.length }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await supabase
          .from('aula_feeds')
          .update({ last_error: message })
          .eq('id', feed.id)
        throw err
      }
    })
  )

  const successes = results.filter((r) => r.status === 'fulfilled').length
  const failures = results.filter((r) => r.status === 'rejected').length

  return NextResponse.json({
    synced: successes,
    failed: failures,
    total: feeds.length,
    details: results.map((r, i) =>
      r.status === 'fulfilled'
        ? { feed: feeds[i].child_name, status: 'ok', count: (r.value as {count: number}).count }
        : { feed: feeds[i].child_name, status: 'error', error: (r.reason as Error).message }
    ),
  })
}
