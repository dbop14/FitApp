import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { ChallengeProvider } from './context/ChallengeContext'
import { ChatNotificationProvider } from './context/ChatNotificationContext'
import { useVisibilityRefetch } from './hooks/useVisibilityRefetch'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Leaderboard from './pages/Leaderboard'
import Challenge from './pages/Challenge'
import CompletedChallenges from './pages/CompletedChallenges'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import AccountSettings from './pages/AccountSettings'
import Notifications from './pages/Notifications'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Home from './pages/Home'
import StepsHistory from './pages/StepsHistory'
import WeightHistory from './pages/WeightHistory'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './layout/MainLayout'
import AddToHomeScreen from './components/AddToHomeScreen'
import NotificationPermissionDialog from './components/NotificationPermissionDialog'
import ScrollToTop from './components/ScrollToTop'

const App = () => {
  // Enable smart refetching when tab becomes visible
  useVisibilityRefetch()

  // Clear hash fragments on app initialization to prevent redirect loops
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      console.log('🧹 App: Clearing hash fragment to prevent redirect loops')
      window.history.replaceState(null, null, window.location.pathname)
    }
    
    // Debug: Log current URL and pathname
    console.log('🧪 App: Current URL:', window.location.href)
    console.log('🧪 App: Current pathname:', window.location.pathname)
    console.log('🧪 App: Current hash:', window.location.hash)
  }, [])

  return (
    <ChallengeProvider>
      <UserProvider>
        <ChatNotificationProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
          <ScrollToTop />
          <AddToHomeScreen />
          <NotificationPermissionDialog />
          <Routes>
            {/* Public Home page at root for Google verification */}
            <Route path="/" element={<Home />} />

            {/* ❌ Auth/Login page does NOT include Navbar */}
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />
            
            {/* Public Home page for Google verification */}
            <Route path="/home" element={<Home />} />

            {/* Public Privacy Policy page */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />

            {/* ✅ Protected pages wrapped with Navbar layout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout><Dashboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <MainLayout><Leaderboard /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/challenges"
              element={
                <ProtectedRoute>
                  <MainLayout><Challenge /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/completed-challenges"
              element={
                <ProtectedRoute>
                  <MainLayout><CompletedChallenges /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <MainLayout><Chat /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout><Settings /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/account-settings"
              element={
                <ProtectedRoute>
                  <MainLayout><AccountSettings /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <MainLayout><Notifications /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/steps-history"
              element={
                <ProtectedRoute>
                  <MainLayout><StepsHistory /></MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/weight-history"
              element={
                <ProtectedRoute>
                  <MainLayout><WeightHistory /></MainLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Catch-all route - redirect to dashboard for any unknown paths */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
          </Router>
        </ChatNotificationProvider>
      </UserProvider>
    </ChallengeProvider>
  )
}

export default App
