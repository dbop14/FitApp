import React from 'react'
import Card from './Card'
import Avatar from './Avatar'
import Icon from './Icon'

/**
 * UserCard: avatar, name and a short line, with optional right-side content.
 */
const UserCard = ({ name, picture, message, rightContent, onClick, className = '' }) => (
  <Card onClick={onClick} className={className} ariaLabel={onClick ? `Profile for ${name || 'user'}` : undefined}>
    <div className="flex items-center gap-4">
      <Avatar src={picture} name={name} size="xl" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-ink">{name || 'FitApp user'}</h2>
        {message && <p className="truncate text-sm text-ink-muted">{message}</p>}
      </div>
      {rightContent && <div className="flex shrink-0 items-center">{rightContent}</div>}
      {onClick && !rightContent && <Icon name="chevron-right" className="h-5 w-5 text-ink-subtle" />}
    </div>
  </Card>
)

export default UserCard
