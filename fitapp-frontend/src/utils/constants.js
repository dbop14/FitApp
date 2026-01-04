// Default avatar SVG (simple user icon)
export const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNjAiIHI9IjIwIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0yNSAxMjBDMjUgMTAwIDQ1IDg1IDc1IDg1QzEwNSA4NSAxMjUgMTAwIDEyNSAxMjBIMjVaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';

// API URL - Use public domain for browser, fallback to localhost for development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com';

// Challenge status
export const CHALLENGE_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
  UPCOMING: 'upcoming'
}; 