import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next =
    searchParams.get('next') ??
    request.cookies.get('post-login-redirect')?.value ??
    '/'

  const supabase = createClient()

  const redirectTo = NextResponse.redirect(`${origin}${next}`)
  redirectTo.cookies.delete('post-login-redirect')

  // PKCE flow (OAuth + magic link on same browser)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      await ensureProfile(data.user.id, data.user.email!, data.user.user_metadata?.full_name)
      return redirectTo
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error?.message)
  }

  // Token hash flow (magic link on different browser/device)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error && data.user) {
      await ensureProfile(data.user.id, data.user.email!, data.user.user_metadata?.full_name)
      return redirectTo
    }
    console.error('[auth/callback] verifyOtp error:', error?.message)
  }

  console.error('[auth/callback] both flows failed — code:', !!code, 'token_hash:', !!token_hash, 'type:', type)
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

// Uses service role to bypass RLS — new users have no row yet so RLS blocks their own INSERT
async function ensureProfile(userId: string, email: string, fullName?: string) {
  const service = createServiceClient()
  await service.from('users').upsert(
    {
      id: userId,
      email,
      name: fullName ?? email.split('@')[0],
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}
