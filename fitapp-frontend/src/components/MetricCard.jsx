import React from 'react'

const MetricCard = ({ icon, value, label, variant = 'primary' }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg'
      case 'secondary':
        return 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg'
      case 'dark':
        return 'bg-gradient-to-br from-gray-700 to-gray-800 text-white shadow-lg'
      case 'success':
        return 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg'
      default:
        return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg'
    }
  }

  return (
    <div className={`${getVariantStyles()} rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="w-full h-full bg-white rounded-full transform translate-x-16 -translate-y-16"></div>
      </div>
      
      {/* Icon */}
      <div className="text-3xl mb-4 opacity-90">
        {icon}
      </div>
      
      {/* Value */}
      <div className="text-3xl font-bold mb-2 leading-tight">
        {value}
      </div>
      
      {/* Label */}
      <div className="text-sm font-medium opacity-90 leading-relaxed">
        {label}
      </div>
    </div>
  )
}

export default MetricCard
