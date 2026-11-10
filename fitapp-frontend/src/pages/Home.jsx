import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useContext, useEffect } from 'react'
import { UserContext } from '../context/UserContext'
import Icon from '../components/ui/Icon'
import fitappLogo from '../assets/fitapp-logo.svg'

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
    <div className="min-h-screen bg-canvas">
      {/* Header Section */}
      <header className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-800 px-4 pb-16 pt-[calc(2.5rem+var(--safe-area-top))] text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgb(255_255_255/0.08)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-5 h-20 w-20 rounded-3xl bg-[#fff] p-3 shadow-brand">
            <img src={fitappLogo} alt="FitApp logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Welcome to FitApp
          </h1>
          <p className="mb-6 text-lg text-blue-100 sm:text-xl">
            Your Fitness Challenge Companion
          </p>
          <Link to="/login" className="btn btn-lg bg-[#fff] text-blue-700 hover:bg-blue-50">
            <Icon name="log-in" className="h-5 w-5" />
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto -mt-8 max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">

        {/* PRIMARY PURPOSE STATEMENT - Must be first in main content for Google crawler */}
        <main>
          <section className="mb-8">
            <div className="card relative mx-auto mb-6 max-w-4xl border-t-4 border-t-blue-500 p-6 sm:p-8">
              <h2 className="mb-6 text-center text-2xl font-bold text-ink sm:text-3xl">
                Purpose of This Application
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-ink sm:text-lg">
                <p>
                  <strong>Purpose of FitApp:</strong> FitApp is a fitness challenge application. The purpose of this application is to help users track their fitness progress, 
                  participate in fitness competitions with friends, and stay motivated through social fitness challenges.
                </p>
                <p>
                  <strong>How FitApp Works:</strong> The application automatically syncs with Google Health or WHOOP to track daily steps and weight measurements, 
                  enabling users to compete in challenges and view leaderboards without manual data entry.
                </p>
                <p>
                  <strong>Our Mission:</strong> Our purpose is to make fitness tracking social, engaging, and easy by connecting your Google Health or WHOOP account 
                  and enabling you to participate in fitness competitions with friends.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy Policy and Terms of Service Links - Prominent and immediately visible */}
          <section className="mb-8">
            <div className="card mx-auto max-w-4xl space-y-4 p-6 text-center">
              <p className="text-base text-ink sm:text-lg">
                <strong>Privacy Policy:</strong> For information about how we collect, use, and protect your data, please review our{' '}
                <a 
                  href="https://fitapp.herringm.com/privacy-policy" 
                  className="text-lg font-bold underline"
                  title="Privacy Policy"
                >
                  Privacy Policy
                </a>.
              </p>
              <p className="text-base text-ink sm:text-lg">
                <strong>Terms of Service:</strong> By using FitApp, you agree to our{' '}
                <a 
                  href="https://fitapp.herringm.com/terms-of-service" 
                  className="text-lg font-bold underline"
                  title="Terms of Service"
                >
                  Terms of Service
                </a>.
              </p>
            </div>
          </section>

          {/* Additional Purpose Information */}
          <section className="mb-12">
          <div className="mb-8 rounded-2xl border-l-4 border-blue-600 bg-brand-soft p-6 sm:p-8">
            <h2 className="mb-6 text-2xl font-semibold text-brand-ink sm:text-3xl">
              About FitApp - Our Purpose
            </h2>
            <div className="space-y-4 text-base text-ink sm:text-lg">
              <p>
                <strong>FitApp</strong> is a fitness challenge application designed to help you stay motivated, 
                track your progress, and compete with friends in fun fitness challenges. Our purpose is to 
                make fitness tracking social, engaging, and easy by automatically syncing your Google Health or WHOOP data 
                and enabling you to participate in fitness competitions with friends.
              </p>
              <p>
                Our application connects with your <strong>Google Health</strong> or <strong>WHOOP</strong> account to automatically 
                track your daily step count and weight measurements, making it easy to participate in 
                fitness challenges without manual data entry. We help you stay accountable and motivated 
                through friendly competition and progress tracking.
              </p>
            </div>
          </div>

          {/* Key Features */}
          <div className="mb-8">
            <h2 className="mb-6 text-2xl font-semibold text-ink">
              What FitApp Does
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="mb-3 flex items-center text-lg font-semibold text-ink">
                  <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon name="steps" className="h-5 w-5" /></span>
                  Fitness Tracking
                </h3>
                <p className="text-ink-muted">
                  Automatically syncs your step count and weight data from Google Health or WHOOP to track your 
                  daily fitness progress.
                </p>
              </div>

              <div className="card p-6">
                <h3 className="mb-3 flex items-center text-lg font-semibold text-ink">
                  <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon name="trophy" className="h-5 w-5" /></span>
                  Challenge Competitions
                </h3>
                <p className="text-ink-muted">
                  Join fitness challenges with friends, compete on leaderboards, and earn points 
                  based on your daily activity.
                </p>
              </div>

              <div className="card p-6">
                <h3 className="mb-3 flex items-center text-lg font-semibold text-ink">
                  <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon name="line-chart" className="h-5 w-5" /></span>
                  Progress Monitoring
                </h3>
                <p className="text-ink-muted">
                  View your fitness history, track trends over time, and monitor your progress 
                  toward your fitness goals.
                </p>
              </div>

              <div className="card p-6">
                <h3 className="mb-3 flex items-center text-lg font-semibold text-ink">
                  <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon name="chat" className="h-5 w-5" /></span>
                  Social Features
                </h3>
                <p className="text-ink-muted">
                  Chat with challenge participants, share your progress, and stay motivated with 
                  your fitness community.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="card mb-8 p-6 sm:p-8">
            <h2 className="mb-6 text-2xl font-semibold text-ink">
              How It Works
            </h2>
            <ol className="list-inside list-decimal space-y-3 text-ink-muted marker:font-bold marker:text-brand-ink">
              <li>
                <strong>Sign in with Google:</strong> Use your Google account to securely authenticate 
                and connect your Google Health or WHOOP data.
              </li>
              <li>
                <strong>Join Challenges:</strong> Create or join fitness challenges with friends and 
                set goals for steps, weight, or other fitness metrics.
              </li>
              <li>
                <strong>Automatic Sync:</strong> FitApp automatically retrieves your daily step count 
                and weight from Google Health or WHOOP.
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
        <footer className="mt-12 border-t border-line pt-8 text-center text-ink-muted">
          <p className="mb-2">© {new Date().getFullYear()} FitApp. All rights reserved.</p>
          <p className="text-sm">
            For questions or support, contact us at{' '}
            <a href="mailto:support@herringm.com" className="underline">
              support@herringm.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default Home

