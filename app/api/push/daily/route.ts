import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'
import { format, startOfDay, endOfDay } from 'date-fns'
import { da } from 'date-fns/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const { data: events } = await supabase
      .from('events')
      .select('title, start_at, all_day')
      .eq('family_id', user.family_id)
      .gte('start_at', todayStart)
      .lte('start_at', todayEnd)
      .order('start_at')

    if (!events?.length) continue

    const lines = events.map((e) => {
      const time = e.all_day ? 'Hele dagen' : format(new Date(e.start_at), 'HH:mm', { locale: da })
      return `${time} – ${e.title}`
    })

    await sendPushToUser(subs, {
      title: `God morgen, ${user.name}! 📅`,
      body: lines.slice(0, 4).join('\n') + (lines.length > 4 ? `\n+${lines.length - 4} mere` : ''),
      url: '/',
    })
    sent++
  }

  return NextResponse.json({ sent })
}
