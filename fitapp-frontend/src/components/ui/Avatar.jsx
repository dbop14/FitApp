import { useState } from 'react'

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-3xl',
}

const initials = (name) => {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

// Profile picture with an initials fallback on the brand gradient.
const Avatar = ({ src, name, size = 'md', className = '', ring = false }) => {
  const [failed, setFailed] = useState(false)
  const showImg = src && !failed
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZES[size] || SIZES.md} ${
        ring ? 'ring-2 ring-white dark:ring-[rgb(var(--surface))]' : ''
      } ${showImg ? 'bg-surface-2' : 'bg-gradient-to-br from-blue-400 to-blue-700 text-white'} ${className}`}
    >
      {showImg ? (
        <img
          src={src}
          alt={name || ''}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  )
}

export default Avatar
