import React from 'react';

/**
 * InfoBox Component - Information display with type variants
 * 
 * Features:
 * - Multiple type variants (info, success, warning, error)
 * - Optional title and icon
 * - Tailwind-based styling
 * 
 * Props:
 * @param {string} type - Box type: 'info', 'success', 'warning', 'error'
 * @param {React.ReactNode} children - Content to display
 * @param {string} className - Additional CSS classes
 * @param {string} title - Optional title text
 * @param {string} icon - Optional icon emoji
 */
const InfoBox = ({ 
  type = 'info', 
  children, 
  className = '',
  title,
  icon
}) => {
  // Type variants with corresponding Tailwind classes
  const typeClasses = {
    info: {
      container: 'bg-blue-500 border border-blue-600 text-white',
      icon: 'text-white'
    },
    success: {
      container: 'bg-green-50 border border-green-200 text-green-800',
      icon: 'text-green-600'
    },
    warning: {
      container: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
      icon: 'text-yellow-600'
    },
    error: {
      container: 'bg-red-50 border border-red-200 text-red-800',
      icon: 'text-red-600'
    }
  };

  const currentType = typeClasses[type] || typeClasses.info;

  return (
    <div className={`${currentType.container} rounded-xl p-4 mt-6 ${className}`}>
      {title && (
        <p className="text-sm font-medium mb-2">
          {icon && <span className={`mr-2 ${currentType.icon}`}>{icon}</span>}
          {title}
        </p>
      )}
      <div className="text-xs">
        {children}
      </div>
    </div>
  );
};

export default InfoBox;
