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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      <main className="max-w-5xl mx-auto px-4">{children}</main>
      <BottomNav />
      <InstallBanner />
    </div>
  )
}
