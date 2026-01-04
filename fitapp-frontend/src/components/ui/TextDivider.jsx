import React from 'react';

/**
 * TextDivider Component - Horizontal divider with centered text
 * 
 * Features:
 * - Horizontal line with centered text
 * - Responsive design
 * - Tailwind-based styling
 * 
 * Props:
 * @param {string} text - Text to display in the center
 * @param {string} className - Additional CSS classes
 */
const TextDivider = ({ text = 'or', className = '' }) => {
  return (
    <div className={`w-full max-w-md my-8 flex items-center text-center ${className}`}>
      <hr className="flex-1 h-px bg-gray-200 border-none" />
      <span className="px-6 text-sm text-gray-400 bg-white">{text}</span>
      <hr className="flex-1 h-px bg-gray-200 border-none" />
    </div>
  );
};

export default TextDivider;
