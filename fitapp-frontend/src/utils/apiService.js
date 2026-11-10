// Throttle JWT token logging to prevent excessive logs
let lastJWTLogTime = 0;
let jwtLogCount = 0;

// Utility function for making authenticated API calls
export const fetchWithAuth = async (url, options = {}) => {
  const jwtToken = localStorage.getItem('fitapp_jwt_token');
  
  if (!jwtToken) {
    throw new Error('No JWT token found. User must be logged in.');
  }

  // Prevent any JWT token logging - this function is called too frequently
  // Remove any console.log statements that might log token info here

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal // Pass through AbortSignal if provided
  });

  if (response.status === 401 || response.status === 403) {
    // Token might be expired or invalid
    console.error('Authentication failed:', response.status, response.statusText);
    throw new Error('Authentication failed. Please log in again.');
  }

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response;
};

// Authenticated call that returns { status, json } instead of throwing, so
// callers can show the server's message (e.g. a Points v2 source lock, 409).
const authedJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fitapp_jwt_token')}`, ...options.headers },
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
};

const LockedError = (json) => Object.assign(new Error(json.error || 'Your data source is locked for a Points v2 challenge'), { locked: true });

// Helper function to get the API base URL
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';
};

// Get user's data source preference and connection status
export const getDataSourceStatus = async (googleId) => {
  const apiUrl = getApiUrl();
  const response = await fetchWithAuth(`${apiUrl}/api/user/datasource?googleId=${googleId}`);
  
  if (!response.ok) {
    throw new Error('Failed to get data source status');
  }
  
  return await response.json();
};

// Update user's data source preference
export const updateDataSource = async (googleId, dataSource) => {
  const apiUrl = getApiUrl();
  const { ok, status, json } = await authedJson(`${apiUrl}/api/user/datasource`, {
    method: 'PUT',
    body: JSON.stringify({ googleId, dataSource })
  });
  if (status === 409 && json.locked) throw LockedError(json);
  if (!ok) throw new Error(json.error || 'Failed to update data source');
  return json;
};

// Initiate Fitbit OAuth flow
export const initiateFitbitOAuth = (googleId) => {
  const apiUrl = getApiUrl();
  // Redirect to backend Fitbit OAuth endpoint
  window.location.href = `${apiUrl}/api/auth/fitbit?googleId=${googleId}`;
};

// Start the Google Health connection: ask the backend (signed in) for Google's
// consent URL, then go there. Google sends the user back to Data Source Settings.
export const startGoogleHealthConnect = async () => {
  const { ok, status, json } = await authedJson(`${getApiUrl()}/api/auth/google-health/url`);
  if (status === 409 && json.locked) throw LockedError(json);
  if (!ok) throw new Error(json.error || 'Could not start the Google Health connection');
  window.location.href = json.url;
};

// confirm: true disconnects even when this is the locked source of a v2 challenge.
export const disconnectGoogleHealth = async ({ confirm = false } = {}) => {
  const { ok, status, json } = await authedJson(`${getApiUrl()}/api/auth/google-health/disconnect`, { method: 'POST', body: JSON.stringify({ confirm }) });
  if (status === 409 && json.locked) throw LockedError(json);
  if (!ok) throw new Error(json.error || 'Could not disconnect Google Health');
  return json;
};

export const startWhoopConnect = async () => {
  const { ok, status, json } = await authedJson(`${getApiUrl()}/api/auth/whoop/url`);
  if (status === 409 && json.locked) throw LockedError(json);
  if (!ok) throw new Error(json.error || 'Could not start the WHOOP connection');
  window.location.href = json.url;
};

export const disconnectWhoop = async ({ confirm = false } = {}) => {
  const { ok, status, json } = await authedJson(`${getApiUrl()}/api/auth/whoop/disconnect`, { method: 'POST', body: JSON.stringify({ confirm }) });
  if (status === 409 && json.locked) throw LockedError(json);
  if (!ok) throw new Error(json.error || 'Could not disconnect WHOOP');
  return json;
};

// Max heart rate for Effort Points when a workout has no zone breakdown. null resets to the default.
export const updateMaxHeartRate = async (maxHeartRate) => {
  const response = await fetch(`${getApiUrl()}/api/user/max-heart-rate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fitapp_jwt_token')}` },
    body: JSON.stringify({ maxHeartRate }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Could not save max heart rate');
  return json;
};
