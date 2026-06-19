import MagicLinkForm from './MagicLinkForm'

interface Props {
  searchParams: { error?: string; next?: string }
}

export default function LoginPage({ searchParams }: Props) {
  const errorMessages: Record<string, string> = {
    auth_failed: 'Login mislykkedes. Prøv igen.',
    oauth_failed: 'OAuth-login mislykkedes. Prøv igen.',
    magic_link_failed: 'Kunne ikke sende login-kode. Prøv igen.',
    email_required: 'Indtast venligst din e-mailadresse.',
  }

  const error = searchParams.error ? errorMessages[searchParams.error] : null
  const next = searchParams.next ?? '/'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📅</div>
          <h1 className="text-2xl font-bold text-gray-900">Familie Kalender</h1>
          <p className="text-gray-500 text-sm mt-1">Log ind med din e-mailadresse</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <MagicLinkForm next={next} />
      </div>
    </div>
  )
}
