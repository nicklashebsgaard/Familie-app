import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface Props {
  params: { token: string }
}

export default async function JoinPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in — redirect to login and come back
  if (!user) {
    redirect(`/login?next=/join/${params.token}`)
  }

  // Look up the invite token
  const { data: tokenRow } = await supabase
    .from('invite_tokens')
    .select('id, family_id, expires_at, used_at, families(name)')
    .eq('token', params.token)
    .single()

  if (!tokenRow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ugyldigt link</h1>
          <p className="text-gray-500 text-sm">Dette invitationslink er ikke gyldigt.</p>
        </div>
      </div>
    )
  }

  const expired = new Date(tokenRow.expires_at) < new Date()
  const used = !!tokenRow.used_at

  if (expired || used) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link udløbet</h1>
          <p className="text-gray-500 text-sm">
            Dette invitationslink er {used ? 'allerede brugt' : 'udløbet'}.
            Bed en admin om at generere et nyt.
          </p>
        </div>
      </div>
    )
  }

  const familyName = (tokenRow.families as { name?: string } | null)?.name ?? 'Familien'

  // If user already in a family, don't allow re-join
  const { data: currentProfile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (currentProfile?.family_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">ℹ️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Allerede tilmeldt</h1>
          <p className="text-gray-500 text-sm">
            Du er allerede tilknyttet en familie.
          </p>
          <a href="/" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">
            Gå til kalender
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">👨‍👩‍👧‍👦</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Bliv en del af {familyName}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Du er inviteret til familiekalenderen. Klik for at acceptere.
        </p>
        <form
          action={async () => {
            'use server'
            const supabase = createClient()
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (!user) return

            // Join the family
            await supabase
              .from('users')
              .update({ family_id: tokenRow.family_id })
              .eq('id', user.id)

            // Mark token as used
            await supabase
              .from('invite_tokens')
              .update({ used_at: new Date().toISOString() })
              .eq('id', tokenRow.id)

            redirect('/')
          }}
        >
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Acceptér invitation
          </button>
        </form>
      </div>
    </div>
  )
}
