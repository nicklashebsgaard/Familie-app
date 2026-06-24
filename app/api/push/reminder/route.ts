import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import { format, addMinutes } from 'date-fns'
import { da } from 'date-fns/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  // Find events starting 55–65 min from now (cron runs every 30 min, window catches each event once)
  const windowStart = addMinutes(now, 55).toISOString()
  const windowEnd = addMinutes(now, 65).toISOString()

  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_at, all_day, family_id, user_id, managed_member_id')
    .gte('start_at', windowStart)
    .lte('start_at', windowEnd)
    .eq('all_day', false)

  if (!events?.length) return NextResponse.json({ sent: 0 })

  // Group events by family so we only need one DB call per family
  const familyIds = Array.from(new Set(events.map((e) => e.family_id)))

  const { data: users } = await supabase
    .from('users')
    .select('id, name, family_id, push_subscriptions(endpoint, p256dh, auth)')
    .in('family_id', familyIds)

  if (!users) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const event of events) {
    const familyUsers = users.filter((u) => u.family_id === event.family_id)
    const time = format(new Date(event.start_at), 'HH:mm', { locale: da })

    for (const user of familyUsers) {
      const subs = (user.push_subscriptions as { endpoint: string; p256dh: string; auth: string }[]) ?? []
      if (!subs.length) continue

      await sendPushToUser(subs, {
        title: `Om 1 time: ${event.title} ⏰`,
        body: `Starter kl. ${time}`,
        url: '/',
      })
      sent++
    }
  }

  return NextResponse.json({ sent })
}
