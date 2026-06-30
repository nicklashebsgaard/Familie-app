'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock, Plus, Rss, Settings } from 'lucide-react'
import { format } from 'date-fns'

export default function BottomNav() {
  const pathname = usePathname()
  // Computed client-side so timezone is correct (server UTC ≠ user's local time)
  const todayHref = `/dag?date=${format(new Date(), 'yyyy-MM-dd')}`

  const navItems = [
    { href: '/',              label: 'Uge',          Icon: CalendarDays },
    { href: todayHref,        label: 'I dag',        Icon: Clock },
    { href: '/tilfoej',       label: 'Tilføj',       Icon: Plus },
    { href: '/aula',          label: 'Feeds',        Icon: Rss },
    { href: '/indstillinger', label: 'Indstillinger', Icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-50 safe-area-bottom">
      {navItems.map(({ href, label, Icon }) => {
        const active = pathname === href || (label === 'I dag' && pathname === '/dag')
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
              active ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span className="leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
