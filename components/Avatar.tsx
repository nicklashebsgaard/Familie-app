interface Props {
  name: string
  color: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

export default function Avatar({ name, color, avatarUrl, size = 32, className = '' }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </div>
  )
}
