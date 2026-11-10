import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatNotifications } from '../context/ChatNotificationContext';
import { UserContext } from '../context/UserContext';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import Switch from '../components/ui/Switch';
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
  const { user } = useContext(UserContext);
  const {
    preferences,
    updatePreferences,
    requestNotificationPermission
  } = useChatNotifications();

  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

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

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    setTestStatus(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
      const userId = user?.sub || user?.googleId || null;
      const response = await fetch(`${apiUrl}/api/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fitapp_jwt_token')}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        setTestStatus('sent');
      } else {
        const data = await response.json().catch(() => ({}));
        setTestStatus(data?.error || 'failed');
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      setTestStatus('failed');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Handle preference change
  const handlePreferenceChange = (key, value) => {
    updatePreferences({ [key]: value });
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="How you receive notifications" back="/settings" />

      <div className="page-narrow space-y-4">
        {/* Push permission */}
        <section className="card card-pad" aria-labelledby="nt-push">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              <Icon name="bell" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="nt-push" className="card-title">Push notifications</h2>
              <p className="card-subtitle">Get notified about new chat messages</p>
            </div>
            <span
              className={`chip ${
                permissionStatus === 'granted' ? 'chip-success' : permissionStatus === 'denied' ? 'chip-danger' : 'chip-warning'
              }`}
            >
              {permissionStatus === 'granted' ? 'Enabled' : permissionStatus === 'denied' ? 'Blocked' : 'Not set'}
            </span>
          </div>

          {permissionStatus === 'default' && (
            <Button variant="primary" onClick={handleRequestPermission} className="mt-4 w-full">
              <Icon name="bell" className="h-4 w-4" />
              Enable push notifications
            </Button>
          )}
          {permissionStatus === 'denied' && (
            <div className="callout callout-danger mt-4">
              <Icon name="bell-off" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Notifications are blocked. Enable them in your browser or device settings.</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Test notification</p>
              <p className="text-xs text-ink-muted">
                {permissionStatus !== 'granted' ? 'Enable notifications to run the test.' : 'Send yourself a test push.'}
              </p>
            </div>
            {testStatus === 'sent' && <span className="chip chip-success self-start sm:self-center">Sent</span>}
            {testStatus && testStatus !== 'sent' && <span className="chip chip-danger self-start sm:self-center">Failed</span>}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendTestNotification}
              disabled={permissionStatus !== 'granted' || isSendingTest}
            >
              <Icon name="send" className="h-4 w-4" />
              {isSendingTest ? 'Sending...' : 'Send test'}
            </Button>
          </div>
        </section>

        {/* Chat preferences */}
        <section className="card list-divided overflow-hidden" aria-label="Chat notification preferences">
          <div className="list-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="pref-push" className="block text-sm font-medium text-ink">Message alerts</label>
              <p className="text-xs text-ink-muted">Receive push notifications for new messages</p>
            </div>
            <Switch
              id="pref-push"
              checked={preferences.pushNotifications}
              onChange={(v) => handlePreferenceChange('pushNotifications', v)}
              disabled={permissionStatus !== 'granted'}
              label="Message alerts"
            />
          </div>
          <div className="list-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="pref-badge" className="block text-sm font-medium text-ink">Unread badge</label>
              <p className="text-xs text-ink-muted">Show a dot on Chat when there are unread messages</p>
            </div>
            <Switch
              id="pref-badge"
              checked={preferences.showUnreadBadge}
              onChange={(v) => handlePreferenceChange('showUnreadBadge', v)}
              label="Unread badge"
            />
          </div>
          <div className="list-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="pref-interval" className="block text-sm font-medium text-ink">Check interval</label>
              <p className="text-xs text-ink-muted">How often to check for new messages</p>
            </div>
            <select
              id="pref-interval"
              value={preferences.checkInterval}
              onChange={(e) => handlePreferenceChange('checkInterval', parseInt(e.target.value))}
              className="input w-auto py-2"
            >
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          </div>
        </section>
      </div>
    </>
  );
};

export default Notifications;
