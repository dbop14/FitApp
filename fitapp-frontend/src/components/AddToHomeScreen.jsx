import React from 'react';
import Icon from './ui/Icon';

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
    <div
      className="fixed inset-x-3 bottom-[calc(4.5rem+var(--safe-area-bottom))] z-[1050] mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lift md:bottom-4 md:left-auto md:right-4"
      role="dialog"
      aria-label="Install FitApp"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon name="smartphone" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Install FitApp</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {platform === 'ios' ? (
              <>
                Open the Share menu
                <Icon name="share" className="mx-1 inline h-4 w-4 align-text-bottom" label="Share" />
                and tap <strong className="text-ink">Add to Home Screen</strong>.
              </>
            ) : (
              'Add FitApp to your home screen for a better experience.'
            )}
          </p>
          {platform === 'android' && promptEvent && (
            <button onClick={handleInstall} className="btn btn-sm btn-primary mt-3">
              <Icon name="download" className="h-4 w-4" />
              Install now
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="icon-btn -mr-2 -mt-2" aria-label="Dismiss">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default AddToHomeScreen;
