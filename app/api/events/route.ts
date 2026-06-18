import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // Non-admins can only create events for themselves
  if (profile?.role !== 'admin' && body.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      family_id: body.family_id,
      user_id: body.user_id,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      transport: body.transport ?? null,
      start_at: body.start_at,
      end_at: body.end_at,
      all_day: body.all_day ?? false,
      recurring: body.recurring ?? null,
      source: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
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
