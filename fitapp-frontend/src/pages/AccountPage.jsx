import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import LogoutButton from '../components/LogoutButton'
// import useGoogleFit from '../hooks/useGoogleFit'

const AccountPage = () => {
  const { user } = useContext(UserContext)
  // const { syncSteps, loading } = useGoogleFit()

  const handleSync = () => {
    // const token = localStorage.getItem('fitapp_access_token')
    // if (token) syncSteps(token)
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <h1 className="text-2xl font-bold text-center text-white">
          FitApp
        </h1>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Account Settings</h2>
      <p className="text-gray-600">Logged in as: {user?.email || user?.name}</p>

      <button
        onClick={handleSync}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow"
      >
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="inline mr-2">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        Sync Google Fit Data
      </button>

      {/* {loading && <p className="text-sm text-gray-500">Syncing…</p>} */}

            <LogoutButton />
          </div>
        </main>
      </div>
    </>
  )
}

export default AccountPage
