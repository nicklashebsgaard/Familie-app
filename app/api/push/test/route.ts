import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToUser } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Temporary test endpoint — sends a push to all subscribed users
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, users(name)')

  if (!subs?.length) return NextResponse.json({ error: 'No subscriptions found' })

  let sent = 0
  for (const sub of subs) {
    try {
      await sendPushToUser([{ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }], {
        title: 'Test-notifikation ✅',
        body: 'Push-notifikationer virker korrekt!',
        url: '/',
      })
      sent++
    } catch (e) {
      return NextResponse.json({ error: String(e), sub: sub.endpoint.slice(-20) })
    }
  }

  return NextResponse.json({ sent, subscriptions: subs.length })
}
