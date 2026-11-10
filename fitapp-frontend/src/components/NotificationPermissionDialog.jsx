import React, { useState, useEffect } from 'react';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useChatNotifications } from '../context/ChatNotificationContext';
import Modal from './ui/Modal';
import Icon from './ui/Icon';

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
    <Modal
      isOpen
      onClose={handleDismiss}
      title="Enable notifications"
      icon="bell"
      size="sm"
      footer={
        <>
          <button onClick={handleDismiss} className="btn btn-secondary">
            Not now
          </button>
          <button onClick={handleEnableNotifications} className="btn btn-primary">
            <Icon name="bell" className="h-4 w-4" />
            Enable
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">Stay updated on challenge activity. Get notified when:</p>
      <ul className="mt-3 space-y-2 text-sm text-ink">
        {[
          { icon: 'target', text: 'Members earn step points' },
          { icon: 'steps', text: 'Daily step progress updates are posted' },
          { icon: 'trending-down', text: 'Weight loss achievements are celebrated' },
          { icon: 'users', text: 'New members join your challenges' },
        ].map((i) => (
          <li key={i.text} className="flex items-center gap-3">
            <Icon name={i.icon} className="h-4 w-4 shrink-0 text-brand-ink" />
            {i.text}
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default NotificationPermissionDialog;
