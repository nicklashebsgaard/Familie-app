'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateFamilyName(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase
    .from('families')
    .update({ name: name.trim() })
    .eq('id', profile.family_id)

  revalidatePath('/indstillinger')
}

export async function updateMemberColor(formData: FormData) {
  const memberId = formData.get('member_id') as string
  const color = formData.get('color') as string
  if (!memberId || !color) return

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  // Only admins can update other members' colors; members can update their own
  if (!profile?.family_id) return
  if (memberId !== user.id && profile.role !== 'admin') return

  await supabase.from('users').update({ color }).eq('id', memberId)
  revalidatePath('/indstillinger')
}

export async function updateMemberRole(formData: FormData) {
  const memberId = formData.get('member_id') as string
  const role = formData.get('role') as string
  if (!memberId || !role) return

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id || profile.role !== 'admin') return
  if (!['admin', 'member', 'guest'].includes(role)) return

  await supabase.from('users').update({ role: role as 'admin' | 'member' | 'guest' }).eq('id', memberId)
  revalidatePath('/indstillinger')
}

// Form actions must return void — the page re-renders via revalidatePath to show new tokens
export async function generateInviteLink(formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase
    .from('invite_tokens')
    .insert({
      family_id: profile.family_id,
      created_by: user.id,
    })

  revalidatePath('/indstillinger')
}

export async function addAulaFeed(formData: FormData) {
  const childName = formData.get('child_name') as string
  const icsUrl = formData.get('ics_url') as string
  const userId = formData.get('user_id') as string

  if (!childName || !icsUrl || !userId) return

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase.from('aula_feeds').upsert(
    {
      family_id: profile.family_id,
      user_id: userId,
      child_name: childName,
      ics_url: icsUrl,
    },
    { onConflict: 'family_id,user_id' }
  )

  revalidatePath('/indstillinger')
  revalidatePath('/aula')
}
