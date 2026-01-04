import React from 'react'

const LeaderboardHeader = ({ 
  challenge, 
  onInfoClick, 
  postLoginRefreshing, 
  autoRefreshing, 
  rateLimited, 
  loading 
}) => {
  // Get status text and color
  const getStatusText = () => {
    if (postLoginRefreshing) {
      return { 
        text: 'Refreshing data after login...', 
        color: 'text-blue-600' 
      }
    }
    if (autoRefreshing && !postLoginRefreshing) {
      return { 
        text: 'Auto-syncing...', 
        color: 'text-green-600' 
      }
    }
    if (rateLimited) {
      return { 
        text: 'Rate limited', 
        color: 'text-orange-600' 
      }
    }
    return null
  }

  const statusText = getStatusText()

  return (
    <header className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg" role="banner">
      {/* Left Section - Info Button and Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onInfoClick}
            className="p-3 hover:bg-blue-600 rounded-full transition-colors bg-blue-400 bg-opacity-20 text-white"
            title="Challenge Info"
            aria-label="View challenge information"
          >
            <svg 
              width="20" 
              height="20" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
          
          <h1 className="text-2xl font-bold">
            {challenge?.name || 'Challenge'} Leaderboard
          </h1>
        </div>

        {/* Right Section - Status Text Only */}
        <div className="flex items-center">
          {/* Status Text */}
          {statusText && (
            <div className={`text-sm font-medium ${statusText.color}`}>
              <span>{statusText.text}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default LeaderboardHeader
