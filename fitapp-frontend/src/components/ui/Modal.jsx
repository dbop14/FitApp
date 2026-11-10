import React, { useEffect, useId } from 'react'
import Icon from './Icon'

/**
 * Modal: bottom sheet on phones, centered dialog from `sm` up.
 * Props: isOpen, onClose, title, icon (Icon name), children, footer, size ('sm' | 'md' | 'lg'),
 * dismissable (backdrop / Escape close; default true).
 */
const SIZE = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

const Modal = ({ isOpen, onClose, title, icon, children, footer, size = 'md', dismissable = true, className = '' }) => {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable && onClose) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose, dismissable])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={dismissable ? onClose : undefined} role="presentation">
      <div
        className={`modal-panel ${SIZE[size] || SIZE.md} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-5 py-4">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <Icon name={icon} className="h-5 w-5" />
              </span>
            )}
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">
              {title}
            </h2>
            {onClose && (
              <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
                <Icon name="x" className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-4 pb-[calc(1rem+var(--safe-area-bottom))] sm:flex-row sm:justify-end sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
