import React from 'react';

/**
 * Card Component - Now using Tailwind CSS classes
 * 
 * Features:
 * - Gradient variants (primary, light, deep)
 * - Consistent styling with design system
 * - Interactive states with hover effects
 * - Accessible button behavior when onClick is provided
 * 
 * Props:
 * @param {string} variant - Gradient variant: 'primary', 'light', 'deep'
 * @param {React.ReactNode} children - Card content
 * @param {string} className - Additional CSS classes
 * @param {function} onClick - Optional click handler (makes card interactive)
 * @param {string} role - ARIA role (defaults to 'button' if onClick provided)
 * @param {string} ariaLabel - Accessibility label
 */
const Card = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  onClick, 
  role = onClick ? 'button' : undefined,
  ariaLabel,
  ...props 
}) => {
  // Get gradient classes based on variant
  const getGradientClasses = (variant) => {
    const gradients = {
      primary: 'bg-gradient-to-r from-blue-500 to-blue-800',
      light: 'bg-gradient-to-r from-blue-400 to-blue-600',
      deep: 'bg-gradient-to-r from-blue-700 to-blue-900'
    };
    return gradients[variant] || gradients.primary;
  };
  
  const baseClasses = `${getGradientClasses(variant)} rounded-2xl p-6 text-white shadow-lg mb-4`;
  const isInteractive = !!onClick;
  
  const cardClasses = `${baseClasses} ${className} ${
    isInteractive 
      ? 'cursor-pointer transition-transform active:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50' 
      : ''
  }`;

  const handleKeyDown = (e) => {
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const cardProps = {
    className: cardClasses,
    ...(isInteractive && {
      onClick,
      onKeyDown: handleKeyDown,
      tabIndex: 0,
      role,
      'aria-label': ariaLabel,
    }),
    ...props
  };

  return (
    <div {...cardProps}>
      {children}
    </div>
  );
};

export default Card;
