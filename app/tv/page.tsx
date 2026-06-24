import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { startOfWeek, endOfWeek } from 'date-fns'
import TVCalendar from '@/components/TVCalendar'

export default async function TVPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) redirect('/')

  const [familyRes, membersRes, managedRes] = await Promise.all([
    supabase.from('families').select('name').eq('id', profile.family_id).single(),
    supabase.from('users').select('id, name, color, avatar_url').eq('family_id', profile.family_id),
    supabase.from('managed_members').select('id, name, color, avatar_url').eq('family_id', profile.family_id),
  ])

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('family_id', profile.family_id)
    .gte('start_at', weekStart.toISOString())
    .lte('start_at', weekEnd.toISOString())
    .order('start_at')

  return (
    <TVCalendar
      familyId={profile.family_id}
      familyName={familyRes.data?.name ?? 'Familiekalender'}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEvents={(events ?? []) as any[]}
      members={membersRes.data ?? []}
      managedMembers={managedRes.data ?? []}
    />
  )
}
