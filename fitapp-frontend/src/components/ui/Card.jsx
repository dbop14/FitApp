import React from 'react'

/**
 * Card
 * variant: 'surface' (default, neutral card) | 'brand' (blue gradient highlight).
 * Legacy variants 'primary' map to brand; 'light' and 'deep' map to surface.
 * When onClick is given the card is keyboard accessible.
 */
const VARIANT_CLASS = {
  surface: 'card',
  brand: 'card-brand',
  primary: 'card-brand',
  light: 'card',
  deep: 'card',
}

const Card = ({ variant = 'surface', padded = true, children, className = '', onClick, ariaLabel, ...props }) => {
  const interactive = typeof onClick === 'function'
  const handleKeyDown = (e) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick(e)
    }
  }
  return (
    <div
      className={`${VARIANT_CLASS[variant] || 'card'} ${padded ? 'card-pad' : ''} ${
        interactive ? 'card-interactive cursor-pointer' : ''
      } ${className}`}
      {...(interactive && {
        onClick,
        onKeyDown: handleKeyDown,
        tabIndex: 0,
        role: 'button',
        'aria-label': ariaLabel,
      })}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
