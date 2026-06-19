'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function signInWithGoogle(formData: FormData) {
  const next = (formData.get('next') as string) || '/'
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) redirect('/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}

export async function signInWithApple(formData: FormData) {
  const next = (formData.get('next') as string) || '/'
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) redirect('/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  const next = (formData.get('next') as string) || '/'
  if (!email) redirect('/login?error=email_required')

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error) redirect('/login?error=magic_link_failed')
  redirect('/login?message=check_email')
}

// Called from client component — returns instead of redirecting
export async function sendLoginCode(email: string, next: string): Promise<{ error?: string }> {
  if (!email) return { error: 'email_required' }
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
