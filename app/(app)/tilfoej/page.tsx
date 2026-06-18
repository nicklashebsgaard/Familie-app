import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddEventForm from '@/components/AddEventForm'
import type { FamilyMember } from '@/lib/types'

export default async function TilfoejPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const { data: membersData } = await supabase
    .from('users')
    .select('id, name, color, role, email')
    .eq('family_id', profile.family_id)

  const members: FamilyMember[] = (membersData ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    role: m.role as 'admin' | 'member' | 'guest',
    email: m.email,
  }))

  return (
    <div className="pt-4">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Tilføj begivenhed</h1>
      <AddEventForm
        members={members}
        familyId={profile.family_id}
        currentUserId={user.id}
        isAdmin={profile.role === 'admin'}
      />
    </div>
  )
}
