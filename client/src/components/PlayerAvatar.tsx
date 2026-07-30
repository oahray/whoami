import { useState } from 'react'
import { avatarSrc, isAvatarId } from '../lib/avatars'

type PlayerAvatarProps = {
  avatarId?: string | null
  nickname: string
  className?: string
  /** Tailwind size classes for the circle, e.g. size-12 */
  sizeClassName?: string
}

export default function PlayerAvatar({
  avatarId,
  nickname,
  className = '',
  sizeClassName = 'size-12'
}: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false)
  const initials = (nickname.trim().slice(0, 2) || '?').toUpperCase()
  const validId = isAvatarId(avatarId) ? avatarId : null
  const src = validId && !failed ? avatarSrc(validId) : null

  return (
    <div
      className={`${sizeClassName} rounded-full bg-surface-elevated flex items-center justify-center text-foreground-muted font-bold text-sm overflow-hidden shrink-0 ${className}`.trim()}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  )
}
