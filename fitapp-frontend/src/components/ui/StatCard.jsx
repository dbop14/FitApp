import React from 'react';
import Card from './Card';

/**
 * StatCard Component - Implements designSystem.components.cards.statCard
 * 
 * Features:
 * - Left-aligned content structure (title, value, subtitle)
 * - Right-aligned supporting icon taking 1/4 card width
 * - Custom SVG icons for different stats
 * - Consistent with design system layout patterns
 * - Interactive when onClick is provided
 * 
 * Props:
 * @param {string} variant - Gradient variant: 'primary', 'light', 'deep'
 * @param {string} title - Small title text above the value
 * @param {string|number} value - Large bold value display
 * @param {string} subtitle - Small muted text below the value
 * @param {string} iconType - Icon type: 'steps', 'weight', 'rank'
 * @param {function} onClick - Optional click handler
 * @param {string} className - Additional CSS classes
 */

// Custom SVG Icons
const StepsIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 421.79 546.09" fill="none" stroke="currentColor" strokeWidth="1" strokeMiterlimit="10">
    <g transform="scale(1.0)">
      <path d="M165.62,393.77s-8.11-21.24-8.43-30.66c0-.28-.02.49-.06-.83s4.43-33.15,4.43-33.15c1.74-13.05,3.82-27.01,7.23-40.74,7.95-31.98,1.51-67.05,1.24-68.5-5.38-30.69-21.39-58.95-30.45-73.06-6.4-9.98-14.1-18.01-22.88-23.89-24.64-16.49-45.89-10.83-59.38-3.19-10.2,5.78-19.07,14.77-25.65,26.02-60.27,102.99,13.58,241.32,14.33,242.7l.99,1.83c9.75,16.55,8.85,30.19,8.85,30.19,2.94,63.94,18.46,104.19,46.14,119.62,9.11,5.08,18.39,6.81,26.78,6.81,17.37,0,30.97-7.4,31.56-7.76,13.26-4.94,22.49-13.97,27.43-26.83,16.63-43.3-20.54-115.5-22.13-118.56Z"/>
      <path d="M258.09,288.9s8.11-21.24,8.43-30.66l.06-.83-4.43-33.15c-1.74-13.05-3.82-27.01-7.23-40.74-7.95-31.98-1.51-67.05-1.24-68.5,5.38-30.69,21.39-58.95,30.45-73.06,6.4-9.98,14.1-18.01,22.88-23.89,24.64-16.49,45.89-10.83,59.38-3.19,10.2,5.78,19.07,14.77,25.65,26.02,60.27,102.99-13.58,241.32-14.33,242.7l-.99,1.83c-9.75,16.55-8.85,30.19-8.85,30.19-2.94,63.94-18.46,104.19-46.14,119.62-9.11,5.08-18.39,6.81-26.78,6.81-17.37,0-30.97-7.4-31.56-7.76-13.26-4.94-22.49-13.97-27.43-26.83-16.63-43.3,20.54-115.5,22.13-118.56Z"/>
    </g>
  </svg>
);

const WeightIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3m0 4a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z" />
    <path d="M12 7c1.956 0 3.724 .802 5 2.095l-2.956 2.904a3 3 0 0 0 -2.038 -.799a3 3 0 0 0 -2.038 .798l-2.956 -2.903a6.979 6.979 0 0 1 5 -2.095z" />
  </svg>
);

const RankIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.5003 18.75H7.50026M16.5003 18.75C18.1571 18.75 19.5003 20.0931 19.5003 21.75H4.50026C4.50026 20.0931 5.8434 18.75 7.50026 18.75M16.5003 18.75V15.375C16.5003 14.7537 15.9966 14.25 15.3753 14.25H14.5036M7.50026 18.75V15.375C7.50026 14.7537 8.00394 14.25 8.62526 14.25H9.49689M14.5036 14.25H9.49689M14.5036 14.25C13.9563 13.3038 13.6097 12.227 13.5222 11.0777M9.49689 14.25C10.0442 13.3038 10.3908 12.227 10.4783 11.0777M5.25026 4.23636C4.26796 4.3792 3.29561 4.55275 2.33423 4.75601C2.78454 7.42349 4.99518 9.49282 7.72991 9.72775M5.25026 4.23636V4.5C5.25026 6.60778 6.21636 8.48992 7.72991 9.72775M5.25026 4.23636V2.72089C7.45568 2.41051 9.70922 2.25 12.0003 2.25C14.2913 2.25 16.5448 2.41051 18.7503 2.72089V4.23636M7.72991 9.72775C8.51748 10.3719 9.45329 10.8415 10.4783 11.0777M18.7503 4.23636V4.5C18.7503 6.60778 17.7842 8.48992 16.2706 9.72775M18.7503 4.23636C19.7326 4.3792 20.7049 4.55275 21.6663 4.75601C21.216 7.42349 19.0053 9.49282 16.2706 9.72775M16.2706 9.72775C15.483 10.3719 14.5472 10.8415 13.5222 11.0777M13.5222 11.0777C13.0331 11.1904 12.5236 11.25 12.0003 11.25C11.4769 11.25 10.9675 11.1904 10.4783 11.0777" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const StatCard = ({ 
  variant = 'primary', 
  title, 
  value, 
  subtitle, 
  iconType, 
  onClick, 
  className = '' 
}) => {
  // Get the appropriate icon component
  const getIconComponent = () => {
    switch (iconType) {
      case 'steps':
        return <StepsIcon className="w-full h-full opacity-80" />;
      case 'weight':
        return <WeightIcon className="w-full h-full opacity-80" />;
      case 'rank':
        return <RankIcon className="w-full h-full opacity-80" />;
      default:
        return null;
    }
  };

  return (
    <Card 
      variant={variant} 
      onClick={onClick}
      className={`mb-4 ${className}`}
      ariaLabel={`${title} - ${value}`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left content - Takes up 3/4 of the card width */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium opacity-90 mb-1 text-white">{title}</h3>
          <div className="text-2xl font-bold mb-1 text-white">{value}</div>
          {subtitle && <p className="text-sm opacity-75 text-white">{subtitle}</p>}
        </div>
        
        {/* Right icon - Takes up 1/4 of the card width */}
        {iconType && (
          <div className="w-1/4 aspect-square flex items-center justify-center text-white">
            {getIconComponent()}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
