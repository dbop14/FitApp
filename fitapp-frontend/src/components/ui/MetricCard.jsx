import React from 'react'
import { designSystem } from '../../config/designSystem'

/**
 * MetricCard Component
 * Follows the design system specification for metric cards
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main metric value
 * @param {string} props.subtitle - Secondary information
 * @param {string} props.icon - Icon to display (emoji or SVG)
 * @param {string} props.variant - Color variant: 'primary', 'secondary', 'tertiary'
 * @param {string} props.status - Status text (optional)
 * @param {boolean} props.showProgress - Whether to show progress bar
 * @param {number} props.progressValue - Progress percentage (0-100)
 * @param {string} props.progressLabel - Progress label text
 * @param {Object} props.style - Additional custom styles
 */
const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  status,
  showProgress = false,
  progressValue = 0,
  progressLabel,
  style = {}
}) => {
  // Get variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: designSystem.colors.primary.blue,
          color: designSystem.colors.neutrals.white
        }
      case 'secondary':
        return {
          background: designSystem.colors.neutrals.gray_800,
          color: designSystem.colors.neutrals.white
        }
      case 'tertiary':
        return {
          background: designSystem.colors.primary.blue_dark,
          color: designSystem.colors.neutrals.white
        }
      default:
        return {
          background: designSystem.colors.primary.blue,
          color: designSystem.colors.neutrals.white
        }
    }
  }

  const variantStyles = getVariantStyles()

  return (
    <div
      className="metric-card"
      style={{
        background: variantStyles.background,
        color: variantStyles.color,
        padding: designSystem.spacing.component.card_padding,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.card,
        transition: designSystem.transitions.default,
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card_hover
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Icon positioned at top right */}
      {icon && (
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            fontSize: '24px',
            opacity: 0.8
          }}
        >
          {icon}
        </div>
      )}

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Title */}
        <div
          style={{
            fontSize: designSystem.typography.fontSizes.sm,
            fontWeight: designSystem.typography.fontWeights.medium,
            opacity: 0.9,
            marginBottom: '16px'
          }}
        >
          {title}
        </div>

        {/* Main value */}
        <div
          style={{
            fontSize: designSystem.typography.fontSizes['3xl'],
            fontWeight: designSystem.typography.fontWeights.bold,
            marginBottom: '4px',
            lineHeight: designSystem.typography.lineHeights.tight
          }}
        >
          {value}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: designSystem.typography.fontSizes.sm,
            fontWeight: designSystem.typography.fontWeights.medium,
            opacity: 0.9,
            marginBottom: '16px'
          }}
        >
          {subtitle}
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: designSystem.borderRadius.full,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progressValue))}%`,
                  height: '100%',
                  background: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: designSystem.borderRadius.full,
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
            {progressLabel && (
              <div
                style={{
                  fontSize: designSystem.typography.fontSizes.xs,
                  opacity: 0.8,
                  marginTop: '8px'
                }}
              >
                {progressLabel}
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {status && (
          <div
            style={{
              fontSize: designSystem.typography.fontSizes.xs,
              opacity: 0.8,
              marginTop: '8px'
            }}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricCard
