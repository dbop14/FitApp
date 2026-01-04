import React from 'react'
import { dashboardDesignSystem } from '../../config/dashboardDesignSystem'

const DashboardHeader = ({ 
  challenge, 
  onInfoClick, 
  postLoginRefreshing, 
  autoRefreshing, 
  rateLimited, 
  onRefresh, 
  loading 
}) => {
  const { colors, spacing, borderRadius, components } = dashboardDesignSystem

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.lg,
  }

  const leftSectionStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  }

  const infoButtonStyles = {
    backgroundColor: colors.neutral.gray_100,
    color: colors.neutral.gray_600,
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px', // Accessibility minimum touch target
    minWidth: '44px',
  }

  const titleStyles = {
    fontSize: components.header.greeting.fontSize,
    fontWeight: components.header.greeting.fontWeight,
    color: colors.primary.blue_600,
    lineHeight: '1.3',
  }

  const rightSectionStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  }

  const statusTextStyles = {
    fontSize: '14px',
    fontWeight: '500',
  }

  const refreshButtonStyles = {
    backgroundColor: colors.neutral.gray_500,
    color: colors.white,
    padding: '8px 12px',
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    minHeight: '44px', // Accessibility minimum touch target
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  }

  const disabledButtonStyles = {
    ...refreshButtonStyles,
    backgroundColor: colors.neutral.gray_400,
    cursor: 'not-allowed',
  }

  const getStatusText = () => {
    if (postLoginRefreshing) {
      return { text: 'Refreshing data after login...', color: colors.primary.blue_600 }
    }
    if (autoRefreshing && !postLoginRefreshing) {
      return { text: 'Auto-syncing...', color: colors.accent.teal }
    }
    if (rateLimited) {
      return { text: 'Rate limited', color: colors.accent.orange }
    }
    return null
  }

  const statusText = getStatusText()

  return (
    <header style={headerStyles}>
      {/* Left Section - Info Button and Title */}
      <div style={leftSectionStyles}>
        <button
          onClick={onInfoClick}
          style={infoButtonStyles}
          title="Challenge Info"
          aria-label="View challenge information"
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = colors.neutral.gray_200
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = colors.neutral.gray_100
          }}
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
        
        <h1 style={titleStyles}>
          {challenge?.name || 'Challenge'} Leaderboard
        </h1>
      </div>

      {/* Right Section - Status and Refresh Button */}
      <div style={rightSectionStyles}>
        {/* Status Text */}
        {statusText && (
          <span style={{ ...statusTextStyles, color: statusText.color }}>
            {statusText.text}
          </span>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading || autoRefreshing || postLoginRefreshing}
          style={loading || autoRefreshing || postLoginRefreshing ? disabledButtonStyles : refreshButtonStyles}
          title="Use this if data looks incorrect or outdated"
          aria-label="Manually sync challenge data"
          onMouseEnter={(e) => {
            if (!e.target.disabled) {
              e.target.style.backgroundColor = colors.neutral.gray_600
            }
          }}
          onMouseLeave={(e) => {
            if (!e.target.disabled) {
              e.target.style.backgroundColor = colors.neutral.gray_500
            }
          }}
        >
          {loading ? (
            <>
              Sync
            </>
          ) : (
            <>
              <span role="img" aria-label="sync">🔧</span>
              Manual Sync
            </>
          )}
        </button>
      </div>
    </header>
  )
}

export default DashboardHeader
