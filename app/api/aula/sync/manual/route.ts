import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseIcsToEvents } from '@/lib/ical'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only manual trigger for the Aula sync (not cron-protected)
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  const { data: feeds } = await serviceClient
    .from('aula_feeds')
    .select('*')
    .eq('family_id', profile.family_id)

  if (!feeds || feeds.length === 0) {
    return NextResponse.json({ message: 'No feeds', synced: 0, total: 0 })
  }

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetch(feed.ics_url, {
        headers: { 'User-Agent': 'FamilieKalender/1.0' },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const icsText = await response.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const managedMemberId = (feed as any).managed_member_id ?? null
      const parsed = parseIcsToEvents(icsText, feed.family_id, feed.user_id, managedMemberId)

      if (parsed.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (serviceClient.from('events') as any)
          .upsert(parsed, { onConflict: 'family_id,aula_uid', ignoreDuplicates: false })
      }

      const fetchedUids = parsed.map((e) => e.aula_uid)
      if (fetchedUids.length > 0) {
        await serviceClient
          .from('events')
          .delete()
          .eq('user_id', feed.user_id)
          .eq('source', 'aula')
          .not('aula_uid', 'in', `(${fetchedUids.map((u) => `"${u}"`).join(',')})`)
      }

      await serviceClient
        .from('aula_feeds')
        .update({
          last_synced_at: new Date().toISOString(),
          last_event_count: parsed.length,
          last_error: null,
        })
        .eq('id', feed.id)

      return parsed.length
    })
  )

  return NextResponse.json({
    synced: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    total: feeds.length,
  })
}
