import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import { format, startOfDay, endOfDay } from 'date-fns'
import { da } from 'date-fns/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Runs daily at 7am — sends a reminder for the first event of the day per user
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const todayEnd = endOfDay(now).toISOString()

  const { data: users } = await supabase
    .from('users')
    .select('id, name, family_id, push_subscriptions(endpoint, p256dh, auth)')

  if (!users) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const user of users) {
    const subs = (user.push_subscriptions as { endpoint: string; p256dh: string; auth: string }[]) ?? []
    if (!subs.length || !user.family_id) continue

    // Find the first timed event today for this family
    const { data: events } = await supabase
      .from('events')
      .select('title, start_at')
      .eq('family_id', user.family_id)
      .eq('all_day', false)
      .gte('start_at', todayStart)
      .lte('start_at', todayEnd)
      .order('start_at')
      .limit(3)

    if (!events?.length) continue

    const lines = events.map((e) => {
      const time = format(new Date(e.start_at), 'HH:mm', { locale: da })
      return `${time} – ${e.title}`
    })

    await sendPushToUser(subs, {
      title: `Påmindelse: Dagens aftaler ⏰`,
      body: lines.join('\n'),
      url: '/',
    })
    sent++
  }

  return NextResponse.json({ sent })
}
