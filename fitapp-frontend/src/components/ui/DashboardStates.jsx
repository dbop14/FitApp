import React from 'react'

const DashboardStates = ({ loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 text-lg mb-2">
          {error}
        </p>
        {error.includes('maximum retries reached') && onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return null
}

export default DashboardStates
