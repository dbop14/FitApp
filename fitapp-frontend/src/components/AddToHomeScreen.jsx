import React from 'react';

const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

const isInStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

const DISMISS_KEY = 'fitapp_pwa_prompt_dismissed';

const AddToHomeScreen = () => {
  const [shouldShow, setShouldShow] = React.useState(false);
  const [promptEvent, setPromptEvent] = React.useState(null);
  const [platform, setPlatform] = React.useState(null);

  React.useEffect(() => {
    // Check if user has dismissed the prompt
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Don't show if already in standalone mode
    if (isInStandalone()) {
      return;
    }

    // Handle Chrome/Android PWA install prompt
    if (isAndroid() && !isIos()) {
      const handleBeforeInstallPrompt = (e) => {
        // Prevent the default browser prompt
        e.preventDefault();
        // Store the event so we can trigger it later if user wants to install
        setPromptEvent(e);
        setShouldShow(true);
        setPlatform('android');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    // Handle iOS
    if (isIos()) {
      setShouldShow(true);
      setPlatform('ios');
    }
  }, []);

  const handleDismiss = () => {
    setShouldShow(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  const handleInstall = async () => {
    if (promptEvent && platform === 'android') {
      // Show the native install prompt
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setPromptEvent(null);
      setShouldShow(false);
      localStorage.setItem(DISMISS_KEY, 'true');
    }
  };

  if (!shouldShow) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      right: 16,
      background: 'rgba(15,23,42,0.95)',
      color: 'white',
      padding: '12px 14px',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      zIndex: 9999,
      backdropFilter: 'blur(6px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Install FitApp</div>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>
            {platform === 'ios' ? (
              <>
                Open the Share menu
                <span style={{ padding: '0 4px' }}>⬆️</span>
                and tap <strong>Add to Home Screen</strong>.
              </>
            ) : (
              <>
                Add FitApp to your home screen for a better experience.
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '4px 8px',
            marginLeft: '8px',
            fontSize: '18px',
            lineHeight: 1,
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '1'}
          onMouseLeave={(e) => e.target.style.opacity = '0.7'}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {platform === 'android' && promptEvent && (
        <button
          onClick={handleInstall}
          style={{
            background: 'rgba(14, 165, 233, 0.9)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            marginTop: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(14, 165, 233, 1)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(14, 165, 233, 0.9)'}
        >
          Install Now
        </button>
      )}
    </div>
  );
};

export default AddToHomeScreen;


