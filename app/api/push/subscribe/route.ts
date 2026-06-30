import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let endpoint: string, p256dh: string, auth: string
  try {
    ;({ endpoint, p256dh, auth } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('users').select('family_id').eq('id', user.id).single()
  if (!profile?.family_id) return NextResponse.json({ error: 'No family' }, { status: 400 })

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, family_id: profile.family_id, endpoint, p256dh, auth },
    { onConflict: 'endpoint' }
  )

  if (error) return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let endpoint: string
  try {
    ;({ endpoint } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
