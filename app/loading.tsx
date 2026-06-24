// Skeleton shown while the main calendar page loads
export default function Loading() {
  return (
    <div className="pt-4 px-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="text-center space-y-1">
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mx-auto" />
          <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mx-auto" />
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
      </div>

      {/* 7-column day grid skeleton */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            {/* Day abbr */}
            <div className="h-3 w-6 bg-gray-200 rounded animate-pulse" />
            {/* Day number circle */}
            <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
            {/* Month abbr */}
            <div className="h-3 w-5 bg-gray-200 rounded animate-pulse" />
            {/* Weather */}
            <div className="h-10 w-full flex flex-col items-center gap-1 mt-1">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-4 bg-gray-200 rounded animate-pulse" />
            </div>
            {/* Event pills */}
            {[1, 2, 0, 1, 2, 1, 0][i] > 0 &&
              Array.from({ length: [1, 2, 0, 1, 2, 1, 0][i] }).map((_, si) => (
                <div
                  key={si}
                  className={`w-full rounded-lg bg-gray-200 animate-pulse ${si === 0 ? 'h-7' : 'h-5 opacity-50'}`}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
