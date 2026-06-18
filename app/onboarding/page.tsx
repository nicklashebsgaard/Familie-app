import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (profile?.family_id) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">📅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Velkommen!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Du er ikke tilknyttet en familie endnu.
          Bed et familiemedlem om at sende dig et invitationslink.
        </p>
        <p className="text-xs text-gray-400">
          Invitationslinks ser sådan ud:<br />
          <span className="font-mono">familiekalender.dk/join/…</span>
        </p>
      </div>
    </div>
  )
}
