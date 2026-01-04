import React from 'react'
import { designSystem } from '../../config/designSystem'

/**
 * ChartCard Component
 * Follows the design system specification for chart cards
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {React.ReactNode} props.children - Chart content
 * @param {string} props.size - Size variant: 'small', 'medium', 'large'
 * @param {number} props.gridSpan - Grid column span (1-12)
 * @param {string} props.chartType - Type of chart for styling
 * @param {Object} props.style - Additional custom styles
 */
const ChartCard = ({
  title,
  children,
  size = 'medium',
  gridSpan = 4,
  chartType = 'default',
  style = {}
}) => {
  // Get size-specific styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: '16px',
          minHeight: '200px'
        }
      case 'medium':
        return {
          padding: designSystem.spacing.component.card_padding,
          minHeight: '300px'
        }
      case 'large':
        return {
          padding: '32px',
          minHeight: '400px'
        }
      default:
        return {
          padding: designSystem.spacing.component.card_padding,
          minHeight: '300px'
        }
    }
  }

  // Get chart type specific styles
  const getChartTypeStyles = () => {
    switch (chartType) {
      case 'bar_chart':
        return {
          borderLeft: `4px solid ${designSystem.colors.primary.blue}`
        }
      case 'line_chart':
        return {
          borderLeft: `4px solid ${designSystem.colors.semantic.info}`
        }
      case 'activity_chart':
        return {
          borderLeft: `4px solid ${designSystem.colors.semantic.success}`
        }
      default:
        return {}
    }
  }

  const sizeStyles = getSizeStyles()
  const chartTypeStyles = getChartTypeStyles()

  return (
    <div
      className="chart-card"
      style={{
        background: designSystem.colors.neutrals.white,
        padding: sizeStyles.padding,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.card,
        transition: designSystem.transitions.default,
        minHeight: sizeStyles.minHeight,
        gridColumn: `span ${Math.min(12, Math.max(1, gridSpan))}`,
        ...chartTypeStyles,
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card_hover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.card
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}
      >
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

      {/* Chart content */}
      <div style={{ height: 'calc(100% - 60px)' }}>
        {children}
      </div>
    </div>
  )
}

export default ChartCard
