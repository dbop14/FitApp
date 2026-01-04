import React from 'react';

/**
 * StackedAvatars Component
 * 
 * Displays user profile images in a stacked, overlapping layout
 * Similar to the design shown in challenge cards
 */

const StackedAvatars = ({ 
  participants = [], 
  size = 'md', 
  maxVisible = 4,
  showCount = true 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-10 h-10',
    xl: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = Math.max(0, participants.length - maxVisible);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const generateGradient = (name) => {
    // Generate a consistent color based on name
    const colors = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600', 
      'from-green-400 to-green-600',
      'from-pink-400 to-pink-600',
      'from-indigo-400 to-indigo-600',
      'from-teal-400 to-teal-600',
      'from-orange-400 to-orange-600',
      'from-red-400 to-red-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex items-center">
      {/* Stacked Avatar Images */}
      <div className="flex items-center -space-x-2">
        {visibleParticipants.map((participant, index) => (
          <div 
            key={participant.userId || index}
            className={`relative ${sizeClasses[size]} rounded-full border-2 border-white bg-white shadow-sm z-${10 - index}`}
            style={{ zIndex: 10 - index }}
          >
            {participant.picture ? (
              <img
                src={participant.picture}
                alt={participant.name || 'User'}
                className={`${sizeClasses[size]} rounded-full object-cover`}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            {!participant.picture && (
              <div 
                className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${generateGradient(participant.name || 'User')} flex items-center justify-center text-white font-semibold ${textSizeClasses[size]}`}
              >
                {getInitials(participant.name || 'User')}
              </div>
            )}
          </div>
        ))}
        
        {/* Show count for remaining participants */}
        {remainingCount > 0 && (
          <div 
            className={`relative ${sizeClasses[size]} rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-600 font-semibold ${textSizeClasses[size]} shadow-sm`}
            style={{ zIndex: 1 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Total count text */}
      {showCount && (
        <span className="ml-2 text-sm text-gray-600 font-medium">
          {participants.length}
        </span>
      )}
    </div>
  );
};

export default StackedAvatars;
