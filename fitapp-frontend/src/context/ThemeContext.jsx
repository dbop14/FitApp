import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Theme preference: 'system' follows prefers-color-scheme; 'light' / 'dark'
// override it. Stored per device. index.html applies the class before first
// paint using the same key, so there is no flash on load.
export const THEME_STORAGE_KEY = 'fitapp-theme'
const PREFERENCES = ['system', 'light', 'dark']

const ThemeContext = createContext({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
  cycle: () => {},
})

const readPreference = () => {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return PREFERENCES.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export const ThemeProvider = ({ children }) => {
  const [preference, setPreferenceState] = useState(readPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return undefined
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    root.classList.toggle('dark', resolved === 'dark')
    const t = setTimeout(() => root.classList.remove('theme-transition'), 250)
    return () => clearTimeout(t)
  }, [resolved])

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return
    setPreferenceState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // storage unavailable (private mode); preference lasts for this session
    }
  }, [])

  // Header button: flips between light and dark (an explicit choice).
  // Settings offers "System" to go back to following the device.
  const cycle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
