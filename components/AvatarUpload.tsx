'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import Avatar from './Avatar'

interface Props {
  targetId: string
  targetType: 'user' | 'managed'
  name: string
  color: string
  avatarUrl?: string | null
  uploadAction: (formData: FormData) => Promise<void>
}

export default function AvatarUpload({
  targetId,
  targetType,
  name,
  color,
  avatarUrl,
  uploadAction,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const url = URL.createObjectURL(file)
    setPreview(url)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('target_id', targetId)
    fd.append('target_type', targetType)

    startTransition(() => uploadAction(fd))
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="relative group flex-shrink-0"
      title="Skift billede"
    >
      <Avatar
        name={name}
        color={color}
        avatarUrl={preview ?? avatarUrl}
        size={36}
        className={pending ? 'opacity-60' : ''}
      />
      <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera size={14} className="text-white" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
    </button>
  )
}
