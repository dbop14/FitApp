import React from 'react';
import { unifiedDesignSystem } from '../../config/unifiedDesignSystem';

/**
 * Modal Component - Implements designSystem.components.modals
 * 
 * Features:
 * - Overlay with centered modal positioning
 * - Consistent structure: header + content + actions
 * - Close on overlay click or close button
 * - Accessible focus management
 * 
 * Props:
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Function to close the modal
 * @param {string} title - Modal title
 * @param {React.ReactNode} children - Modal content
 * @param {React.ReactNode} actions - Action buttons (optional)
 * @param {string} className - Additional CSS classes for modal container
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  actions,
  className = '' 
}) => {
  // Get modal classes directly from the design system
  const modalClasses = {
    overlay: unifiedDesignSystem.components.modals.overlay.className,
    container: unifiedDesignSystem.components.modals.container.className
  };
  
  // Close modal when Escape key is pressed
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay - designSystem.components.modals.overlay */}
      <div 
        className={modalClasses.overlay}
        onClick={onClose}
        role="presentation"
      >
        {/* Modal container - designSystem.components.modals.container */}
        <div 
          className={`${modalClasses.container} ${className}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header - designSystem.components.modals.header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-800">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <span className="text-2xl text-gray-500">×</span>
            </button>
          </div>

          {/* Content - designSystem.components.modals.content */}
          <div className="mb-6">
            {children}
          </div>

          {/* Actions - designSystem.components.modals.actions */}
          {actions && (
            <div className="flex space-x-3 mt-6">
              {actions}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Modal;
