import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 400 })

  const subscription = await request.json()

  // Replace any existing subscription for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('push_subscriptions').delete().eq('user_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('push_subscriptions').insert({
    user_id: user.id,
    family_id: profile.family_id,
    subscription,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
