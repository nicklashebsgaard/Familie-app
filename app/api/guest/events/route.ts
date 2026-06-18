import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceClient()

  // Validate the token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link, error: linkError } = await (supabase as any)
    .from('guest_links')
    .select('id, family_id, expires_at, date_from, date_to')
    .eq('token', token)
    .single()

  if (linkError || !link) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  // Build events query with optional date range
  let query = supabase
    .from('events')
    .select(`
      id, title, description, location, transport, start_at, end_at, all_day,
      participants,
      users!events_user_id_fkey(id, name, color, avatar_url)
    `)
    .eq('family_id', link.family_id)
    .order('start_at', { ascending: true })

  if (link.date_from) {
    query = query.gte('start_at', link.date_from)
  }
  if (link.date_to) {
    // Include events that start before end of date_to
    query = query.lte('start_at', link.date_to + 'T23:59:59')
  }

  const { data: events, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    events: events ?? [],
    date_from: link.date_from,
    date_to: link.date_to,
  })
}
