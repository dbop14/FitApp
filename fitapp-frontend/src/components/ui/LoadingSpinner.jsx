import React from 'react'

/**
 * LoadingSpinner
 * size: 'sm' | 'md' | 'lg' | 'xl'; color: 'primary' | 'white'
 */
const SIZES = { sm: 'h-5 w-5 border-2', md: 'h-8 w-8 border-[3px]', lg: 'h-12 w-12 border-4', xl: 'h-16 w-16 border-4' }

const LoadingSpinner = ({ size = 'md', color = 'primary', className = '', showText = false, text = 'Loading...' }) => (
  <div className={`flex flex-col items-center ${className}`} role="status" aria-live="polite">
    <span
      className={`inline-block animate-spin rounded-full ${SIZES[size] || SIZES.md} ${
        color === 'white' ? 'border-white border-t-transparent' : 'border-blue-500 border-t-transparent'
      }`}
    />
    {showText ? <p className="mt-3 text-sm text-ink-muted">{text}</p> : <span className="sr-only">{text}</span>}
  </div>
)

export default LoadingSpinner
