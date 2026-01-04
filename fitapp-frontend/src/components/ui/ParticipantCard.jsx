import React from 'react'
import { dashboardDesignSystem } from '../../config/dashboardDesignSystem'

const ParticipantCard = ({ 
  participant, 
  rank, 
  stepGoal, 
  isCurrentUser, 
  onCardTap 
}) => {
  const { colors, spacing, borderRadius, shadows, components } = dashboardDesignSystem
  
  // Calculate weight loss percentage with validation
  const calculateWeightLoss = () => {
    if (!participant.startWeight || !participant.currentWeight || participant.startWeight <= 0) {
      return { percentage: 0, isValid: false }
    }
    const lossPercent = ((participant.startWeight - participant.currentWeight) / participant.startWeight * 100)
    // Clamp the percentage to reasonable bounds (-50% to +50%)
    const clampedPercent = Math.max(-50, Math.min(50, lossPercent))
    return { percentage: clampedPercent.toFixed(1), isValid: true }
  }

  // Check if step data is from today
  const isToday = participant.lastStepDate 
    ? new Date(participant.lastStepDate).toDateString() === new Date().toDateString() 
    : false
  
  const stepDisplay = isToday ? (participant.lastStepCount || 0).toLocaleString() : '—'
  const weightLoss = calculateWeightLoss()
  
  // Calculate progress percentage for step goal
  const stepProgress = stepGoal && participant.lastStepCount 
    ? Math.min((participant.lastStepCount / stepGoal) * 100, 100) 
    : 0

  const cardStyles = {
    display: 'flex',
    alignItems: 'center',
    padding: components.activityCard.structure.padding,
    marginBottom: components.activityCard.structure.marginBottom,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.card,
    border: isCurrentUser ? `2px solid ${colors.primary.blue_200}` : 'none',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    cursor: 'pointer',
    minHeight: '44px', // Accessibility minimum touch target
  }

  const imageAreaStyles = {
    width: 'clamp(60px, 15vw, 80px)',
    height: 'clamp(60px, 15vw, 80px)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    flexShrink: 0,
    marginRight: 'clamp(12px, 3vw, 20px)',
  }

  const contentAreaStyles = {
    flex: 1,
    minWidth: 0,
  }

  const rankStyles = {
    fontSize: 'clamp(12px, 3.5vw, 14px)',
    fontWeight: '600',
    color: colors.neutral.gray_600,
    marginBottom: spacing.xs,
  }

  const nameStyles = {
    fontSize: 'clamp(16px, 4.5vw, 18px)',
    fontWeight: '600',
    color: colors.neutral.gray_900,
    marginBottom: spacing.xs,
    lineHeight: '1.3',
  }

  const metricsContainerStyles = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    flexWrap: 'wrap',
  }

  const metricItemStyles = {
    fontSize: 'clamp(12px, 3.5vw, 14px)',
    color: colors.neutral.gray_500,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  }

  const progressBarStyles = {
    width: '100%',
    height: '4px',
    backgroundColor: colors.neutral.gray_200,
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: spacing.xs,
  }

  const progressFillStyles = {
    height: '100%',
    borderRadius: '2px',
    backgroundColor: stepProgress >= 100 ? colors.accent.teal : colors.primary.blue_500,
    width: `${stepProgress}%`,
    transition: 'width 0.3s ease',
  }

  const pointsStyles = {
    fontSize: 'clamp(14px, 4vw, 16px)',
    fontWeight: '700',
    color: colors.accent.teal,
    textAlign: 'right',
    minWidth: 'fit-content',
  }

  const handleCardTap = () => {
    if (onCardTap) {
      onCardTap(participant)
    }
  }

  return (
    <div 
      style={cardStyles}
      onClick={handleCardTap}
      role="button"
      tabIndex={0}
      aria-label={`${participant.name} - Rank ${rank + 1} - ${participant.totalPoints || 0} points`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardTap()
        }
      }}
    >
      {/* Avatar/Image Area */}
      <div style={imageAreaStyles}>
        <img
          src={participant.avatar}
          alt={participant.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            console.log(`❌ Failed to load image for ${participant.name}:`, participant.avatar)
            e.target.src = '/default-avatar.png' // Fallback avatar
          }}
        />
      </div>

      {/* Content Area */}
      <div style={contentAreaStyles}>
        {/* Rank and Name */}
        <div style={rankStyles}>
          #{rank + 1} {participant.name ? participant.name.split(' ')[0] : 'Unknown'}
          {isCurrentUser && (
            <span style={{ color: colors.primary.blue_600, marginLeft: spacing.xs }}>
              (You)
            </span>
          )}
        </div>
        
        <div style={nameStyles}>
          {participant.name ? participant.name.split(' ')[0] : 'Unknown'}
        </div>

        {/* Metrics */}
        <div style={metricsContainerStyles}>
          {/* Steps */}
          <div style={metricItemStyles}>
            <span role="img" aria-label="steps">👟</span>
            <span style={{ 
              color: isToday ? colors.primary.blue_600 : colors.neutral.gray_400,
              fontWeight: isToday ? '500' : '400'
            }}>
              {stepDisplay} / {stepGoal?.toLocaleString() || '—'}
            </span>
          </div>

          {/* Step Goal Points */}
          <div style={metricItemStyles}>
            <span role="img" aria-label="step goal points">🎯</span>
            <span>{participant.stepGoalPoints || 0} step goal points</span>
          </div>

          {/* Weight */}
          <div style={metricItemStyles}>
            <span role="img" aria-label="weight">⚖️</span>
            <span>
              {participant.currentWeight ? `${participant.currentWeight.toFixed(1)} lbs` : '—'}
            </span>
          </div>

          {/* Weight Loss */}
          <div style={metricItemStyles}>
            <span role="img" aria-label="weight loss">📉</span>
            <span style={{ 
              color: weightLoss.isValid && weightLoss.percentage > 0 
                ? colors.accent.teal 
                : colors.neutral.gray_500 
            }}>
              {weightLoss.percentage}% weight loss
            </span>
          </div>

          {/* Progress Bar for Steps */}
          {isToday && stepGoal && participant.lastStepCount && (
            <div style={progressBarStyles}>
              <div style={progressFillStyles} />
            </div>
          )}
        </div>
      </div>

      {/* Points Display */}
      <div style={pointsStyles}>
        {participant.totalPoints || 0}
      </div>
    </div>
  )
}

export default ParticipantCard
