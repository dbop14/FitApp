import React from 'react';
import { unifiedDesignSystem } from '../../config/unifiedDesignSystem';

/**
 * Button Component - Implements designSystem.components.forms.buttonPrimary/buttonSecondary
 * 
 * Features:
 * - Primary and secondary variants
 * - Consistent styling with design system
 * - Hover states and transitions
 * - Accessible button behavior
 * 
 * Props:
 * @param {string} variant - Button variant: 'primary', 'secondary'
 * @param {React.ReactNode} children - Button content
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disabled state
 * @param {string} size - Button size: 'sm', 'md', 'lg'
 * @param {string} type - Button type: 'button', 'submit', 'reset'
 */
const Button = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  disabled = false,
  size = 'md',
  type = 'button',
  ...props 
}) => {
  const baseClasses = variant === 'primary' 
    ? unifiedDesignSystem.components.forms.buttonPrimary.className
    : unifiedDesignSystem.components.forms.buttonSecondary.className;
  
  const hoverClasses = variant === 'primary' 
    ? unifiedDesignSystem.components.forms.buttonPrimary.hoverState
    : '';
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  const buttonClasses = `
    ${baseClasses} 
    ${hoverClasses} 
    ${sizeClasses[size]} 
    font-semibold 
    rounded-xl 
    transition-all 
    duration-200 
    focus:outline-none 
    focus:ring-2 
    focus:ring-blue-500 
    focus:ring-opacity-50
    disabled:opacity-50 
    disabled:cursor-not-allowed
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
