import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useContext, useEffect } from 'react'
import { UserContext } from '../context/UserContext'

const Home = () => {
  const navigate = useNavigate()
  const { user } = useContext(UserContext)
  
  // Check if we're in a PWA context (standalone mode)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true
  
  // Redirect to login if not logged in and in PWA context
  useEffect(() => {
    // Check localStorage for user (in case context hasn't loaded yet)
    const storedUser = localStorage.getItem('fitapp_user')
    const isLoggedIn = user || storedUser
    
    // If in PWA/standalone mode and not logged in, redirect to login
    if (isStandalone && !isLoggedIn) {
      console.log('🏠 Home: In PWA mode and not logged in, redirecting to login')
      navigate('/login', { replace: true })
    }
  }, [user, isStandalone, navigate])
  
  // If user is logged in and in PWA, redirect to dashboard
  useEffect(() => {
    const storedUser = localStorage.getItem('fitapp_user')
    const isLoggedIn = user || storedUser
    
    if (isStandalone && isLoggedIn) {
      console.log('🏠 Home: In PWA mode and logged in, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [user, isStandalone, navigate])
  
  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <header className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-5xl font-bold text-blue-600 mb-4">
              Welcome to FitApp
            </h1>
            <p className="text-xl text-gray-700 mb-4">
              Your Fitness Challenge Companion
            </p>
          </div>
        </header>

        {/* PRIMARY PURPOSE STATEMENT - Must be first in main content for Google crawler */}
        <main>
          <section className="mb-8">
            <div className="bg-blue-50 border-4 border-blue-400 rounded-lg p-8 mb-6 max-w-4xl mx-auto shadow-lg">
              <h2 className="text-3xl font-bold text-blue-900 mb-6 text-center">
                Purpose of This Application
              </h2>
              <div className="text-lg text-gray-900 leading-relaxed space-y-4">
                <p>
                  <strong>Purpose of FitApp:</strong> FitApp is a fitness challenge application. The purpose of this application is to help users track their fitness progress, 
                  participate in fitness competitions with friends, and stay motivated through social fitness challenges.
                </p>
                <p>
                  <strong>How FitApp Works:</strong> The application automatically syncs with Google Fit to track daily steps and weight measurements, 
                  enabling users to compete in challenges and view leaderboards without manual data entry.
                </p>
                <p>
                  <strong>Our Mission:</strong> Our purpose is to make fitness tracking social, engaging, and easy by connecting your Google Fit account 
                  and enabling you to participate in fitness competitions with friends.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy Policy and Terms of Service Links - Prominent and immediately visible */}
          <section className="mb-8">
            <div className="bg-white border-2 border-blue-300 rounded-lg p-6 max-w-4xl mx-auto text-center space-y-4">
              <p className="text-lg text-gray-800">
                <strong>Privacy Policy:</strong> For information about how we collect, use, and protect your data, please review our{' '}
                <a 
                  href="https://fitapp.herringm.com/privacy-policy" 
                  className="text-blue-600 hover:text-blue-800 underline font-bold text-xl"
                  title="Privacy Policy"
                >
                  Privacy Policy
                </a>.
              </p>
              <p className="text-lg text-gray-800">
                <strong>Terms of Service:</strong> By using FitApp, you agree to our{' '}
                <a 
                  href="https://fitapp.herringm.com/terms-of-service" 
                  className="text-blue-600 hover:text-blue-800 underline font-bold text-xl"
                  title="Terms of Service"
                >
                  Terms of Service
                </a>.
              </p>
            </div>
          </section>

          {/* Additional Purpose Information */}
          <section className="mb-12">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-8 mb-8 border-l-4 border-blue-600">
            <h2 className="text-3xl font-semibold text-blue-800 mb-6">
              About FitApp - Our Purpose
            </h2>
            <div className="space-y-4 text-lg text-gray-700">
              <p>
                <strong>FitApp</strong> is a fitness challenge application designed to help you stay motivated, 
                track your progress, and compete with friends in fun fitness challenges. Our purpose is to 
                make fitness tracking social, engaging, and easy by automatically syncing your Google Fit data 
                and enabling you to participate in fitness competitions with friends.
              </p>
              <p>
                Our application connects with your <strong>Google Fit</strong> account to automatically 
                track your daily step count and weight measurements, making it easy to participate in 
                fitness challenges without manual data entry. We help you stay accountable and motivated 
                through friendly competition and progress tracking.
              </p>
            </div>
          </div>

          {/* Key Features */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-6">
              What FitApp Does
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="text-blue-600 mr-2">🏃</span>
                  Fitness Tracking
                </h3>
                <p className="text-gray-600">
                  Automatically syncs your step count and weight data from Google Fit to track your 
                  daily fitness progress.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="text-blue-600 mr-2">🏆</span>
                  Challenge Competitions
                </h3>
                <p className="text-gray-600">
                  Join fitness challenges with friends, compete on leaderboards, and earn points 
                  based on your daily activity.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="text-blue-600 mr-2">📊</span>
                  Progress Monitoring
                </h3>
                <p className="text-gray-600">
                  View your fitness history, track trends over time, and monitor your progress 
                  toward your fitness goals.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="text-blue-600 mr-2">💬</span>
                  Social Features
                </h3>
                <p className="text-gray-600">
                  Chat with challenge participants, share your progress, and stay motivated with 
                  your fitness community.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-gray-50 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-6">
              How It Works
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                <strong>Sign in with Google:</strong> Use your Google account to securely authenticate 
                and connect your Google Fit data.
              </li>
              <li>
                <strong>Join Challenges:</strong> Create or join fitness challenges with friends and 
                set goals for steps, weight, or other fitness metrics.
              </li>
              <li>
                <strong>Automatic Sync:</strong> FitApp automatically retrieves your daily step count 
                and weight from Google Fit.
              </li>
              <li>
                <strong>Compete & Track:</strong> View leaderboards, track your progress, and chat 
                with other participants to stay motivated.
              </li>
            </ol>
          </div>
        </section>

        </main>

        {/* Footer */}
        <footer className="text-center text-gray-600 mt-12 pt-8 border-t border-gray-200">
          <p className="mb-2">© {new Date().getFullYear()} FitApp. All rights reserved.</p>
          <p className="text-sm">
            For questions or support, contact us at{' '}
            <a href="mailto:support@herringm.com" className="text-blue-600 hover:text-blue-800 underline">
              support@herringm.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default Home

