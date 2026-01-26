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
  const response = await fetchWithAuth(`${apiUrl}/api/user/datasource`, {
    method: 'PUT',
    body: JSON.stringify({ googleId, dataSource })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update data source');
  }
  
  return await response.json();
};

// Initiate Fitbit OAuth flow
export const initiateFitbitOAuth = (googleId) => {
  const apiUrl = getApiUrl();
  // Redirect to backend Fitbit OAuth endpoint
  window.location.href = `${apiUrl}/api/auth/fitbit?googleId=${googleId}`;
};
