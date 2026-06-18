import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Ensure profile row exists — upsert on first login
        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email!,
            name:
              user.user_metadata?.full_name ??
              user.email!.split('@')[0],
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
