import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import webpush from 'web-push'

function expandRecurring(baseEvent: Record<string, unknown>): Record<string, unknown>[] {
  const rec = baseEvent.recurring as { freq?: string; until?: string } | null
  if (!rec?.freq) return [baseEvent]

  const startAt = new Date(baseEvent.start_at as string)
  const endAt = new Date(baseEvent.end_at as string)
  const duration = endAt.getTime() - startAt.getTime()
  const until = rec.until
    ? new Date(rec.until)
    : new Date(startAt.getTime() + 365 * 24 * 60 * 60 * 1000)

  const events: Record<string, unknown>[] = []
  const cur = new Date(startAt)

  while (cur <= until && events.length < 200) {
    events.push({
      ...baseEvent,
      start_at: cur.toISOString(),
      end_at: new Date(cur.getTime() + duration).toISOString(),
    })
    if (rec.freq === 'WEEKLY') cur.setDate(cur.getDate() + 7)
    else if (rec.freq === 'MONTHLY') cur.setMonth(cur.getMonth() + 1)
    else if (rec.freq === 'YEARLY') cur.setFullYear(cur.getFullYear() + 1)
    else break
  }
  return events
}

async function sendFamilyPush(familyId: string, title: string, body: string) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@famille.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  const serviceClient = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (serviceClient as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('family_id', familyId)

  if (!subs?.length) return

  await Promise.all(
    (subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: '/' }),
        )
      } catch {
        // Subscription expired or invalid — remove it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (serviceClient as any).from('push_subscriptions').delete().eq('id', sub.id)
      }
    })
  )
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) return NextResponse.json([])

  let query = supabase
    .from('events')
    .select(`*, users(id, name, color)`)
    .eq('family_id', profile.family_id)
    .order('start_at')

  if (from) query = query.gte('start_at', from)
  if (to) query = query.lte('start_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Verify the user belongs to the requested family
  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.family_id !== body.family_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Non-admins can only create events for themselves (or their managed members)
  const isForManagedMember = !!body.managed_member_id
  if (profile?.role !== 'admin' && !isForManagedMember && body.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const baseRow = {
    family_id: body.family_id,
    user_id: body.user_id,
    managed_member_id: body.managed_member_id ?? null,
    participants: body.participants ?? [],
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    transport: body.transport ?? null,
    start_at: body.start_at,
    end_at: body.end_at,
    all_day: body.all_day ?? false,
    recurring: body.recurring ?? null,
    source: 'manual',
  }

  const rows = expandRecurring(baseRow as unknown as Record<string, unknown>)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('events') as any)
    .insert(rows.length === 1 ? rows[0] : rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const first = Array.isArray(data) ? data[0] : data

  // Send push notification to family (await so it completes before serverless fn exits)
  const dateLabel = body.start_at
    ? new Date(body.start_at).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  await sendFamilyPush(body.family_id, `Ny begivenhed: ${body.title}`, dateLabel).catch(() => {})

  return NextResponse.json(first, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })

  // RLS enforces write permissions — fetch will fail if not allowed
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing event id' }, { status: 400 })

  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
