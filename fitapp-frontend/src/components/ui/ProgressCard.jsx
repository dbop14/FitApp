import React from 'react';
import Card from './Card';

/**
 * ProgressCard Component - Implements designSystem.components.cards.progressCard
 * 
 * Features:
 * - Content section with title and progress info
 * - Visual progress bar using opacity overlays
 * - Steps/footprint icon taking 1/4 of card width
 * - Step point achievement status display
 * - Consistent with design system layout patterns
 * - Interactive when onClick is provided
 * 
 * Props:
 * @param {string} title - Progress card title
 * @param {number} current - Current progress value
 * @param {number} goal - Goal/target value
 * @param {string} subtitle - Optional subtitle text
 * @param {boolean} achieved - Whether the goal has been achieved
 * @param {boolean} showPointStatus - Whether to show step point achievement
 * @param {function} onClick - Optional click handler
 * @param {string} className - Additional CSS classes
 */

// Steps/Footprint Icon
const StepsIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 421.79 546.09" fill="none" stroke="currentColor" strokeWidth="20" strokeMiterlimit="10">
    <g transform="scale(0.95)">
      <path d="M165.62,393.77s-8.11-21.24-8.43-30.66c0-.28-.02.49-.06-.83s4.43-33.15,4.43-33.15c1.74-13.05,3.82-27.01,7.23-40.74,7.95-31.98,1.51-67.05,1.24-68.5-5.38-30.69-21.39-58.95-30.45-73.06-6.4-9.98-14.1-18.01-22.88-23.89-24.64-16.49-45.89-10.83-59.38-3.19-10.2,5.78-19.07,14.77-25.65,26.02-60.27,102.99,13.58,241.32,14.33,242.7l.99,1.83c9.75,16.55,8.85,30.19,8.85,30.19,2.94,63.94,18.46,104.19,46.14,119.62,9.11,5.08,18.39,6.81,26.78,6.81,17.37,0,30.97-7.4,31.56-7.76,13.26-4.94,22.49-13.97,27.43-26.83,16.63-43.3-20.54-115.5-22.13-118.56Z"/>
      <path d="M258.09,288.9s8.11-21.24,8.43-30.66l.06-.83-4.43-33.15c-1.74-13.05-3.82-27.01-7.23-40.74-7.95-31.98-1.51-67.05-1.24-68.5,5.38-30.69,21.39-58.95,30.45-73.06,6.4-9.98,14.1-18.01,22.88-23.89,24.64-16.49,45.89-10.83,59.38-3.19,10.2,5.78,19.07,14.77,25.65,26.02,60.27,102.99-13.58,241.32-14.33,242.7l-.99,1.83c-9.75,16.55-8.85,30.19-8.85,30.19-2.94,63.94-18.46,104.19-46.14,119.62-9.11,5.08-18.39,6.81-26.78,6.81-17.37,0-30.97-7.4-31.56-7.76-13.26-4.94-22.49-13.97-27.43-26.83-16.63-43.3,20.54-115.5,22.13-118.56Z"/>
    </g>
  </svg>
);
const ProgressCard = ({ 
  title, 
  current = 0, 
  goal, 
  subtitle,
  achieved = false,
  showPointStatus = false,
  onClick, 
  className = '' 
}) => {
  // Ensure current and goal are valid numbers
  const safeCurrent = typeof current === 'number' && !isNaN(current) ? current : 0;
  const safeGoal = typeof goal === 'number' && !isNaN(goal) && goal > 0 ? goal : 0;
  const percentage = safeGoal ? Math.min((safeCurrent / safeGoal) * 100, 100) : 0;
  
  return (
    <Card 
      variant="primary" 
      onClick={onClick}
      className={`mb-4 ${className}`}
      ariaLabel={`${title} - ${Math.floor(percentage)}% complete`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left content - Takes up 3/4 of the card width */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
          
          {/* Progress info */}
          <div className="flex items-center justify-between text-sm mb-2 text-white">
            <span>{safeCurrent.toLocaleString()}</span>
            <span>{safeGoal ? `Goal: ${safeGoal.toLocaleString()}` : 'Set a goal'}</span>
          </div>
          
          {/* Optional subtitle */}
          {subtitle && (
            <p className="text-sm opacity-90 mb-2 text-white">{subtitle}</p>
          )}
          
          {/* Progress bar - designSystem.components.cards.progressCard.progressBar */}
          <div className="bg-white bg-opacity-20 rounded-full h-2 mb-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          {/* Percentage display */}
          {goal && (
            <p className="text-sm opacity-90 text-center text-white">
              {Math.floor(percentage)}% complete
            </p>
          )}
          
          {/* Step Point Achievement Status */}
          {showPointStatus && (
            <div className="mt-3">
              {achieved ? (
                <div className="flex items-center justify-center space-x-2 text-sm font-semibold text-white">
                  <span className="text-lg">🎉</span>
                  <span>Goal Achieved! +1 Point Earned</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-sm text-white opacity-75">
                  <span>Complete your goal to earn a point</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Right icon - Takes up 1/4 of the card width */}
        <div className="w-1/4 aspect-square flex items-center justify-center text-white">
          <StepsIcon className="w-full h-full opacity-80" />
        </div>
      </div>
    </Card>
  );
};

export default ProgressCard;
