import { signInWithGoogle, signInWithApple, signInWithMagicLink } from './actions'

interface Props {
  searchParams: { error?: string; message?: string }
}

export default function LoginPage({ searchParams }: Props) {
  const errorMessages: Record<string, string> = {
    auth_failed: 'Login mislykkedes. Prøv igen.',
    oauth_failed: 'OAuth-login mislykkedes. Prøv igen.',
    magic_link_failed: 'Kunne ikke sende magic link. Prøv igen.',
    email_required: 'Indtast venligst din e-mailadresse.',
  }

  const error = searchParams.error ? errorMessages[searchParams.error] : null
  const message =
    searchParams.message === 'check_email'
      ? 'Tjek din e-mail — vi har sendt dig et login-link.'
      : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📅</div>
          <h1 className="text-2xl font-bold text-gray-900">Familie Kalender</h1>
          <p className="text-gray-500 text-sm mt-1">Log ind for at se familiens kalender</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {message}
          </div>
        )}

        <div className="space-y-3">
          {/* Google */}
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Fortsæt med Google
            </button>
          </form>

          {/* Apple */}
          <form action={signInWithApple}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black rounded-xl text-white font-medium hover:bg-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              Fortsæt med Apple
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">eller</span>
            </div>
          </div>

          {/* Magic link */}
          <form action={signInWithMagicLink} className="space-y-2">
            <input
              type="email"
              name="email"
              placeholder="din@email.dk"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Send magic link
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
