import React from 'react';
import Card from './Card';

/**
 * UserCard Component - Implements designSystem.components.cards.userCard
 * 
 * Features:
 * - Avatar + user info on left
 * - Rank/action on right
 * - Consistent with design system layout patterns
 * - Interactive when onClick is provided
 * 
 * Props:
 * @param {string} name - User's name
 * @param {string} picture - User's profile picture URL
 * @param {string} message - Message or subtitle text
 * @param {React.ReactNode} rightContent - Content to display on the right side
 * @param {function} onClick - Optional click handler
 * @param {string} className - Additional CSS classes
 */
const UserCard = ({ 
  name, 
  picture, 
  message, 
  rightContent,
  onClick, 
  className = '' 
}) => {
  // Extract first name from full name
  const firstName = name ? name.split(' ')[0] : 'User';
  
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 shadow-lg mb-4 cursor-pointer transition-transform active:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${className}`}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`User card for ${firstName}`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Avatar + user info - designSystem.components.cards.userCard.structure */}
        <div className="flex items-center space-x-4">
          {/* Avatar - designSystem.components.avatars.variants.inCard */}
          <div className="bg-gray-100 rounded-full w-16 h-16 user-avatar-container flex items-center justify-center border-2 border-gray-200">
            {picture ? (
              <img
                src={picture}
                alt={firstName}
                className="user-avatar"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            
            {(!picture || !name) && (
              <span className="text-2xl font-bold text-gray-600">
                {name ? firstName.charAt(0).toUpperCase() : '👤'}
              </span>
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{firstName}</h2>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
        
        {/* Right: Rank/action content */}
        {rightContent && (
          <div className="flex items-center">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCard;
