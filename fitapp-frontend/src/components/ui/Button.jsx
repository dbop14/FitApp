import React from 'react'

/**
 * Button
 * variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'on-brand'
 * size: 'sm' | 'md' | 'lg'
 */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'on-brand': 'btn-on-brand',
}

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

const Button = React.forwardRef(
  ({ variant = 'primary', size = 'md', type = 'button', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`btn ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] ?? ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
)

Button.displayName = 'Button'

export default Button
