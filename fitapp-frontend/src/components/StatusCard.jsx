import React from 'react'

const StatusCard = ({ type = 'info', title, message, tip }) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          container: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200',
          icon: 'text-amber-500',
          title: 'text-amber-800',
          message: 'text-amber-700',
          tip: 'text-amber-600'
        }
      case 'error':
        return {
          container: 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200',
          icon: 'text-red-500',
          title: 'text-red-800',
          message: 'text-red-700',
          tip: 'text-red-600'
        }
      case 'success':
        return {
          container: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200',
          icon: 'text-green-500',
          title: 'text-green-800',
          message: 'text-green-700',
          tip: 'text-green-600'
        }
      default:
        return {
          container: 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-700',
          icon: 'text-white',
          title: 'text-white',
          message: 'text-white',
          tip: 'text-white'
        }
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return ''
      case 'error':
        return ''
      case 'success':
        return ''
      default:
        return ''
    }
  }

  const styles = getTypeStyles()

  return (
    <div className={`${styles.container} rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-lg`}>
      <div className="flex items-start space-x-4">
        <div className={`text-2xl ${styles.icon} flex-shrink-0`}>
          {getIcon()}
        </div>
        <div className="flex-1 space-y-3">
          <h3 className={`text-lg font-semibold ${styles.title}`}>
            {title}
          </h3>
          <p className={`text-base leading-relaxed ${styles.message}`}>
            {message}
          </p>
          {tip && (
            <div className={`text-sm font-medium ${styles.tip} bg-white/50 rounded-lg p-3 border border-current/20`}>
              {tip}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatusCard
