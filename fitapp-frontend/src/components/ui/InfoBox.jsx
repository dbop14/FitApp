import React from 'react'
import Icon from './Icon'

/**
 * InfoBox: callout with an icon.
 * type: 'info' | 'success' | 'warning' | 'error'
 * icon: optional Icon name to override the default.
 */
const TYPES = {
  info: { cls: 'callout-info', icon: 'info' },
  success: { cls: 'callout-success', icon: 'check-circle' },
  warning: { cls: 'callout-warning', icon: 'alert' },
  error: { cls: 'callout-danger', icon: 'alert-circle' },
}

const InfoBox = ({ type = 'info', children, className = '', title, icon }) => {
  const t = TYPES[type] || TYPES.info
  return (
    <div className={`callout ${t.cls} ${className}`} role={type === 'error' ? 'alert' : undefined}>
      <Icon name={icon && typeof icon === 'string' && icon.length > 2 ? icon : t.icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  )
}

export default InfoBox
