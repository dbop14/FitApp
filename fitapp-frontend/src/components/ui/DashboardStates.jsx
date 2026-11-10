import React from 'react'
import LoadingSpinner from './LoadingSpinner'
import Icon from './Icon'

const DashboardStates = ({ loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card card-pad flex flex-col items-center py-10 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Icon name="alert-circle" className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-red-700">{error}</p>
        {error.includes('maximum retries reached') && onRetry && (
          <button onClick={onRetry} className="btn btn-primary mt-4">
            <Icon name="refresh" className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    )
  }

  return null
}

export default DashboardStates
