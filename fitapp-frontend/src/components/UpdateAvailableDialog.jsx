import React, { useEffect, useState } from 'react';

const UPDATE_EVENT_NAME = 'fitapp:sw-update';

const UpdateAvailableDialog = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    const handleUpdateEvent = (event) => {
      const worker = event?.detail?.worker;
      if (!worker) return;
      setWaitingWorker(worker);
      setShowDialog(true);
    };

    window.addEventListener(UPDATE_EVENT_NAME, handleUpdateEvent);

    // If an update is already waiting, show immediately on mount
    if (window.__FITAPP_SW_UPDATE__) {
      setWaitingWorker(window.__FITAPP_SW_UPDATE__);
      setShowDialog(true);
    }

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdateEvent);
    };
  }, []);

  const handleRefresh = () => {
    try {
      if (waitingWorker) {
        console.log('🔄 User accepted update, skipping waiting...');
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } else if (window.__FITAPP_SW_UPDATE__) {
        console.log('🔄 Using global worker reference for update...');
        window.__FITAPP_SW_UPDATE__.postMessage({ type: 'SKIP_WAITING' });
      } else {
        console.warn('⚠️ No waiting worker found to refresh');
        // Fallback: reload anyway, might force update check
        window.location.reload();
      }
    } catch (e) {
      console.error('❌ Error applying update:', e);
      window.location.reload();
    }
    setShowDialog(false);
  };

  const handleDismiss = () => {
    setShowDialog(false);
    // Clear the global reference so it doesn't pop up again immediately on remount
    window.__FITAPP_SW_UPDATE__ = null; 
  };

  if (!showDialog) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4" style={{ pointerEvents: 'auto' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative">
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
                d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 00-14.9-3M4 16a8 8 0 0014.9 3"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Update Available
            </h3>
            <p className="text-sm text-gray-500">
              Refresh to get the latest FitApp
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-gray-700">
            A new version is ready to install with improvements and fixes.
          </p>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleRefresh}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableDialog;
