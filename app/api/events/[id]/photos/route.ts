import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

async function getAuthedProfile(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('family_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.family_id) return null
  return { user, profile }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const auth = await getAuthedProfile(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const familyId = auth.profile.family_id!
  const { data, error } = await supabase
    .from('event_photos')
    .select('id, storage_path, created_at, uploaded_by')
    .eq('event_id', params.id)
    .eq('family_id', familyId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const service = createServiceClient()
  const photos = (data ?? []).map((p) => ({
    ...p,
    url: service.storage.from('event-photos').getPublicUrl(p.storage_path).data.publicUrl,
  }))

  return NextResponse.json(photos)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const auth = await getAuthedProfile(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Ingen fil' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Kun billeder er tilladt' }, { status: 400 })
  }

  const familyId = auth.profile.family_id!
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${familyId}/${params.id}/${randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('event-photos')
    .upload(path, bytes, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: dbError } = await service.from('event_photos').insert({
    event_id: params.id,
    family_id: familyId,
    uploaded_by: auth.user.id,
    storage_path: path,
  })

  if (dbError) {
    await service.storage.from('event-photos').remove([path])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('event-photos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, path }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const auth = await getAuthedProfile(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const photoId = searchParams.get('photoId')
  if (!photoId) return NextResponse.json({ error: 'Mangler photoId' }, { status: 400 })

  const service = createServiceClient()
  const { data: photo } = await service
    .from('event_photos')
    .select('storage_path, uploaded_by')
    .eq('id', photoId)
    .eq('event_id', params.id)
    .single()

  if (!photo) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })

  const canDelete =
    photo.uploaded_by === auth.user.id || auth.profile.role === 'admin'
  if (!canDelete) return NextResponse.json({ error: 'Forbudt' }, { status: 403 })

  await service.from('event_photos').delete().eq('id', photoId)
  await service.storage.from('event-photos').remove([photo.storage_path])

  return new NextResponse(null, { status: 204 })
}
