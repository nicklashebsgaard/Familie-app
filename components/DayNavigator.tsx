'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

interface Props {
  currentDate: string  // YYYY-MM-DD
  dateLabel: string    // pre-formatted by server (e.g. "Torsdag 19. juni")
  isToday: boolean
  children: React.ReactNode
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DayNavigator({ currentDate, dateLabel, isToday, children }: Props) {
  const router = useRouter()
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  function navigate(date: string) {
    router.push(`/dag?date=${date}`)
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return
    const dx = touchStartX - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 50 && dy < 60) {
      navigate(shiftDate(currentDate, dx > 0 ? 1 : -1))
    }
    setTouchStartX(null)
    setTouchStartY(null)
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(shiftDate(currentDate, -1))}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Forrige dag"
        >
          <ChevronLeft size={22} className="text-gray-600 dark:text-gray-400" />
        </button>

        <div className="text-center">
          {isToday && (
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">
              I dag
            </span>
          )}
          <h1 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{dateLabel}</h1>
        </div>

        <button
          onClick={() => navigate(shiftDate(currentDate, 1))}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Næste dag"
        >
          <ChevronRight size={22} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {children}

      {/* Floating add button */}
      <a
        href={`/tilfoej?date=${currentDate}`}
        className="fixed right-5 z-30 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        aria-label="Tilføj begivenhed"
      >
        <Plus size={26} className="text-white" />
      </a>
    </div>
  )
}
