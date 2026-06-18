'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function signInWithGoogle() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  })
  if (error) redirect('/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}

export async function signInWithApple() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  })
  if (error) redirect('/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) redirect('/login?error=email_required')

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
  })

  if (error) redirect('/login?error=magic_link_failed')
  // Always show success — prevents email enumeration
  redirect('/login?message=check_email')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
