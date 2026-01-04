import React, { useEffect, useState } from 'react';
import { unifiedDesignSystem } from '../../config/unifiedDesignSystem';

/**
 * NotificationToast Component - Displays temporary notifications
 * 
 * Features:
 * - Auto-dismissing notifications
 * - Different types: success, error, info, warning
 * - Smooth animations
 * - Accessible design
 * 
 * Props:
 * @param {string} type - Notification type: 'success', 'error', 'info', 'warning'
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
 * @param {function} onDismiss - Callback when notification is dismissed
 * @param {boolean} show - Whether to show the notification
 */

const NotificationToast = ({ 
  type = 'info', 
  title, 
  message, 
  duration = 5000, 
  onDismiss, 
  show = false 
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsExiting(false);
      
      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 300); // Match CSS transition duration
  };

  if (!isVisible) return null;

  // Get icon and colors based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-400'
        };
      case 'error':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-400'
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-400'
        };
      default: // info
        return {
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-400'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-300 ease-in-out
      ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
    `}>
      <div className={`
        ${styles.bgColor} ${styles.borderColor} border rounded-lg shadow-lg
        p-4 flex items-start space-x-3
      `}>
        {/* Icon */}
        <div className={`${styles.iconColor} flex-shrink-0 mt-0.5`}>
          {styles.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`${styles.textColor} font-medium text-sm mb-1`}>
              {title}
            </h3>
          )}
          {message && (
            <p className={`${styles.textColor} text-sm`}>
              {message}
            </p>
          )}
        </div>
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className={`
            ${styles.textColor} hover:opacity-70 transition-opacity
            flex-shrink-0 ml-2 p-1 rounded-full hover:bg-white hover:bg-opacity-50
          `}
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
