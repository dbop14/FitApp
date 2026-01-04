import React from 'react';

/**
 * LoadingSpinner Component - Simple loading indicator
 * 
 * Features:
 * - Multiple size variants
 * - Optional text display
 * - Tailwind-based styling
 * 
 * Props:
 * @param {string} size - Spinner size: 'sm', 'md', 'lg', 'xl'
 * @param {string} color - Spinner color: 'primary', 'secondary', 'white'
 * @param {string} className - Additional CSS classes
 * @param {boolean} showText - Whether to show loading text
 * @param {string} text - Loading text to display
 */
const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary', 
  className = '',
  showText = false,
  text = 'Loading...'
}) => {
  // Size variants
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  // Color variants
  const colorClasses = {
    primary: 'border-blue-500',
    secondary: 'border-gray-400',
    white: 'border-white'
  };

  return (
    <div className={className}>
      <div className={`
        ${sizeClasses[size] || sizeClasses.md}
        border-2 border-gray-200 border-t-2 ${colorClasses[color] || colorClasses.primary}
        rounded-full animate-spin mx-auto
        ${showText ? 'mb-4' : ''}
      `}></div>
      
      {showText && (
        <p className="text-gray-500 text-center text-sm">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
