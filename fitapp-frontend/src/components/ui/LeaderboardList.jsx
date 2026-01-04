import React from 'react'

const LeaderboardList = ({ participants, currentUserId, onCardTap }) => {
  // Get all participants (no more slicing - show everyone)
  const allParticipants = participants
  
  // Handle card tap
  const handleCardTap = (participant) => {
    if (onCardTap) {
      onCardTap(participant)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e, participant) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardTap(participant)
    }
  }

  if (allParticipants.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-sm">
          No participants to display
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="region" aria-label="Leaderboard List">
      <ol className="space-y-3">
        {allParticipants.map((participant, index) => {
          const rank = index + 1 // Start from rank 1
          const isCurrentUser = participant.id === currentUserId
          
          // Get medal emoji for top 3
          const getMedalEmoji = (rank) => {
            switch (rank) {
              case 1: return '🥇'
              case 2: return '🥈'
              case 3: return '🥉'
              default: return ''
            }
          }
          
          // Get special styling for top 3
          const getTop3Styling = (rank) => {
            switch (rank) {
              case 1: return 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100'
              case 2: return 'border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100'
              case 3: return 'border-orange-400 bg-gradient-to-r from-orange-50 to-orange-100'
              default: return 'border-gray-200 bg-white'
            }
          }
          
          return (
            <li 
              key={participant.id}
              className={`rounded-xl p-4 border-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${getTop3Styling(rank)} ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => handleCardTap(participant)}
              onKeyDown={(e) => handleKeyDown(e, participant)}
              role="button"
              tabIndex={0}
              aria-label={`${participant.name} - Rank ${rank} - ${participant.totalPoints || 0} points`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Rank with medal for top 3 */}
                  <div className="flex items-center space-x-2 min-w-[3rem]">
                    <span className="text-lg font-semibold text-gray-600">
                      #{rank}
                    </span>
                    {rank <= 3 && (
                      <span className="text-xl">
                        {getMedalEmoji(rank)}
                      </span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <div className="w-12 h-12 leaderboard-avatar-container bg-gray-100 flex items-center justify-center flex-shrink-0 border-2 border-gray-200">
                    {participant.avatar ? (
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className="leaderboard-avatar"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    
                    {/* Fallback avatar - matching UserCard structure */}
                    {(!participant.avatar || !participant.name) && (
                      <span className="text-sm font-bold text-gray-600">
                        {participant.name ? participant.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  
                  {/* Name and additional stats */}
                  <div className="flex flex-col">
                    <div className={`font-medium ${isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
                      {participant.name ? participant.name.split(' ')[0] : 'Unknown'}
                      {isCurrentUser && (
                        <span className="text-blue-600 ml-2 text-sm">
                          (You)
                        </span>
                      )}
                    </div>
                    {/* Show step goal points if available */}
                    {participant.stepGoalPoints !== undefined && (
                      <div className="text-xs text-gray-500">
                        Step Points: {participant.stepGoalPoints}
                      </div>
                    )}
                    {/* Show weight loss percentage if available */}
                    {participant.weightLossPercentage !== null && participant.weightLossPercentage !== undefined && (
                      <div className="text-xs text-gray-500">
                        Weight Loss: {participant.weightLossPercentage.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Section - Total Points */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-700">
                    {participant.totalPoints || 0}
                  </div>
                  <div className="text-xs text-gray-500">
                    pts
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default LeaderboardList
