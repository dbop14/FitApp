import React from 'react'
import { designSystem } from '../../config/designSystem'

/**
 * StatusCard Component
 * Follows the design system specification for status cards
 * 
 * @param {Object} props
 * @param {string} props.type - Status type: 'success', 'warning', 'error', 'info'
 * @param {string} props.title - Card title
 * @param {string} props.message - Main message text
 * @param {string} props.tip - Optional tip text
 * @param {React.ReactNode} props.children - Additional content
 * @param {Object} props.style - Additional custom styles
 */
const StatusCard = ({
  type = 'info',
  title,
  message,
  tip,
  children,
  style = {}
}) => {
  // Get type-specific styles
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: designSystem.colors.neutrals.white,
          borderColor: designSystem.colors.semantic.success,
          iconBackground: `${designSystem.colors.semantic.success}20`,
          iconColor: designSystem.colors.semantic.success
        }
      case 'warning':
        return {
          background: designSystem.colors.neutrals.white,
          borderColor: designSystem.colors.semantic.warning,
          iconBackground: `${designSystem.colors.semantic.warning}20`,
          iconColor: designSystem.colors.semantic.warning
        }
      case 'error':
        return {
          background: designSystem.colors.neutrals.white,
          borderColor: designSystem.colors.semantic.error,
          iconBackground: `${designSystem.colors.semantic.error}20`,
          iconColor: designSystem.colors.semantic.error
        }
      case 'info':
      default:
        return {
          background: designSystem.colors.neutrals.white,
          borderColor: designSystem.colors.semantic.info,
          iconBackground: `${designSystem.colors.semantic.info}20`,
          iconColor: designSystem.colors.semantic.info
        }
    }
  }

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  const typeStyles = getTypeStyles()
  const icon = getIcon()

  return (
    <div
      className="status-card"
      style={{
        background: typeStyles.background,
        border: `1px solid ${typeStyles.borderColor}`,
        borderRadius: designSystem.borderRadius.lg,
        padding: designSystem.spacing.component.card_padding,
        boxShadow: designSystem.shadows.card,
        transition: designSystem.transitions.default,
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card_hover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card
      }}
    >
      {/* Header with icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: designSystem.borderRadius.md,
            background: typeStyles.iconBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            fontSize: '20px'
          }}
        >
          {icon}
        </div>
        <h3
          style={{
            fontSize: designSystem.typography.fontSizes.xl,
            fontWeight: designSystem.typography.fontWeights.semibold,
            color: designSystem.colors.neutrals.gray_800,
            margin: 0
          }}
        >
          {title}
        </h3>
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: designSystem.typography.fontSizes.base,
          color: designSystem.colors.neutrals.gray_700,
          lineHeight: designSystem.typography.lineHeights.normal,
          marginBottom: '16px'
        }}
      >
        {message}
      </div>

      {/* Tip */}
      {tip && (
        <div
          style={{
            fontSize: designSystem.typography.fontSizes.sm,
            color: designSystem.colors.neutrals.gray_600,
            lineHeight: designSystem.typography.lineHeights.normal,
            padding: '12px 16px',
            background: designSystem.colors.neutrals.gray_50,
            borderRadius: designSystem.borderRadius.base,
            border: `1px solid ${designSystem.colors.neutrals.gray_200}`,
            marginBottom: '16px'
          }}
        >
          <strong>💡 Tip:</strong> {tip}
        </div>
      )}

      {/* Additional content */}
      {children && (
        <div style={{ marginTop: '16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default StatusCard
