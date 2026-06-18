import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from './BottomNav'
import InstallBanner from './InstallBanner'

export default async function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <main className="max-w-2xl mx-auto px-4">{children}</main>
      <BottomNav role={profile?.role ?? 'member'} />
      <InstallBanner />
    </div>
  )
}
