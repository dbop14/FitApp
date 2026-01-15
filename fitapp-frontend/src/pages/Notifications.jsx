import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatNotifications } from '../context/ChatNotificationContext';
import { unifiedDesignSystem } from '../config/unifiedDesignSystem';
import Button from '../components/ui/Button';

/**
 * Notifications Page - Manages all notification preferences
 * 
 * Features:
 * - Chat notification settings
 * - Push notification preferences
 */

const Notifications = () => {
  const navigate = useNavigate();
  const {
    preferences,
    updatePreferences,
    requestNotificationPermission
  } = useChatNotifications();

  const [permissionStatus, setPermissionStatus] = useState('default');

  // Check notification permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Handle permission request
  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermissionStatus('granted');
    }
  };

  // Handle preference change
  const handlePreferenceChange = (key, value) => {
    updatePreferences({ [key]: value });
  };

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200"
            aria-label="Back to Settings"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-center text-white">
            Notifications
          </h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          {/* Page header */}
          <div className={unifiedDesignSystem.components.layout.pageHeader.withActions.className}>
            <h1 className={unifiedDesignSystem.typography.hierarchy.pageTitle}>
              Notification Preferences
            </h1>
            <p className="text-gray-600 mt-2">
              Customize how you receive notifications
            </p>
          </div>

          {/* Chat Notifications Section */}
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-blue-500">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Chat Notifications</h3>
                <p className="text-sm text-gray-600">Get notified about new messages</p>
              </div>
            </div>

            {/* Notification Permission */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  permissionStatus === 'granted' ? 'bg-green-100 text-green-800' :
                  permissionStatus === 'denied' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {permissionStatus === 'granted' ? 'Enabled' :
                   permissionStatus === 'denied' ? 'Blocked' : 'Not Set'}
                </span>
              </div>
              
              {permissionStatus === 'default' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRequestPermission}
                  className="w-full"
                >
                  Enable Push Notifications
                </Button>
              )}
              
              {permissionStatus === 'denied' && (
                <p className="text-xs text-red-600">
                  Notifications are blocked. Please enable them in your browser settings.
                </p>
              )}
            </div>

            {/* Chat Notification Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Push Notifications</label>
                  <p className="text-xs text-gray-500">Receive push notifications for new messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.pushNotifications}
                    onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
                    disabled={permissionStatus !== 'granted'}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                    permissionStatus === 'granted' ? 'bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300' : 'bg-gray-100 cursor-not-allowed'
                  }`}></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Show Unread Badge</label>
                  <p className="text-xs text-gray-500">Display unread message count</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.showUnreadBadge}
                    onChange={(e) => handlePreferenceChange('showUnreadBadge', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Check Interval</label>
                  <p className="text-xs text-gray-500">How often to check for new messages</p>
                </div>
                <select
                  value={preferences.checkInterval}
                  onChange={(e) => handlePreferenceChange('checkInterval', parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                </select>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Notifications;
