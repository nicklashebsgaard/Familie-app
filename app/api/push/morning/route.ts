import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs at 05:00, 06:00, 07:00, 08:00, 09:00 UTC (= 07:00–10:00 CEST / 06:00–09:00 CET)
// Each invocation computes current Danish hour and sends only to users who set that hour.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Compute current Danish hour — handles DST (CET/CEST) automatically
  const danishHour = parseInt(
    new Intl.DateTimeFormat('da-DK', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Copenhagen',
    }).format(now),
    10
  )

  // Today's date string in Copenhagen timezone (not UTC — avoids midnight boundary bugs)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
  }).format(now)

  // Fetch ±3h wide UTC range, then filter by Copenhagen date in JS (DST-safe)
  const rangeStart = new Date(todayStr + 'T00:00:00Z')
  rangeStart.setUTCHours(rangeStart.getUTCHours() - 3)
  const rangeEnd = new Date(todayStr + 'T23:59:59Z')
  rangeEnd.setUTCHours(rangeEnd.getUTCHours() + 3)

  const toCopenhagenDate = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date(iso))

  const supabase = createServiceClient()

  const { data: users } = await supabase
    .from('users')
    .select('id, name, family_id, push_subscriptions(endpoint, p256dh, auth)')
    .eq('push_hour', danishHour)

  if (!users?.length) return NextResponse.json({ sent: 0, hour: danishHour })

  // Fetch events once per unique family (avoids N+1)
  const uniqueFamilyIds = Array.from(new Set(
    users
      .filter((u) => u.family_id && (u.push_subscriptions as unknown[]).length)
      .map((u) => u.family_id!)
  ))
  const eventsByFamily = new Map<string, Array<{ title: string; start_at: string; all_day: boolean }>>()
  await Promise.all(
    uniqueFamilyIds.map(async (familyId) => {
      const { data } = await supabase
        .from('events')
        .select('title, start_at, all_day')
        .eq('family_id', familyId)
        .gte('start_at', rangeStart.toISOString())
        .lte('start_at', rangeEnd.toISOString())
        .order('start_at')
      // Filter to Copenhagen date to avoid cross-day contamination from wide range
      const todayEvents = (data ?? []).filter((e) => toCopenhagenDate(e.start_at) === todayStr)
      if (todayEvents.length) eventsByFamily.set(familyId, todayEvents)
    })
  )

  let sent = 0
  const allExpired: string[] = []

  for (const user of users) {
    const subs = (user.push_subscriptions as { endpoint: string; p256dh: string; auth: string }[]) ?? []
    if (!subs.length || !user.family_id) continue

    const events = eventsByFamily.get(user.family_id)
    if (!events?.length) continue

    const lines = events.map((e) => {
      const time = e.all_day ? 'Hele dagen' : format(new Date(e.start_at), 'HH:mm', { locale: da })
      return `${time} – ${e.title}`
    })

    const { expiredEndpoints } = await sendPushToUser(subs, {
      title: `God morgen, ${user.name}! 📅`,
      body: lines.slice(0, 4).join('\n') + (lines.length > 4 ? `\n+${lines.length - 4} mere` : ''),
      url: '/',
    })
    allExpired.push(...expiredEndpoints)
    sent++
  }

  // Clean up expired subscriptions (410 Gone) so they don't accumulate in the DB
  if (allExpired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', allExpired)
  }

  return NextResponse.json({ sent, hour: danishHour, cleaned: allExpired.length })
}
