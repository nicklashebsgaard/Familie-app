import { createClient } from '@/lib/supabase/server'
import AddEventForm from '@/components/AddEventForm'
import type { FamilyMember, ManagedMember, CalendarEvent } from '@/lib/types'
import { parseISO } from 'date-fns'

interface Props {
  searchParams: { edit?: string; date?: string }
}

export default async function TilfoejPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return (
      <div className="pt-6 text-center">
        <p className="text-gray-500">Du er ikke tilknyttet en familie endnu.</p>
      </div>
    )
  }

  const [membersRes, managedRes] = await Promise.all([
    supabase.from('users').select('id, name, color, role, email, avatar_url').eq('family_id', profile.family_id),
    supabase.from('managed_members').select('id, name, color, family_id, avatar_url').eq('family_id', profile.family_id),
  ])

  const members: FamilyMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id, name: m.name, color: m.color,
    role: m.role as 'admin' | 'member' | 'guest',
    email: m.email, avatarUrl: m.avatar_url,
  }))

  const managedMembers: ManagedMember[] = (managedRes.data ?? []).map((m) => ({
    id: m.id, name: m.name, color: m.color, familyId: m.family_id, avatarUrl: m.avatar_url,
  }))

  const membersMap = new Map(members.map((m) => [m.id, m]))
  const managedMap = new Map(managedMembers.map((m) => [m.id, m]))

  // Edit mode: load the existing event
  let editEvent: CalendarEvent | null = null
  if (searchParams.edit) {
    const { data: row } = await supabase
      .from('events')
      .select('*')
      .eq('id', searchParams.edit)
      .eq('family_id', profile.family_id)
      .single()

    if (row) {
      const r = row as Record<string, unknown>
      const rawParticipants = (r.participants as string[] | null) ?? []
      const participants = rawParticipants
        .map((pid) => {
          const [type, id] = pid.split(':')
          return type === 'auth' ? membersMap.get(id) : managedMap.get(id)
        })
        .filter(Boolean) as (FamilyMember | ManagedMember)[]

      editEvent = {
        id: row.id,
        familyId: row.family_id,
        userId: row.user_id,
        managedMemberId: row.managed_member_id ?? undefined,
        title: row.title,
        description: row.description ?? undefined,
        location: row.location ?? undefined,
        transport: row.transport ?? undefined,
        startAt: parseISO(row.start_at),
        endAt: parseISO(row.end_at),
        allDay: row.all_day,
        source: row.source as 'manual' | 'aula',
        participants: participants.length > 0 ? participants : undefined,
      }
    }
  }

  return (
    <div className="pt-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-5 px-1">
        {editEvent ? 'Rediger begivenhed' : 'Tilføj begivenhed'}
      </h1>
      <AddEventForm
        members={members}
        managedMembers={managedMembers}
        familyId={profile.family_id}
        currentUserId={user.id}
        editEvent={editEvent}
        defaultDate={searchParams.date}
      />
    </div>
  )
}
