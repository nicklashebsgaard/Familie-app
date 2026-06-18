'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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
export async function generateInviteLink(): Promise<void> {
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

export async function createManagedMember(formData: FormData): Promise<void> {
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  if (!name?.trim() || !color) return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('family_id, role').eq('id', user.id).single()
  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase.from('managed_members').insert({
    family_id: profile.family_id,
    name: name.trim(),
    color,
    created_by: user.id,
  })
  revalidatePath('/indstillinger')
}

export async function updateManagedMember(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  if (!id || !name?.trim() || !color) return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('family_id, role').eq('id', user.id).single()
  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase.from('managed_members')
    .update({ name: name.trim(), color })
    .eq('id', id)
    .eq('family_id', profile.family_id)
  revalidatePath('/indstillinger')
}

export async function uploadAvatar(formData: FormData): Promise<void> {
  const file = formData.get('file') as File
  const targetId = formData.get('target_id') as string
  const targetType = formData.get('target_type') as 'user' | 'managed'
  if (!file || !targetId || !targetType) return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('family_id, role').eq('id', user.id).single()
  if (!profile?.family_id) return
  // Only admins can set managed member avatars; users can only set their own
  if (targetType === 'managed' && profile.role !== 'admin') return
  if (targetType === 'user' && targetId !== user.id && profile.role !== 'admin') return

  const service = createServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = targetType === 'managed' ? `managed/${targetId}.${ext}` : `users/${targetId}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error } = await service.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) return

  const { data: { publicUrl } } = service.storage.from('avatars').getPublicUrl(path)

  if (targetType === 'user') {
    await service.from('users').update({ avatar_url: publicUrl }).eq('id', targetId)
  } else {
    await service.from('managed_members').update({ avatar_url: publicUrl }).eq('id', targetId)
  }

  revalidatePath('/indstillinger')
}

export async function deleteManagedMember(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('family_id, role').eq('id', user.id).single()
  if (!profile?.family_id || profile.role !== 'admin') return

  await supabase.from('managed_members')
    .delete()
    .eq('id', id)
    .eq('family_id', profile.family_id)
  revalidatePath('/indstillinger')
}

export async function addAulaFeed(formData: FormData) {
  const childName = formData.get('child_name') as string
  const icsUrl = formData.get('ics_url') as string
  const personValue = formData.get('user_id') as string

  if (!childName || !icsUrl || !personValue) return

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('family_id, role').eq('id', user.id).single()
  if (!profile?.family_id || profile.role !== 'admin') return

  const isManaged = personValue.startsWith('managed:')
  const managedMemberId = isManaged ? personValue.replace('managed:', '') : null
  const userId = isManaged ? user.id : personValue

  await supabase.from('aula_feeds').insert({
    family_id: profile.family_id,
    user_id: userId,
    managed_member_id: managedMemberId,
    child_name: childName,
    ics_url: icsUrl,
  })

  revalidatePath('/indstillinger')
  revalidatePath('/aula')
}
