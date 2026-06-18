import AppShell from '@/components/AppShell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeeklyCalendar from '@/components/WeeklyCalendar'
import {
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
} from 'date-fns'
import type { CalendarEvent, FamilyMember, ManagedMember } from '@/lib/types'

function mapEvent(
  row: Record<string, unknown>,
  member: FamilyMember | undefined,
  managedMember: ManagedMember | undefined,
): CalendarEvent {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    userId: row.user_id as string,
    managedMemberId: row.managed_member_id as string | undefined,
    title: row.title as string,
    description: row.description as string | undefined,
    location: row.location as string | undefined,
    startAt: parseISO(row.start_at as string),
    endAt: parseISO(row.end_at as string),
    allDay: row.all_day as boolean,
    source: row.source as 'manual' | 'aula',
    aulaUid: row.aula_uid as string | undefined,
    transport: row.transport as string | undefined,
    member,
    managedMember,
  }
}

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Middleware handles this redirect, but type safety requires the check
    return null
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, color, role, email, family_id')
    .eq('id', user.id)
    .single()

  // New user — no profile or no family yet
  if (!profile || !profile.family_id) {
    redirect('/onboarding')
  }

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  // Fetch events + family members + managed members in parallel
  const [eventsResult, membersResult, managedResult] = await Promise.all([
    profile?.family_id
      ? supabase
          .from('events')
          .select('*')
          .eq('family_id', profile.family_id)
          .gte('start_at', weekStart.toISOString())
          .lte('start_at', weekEnd.toISOString())
          .order('start_at')
      : { data: [] },
    profile?.family_id
      ? supabase
          .from('users')
          .select('id, name, color, role, email, avatar_url')
          .eq('family_id', profile.family_id)
      : { data: [] },
    profile?.family_id
      ? supabase
          .from('managed_members')
          .select('id, name, color, family_id, avatar_url')
          .eq('family_id', profile.family_id)
      : { data: [] },
  ])

  const membersMap = new Map<string, FamilyMember>(
    (membersResult.data ?? []).map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        color: m.color,
        role: m.role as 'admin' | 'member' | 'guest',
        email: m.email,
        avatarUrl: m.avatar_url,
      },
    ])
  )

  const managedMap = new Map<string, ManagedMember>(
    (managedResult.data ?? []).map((m) => [
      m.id,
      { id: m.id, name: m.name, color: m.color, familyId: m.family_id, avatarUrl: m.avatar_url },
    ])
  )

  const events: CalendarEvent[] = (eventsResult.data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return mapEvent(
      r,
      membersMap.get(row.user_id),
      r.managed_member_id ? managedMap.get(r.managed_member_id as string) : undefined,
    )
  })

  const members = Array.from(membersMap.values())
  const managedMembers = Array.from(managedMap.values())
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <AppShell>
      <WeeklyCalendar
        initialEvents={events}
        members={members}
        managedMembers={managedMembers}
        weekDays={weekDays}
        familyId={profile?.family_id ?? null}
        currentUserId={user.id}
      />
    </AppShell>
  )
}
