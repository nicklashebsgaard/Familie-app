import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JoinForm from './JoinForm'

interface Props {
  params: { token: string }
}

export default async function JoinPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join/${params.token}`)
  }

  const { data: tokenRow } = await supabase
    .from('invite_tokens')
    .select('id, family_id, expires_at, used_at, families(name)')
    .eq('token', params.token)
    .single()

  if (!tokenRow) {
    return <ErrorCard icon="❌" title="Ugyldigt link" body="Dette invitationslink er ikke gyldigt." />
  }

  const expired = new Date(tokenRow.expires_at) < new Date()
  const used = !!tokenRow.used_at

  if (expired || used) {
    return (
      <ErrorCard
        icon="⏰"
        title="Link udløbet"
        body={`Dette invitationslink er ${used ? 'allerede brugt' : 'udløbet'}. Bed en admin om at generere et nyt.`}
      />
    )
  }

  const { data: currentProfile } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (currentProfile?.family_id) {
    return (
      <ErrorCard icon="ℹ️" title="Allerede tilmeldt" body="Du er allerede tilknyttet en familie.">
        <a href="/" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">
          Gå til kalender
        </a>
      </ErrorCard>
    )
  }

  const familyName = (tokenRow.families as { name?: string } | null)?.name ?? 'Familien'
  const defaultName =
    user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
      <JoinForm
        token={params.token}
        tokenId={tokenRow.id}
        familyId={tokenRow.family_id}
        familyName={familyName}
        defaultName={defaultName}
      />
    </div>
  )
}

function ErrorCard({
  icon,
  title,
  body,
  children,
}: {
  icon: string
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 text-sm">{body}</p>
        {children}
      </div>
    </div>
  )
}
