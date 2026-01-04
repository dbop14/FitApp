import React, { useState, useEffect } from 'react';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useChatNotifications } from '../context/ChatNotificationContext';

/**
 * NotificationPermissionDialog - Prompts users to enable notifications after login
 * 
 * Shows a dialog if:
 * - User is logged in
 * - Notifications are not granted
 * - User hasn't dismissed the dialog before
 * - NOT on public pages (/, /home, /privacy-policy, /login)
 */

const NotificationPermissionDialog = () => {
  const { user } = useContext(UserContext);
  const { requestNotificationPermission } = useChatNotifications();
  const location = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Don't show notification dialog on public pages
    const publicPaths = ['/', '/home', '/privacy-policy', '/login', '/auth'];
    if (publicPaths.includes(location.pathname)) {
      setIsChecking(false);
      return;
    }

    // Check if user has dismissed this dialog before
    const dismissed = localStorage.getItem('fitapp_notification_dialog_dismissed');
    
    // Check notification permission status
    if ('Notification' in window) {
      const permission = Notification.permission;
      
      // Show dialog if:
      // 1. User is logged in
      // 2. Permission is default (not asked yet) or denied
      // 3. User hasn't dismissed the dialog before
      if (user && (permission === 'default' || permission === 'denied')) {
        if (!dismissed) {
          // User hasn't dismissed before and notifications aren't enabled
          const timer = setTimeout(() => {
            setShowDialog(true);
            setIsChecking(false);
          }, 2000);
          
          return () => clearTimeout(timer);
        } else {
          setIsChecking(false);
        }
      } else {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, [user, location.pathname]);

  const handleEnableNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setShowDialog(false);
        // Mark as enabled so we don't show again
        localStorage.setItem('fitapp_notification_dialog_dismissed', 'enabled');
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  const handleDismiss = () => {
    setShowDialog(false);
    // Mark as dismissed so we don't show again
    localStorage.setItem('fitapp_notification_dialog_dismissed', 'true');
  };

  // Don't render anything if checking or not showing
  if (isChecking || !showDialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Enable Notifications
            </h3>
            <p className="text-sm text-gray-500">
              Stay updated on challenge activity
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <p className="text-gray-700">
            Get notified when:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-2">
            <li>Members earn step points</li>
            <li>Daily step progress updates are posted</li>
            <li>Weight loss achievements are celebrated</li>
            <li>New members join your challenges</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleEnableNotifications}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enable Notifications
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionDialog;

