import { useState, useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'
import Button from '../components/ui/Button'
import { getDataSourceStatus, updateDataSource, initiateFitbitOAuth } from '../utils/apiService'

const DataSourceSettings = () => {
  const { user } = useContext(UserContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [dataSource, setDataSource] = useState('google-fit')
  const [googleFitConnected, setGoogleFitConnected] = useState(false)
  const [fitbitConnected, setFitbitConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const successMsg = searchParams.get('success')
    const errorMsg = searchParams.get('error')
    
    if (successMsg === 'fitbit_connected') {
      setSuccess('Fitbit connected successfully!')
      // Refresh status
      loadDataSourceStatus()
      // Clear URL params
      navigate('/data-source-settings', { replace: true })
    } else if (errorMsg) {
      setError(decodeURIComponent(errorMsg))
      // Clear URL params
      navigate('/data-source-settings', { replace: true })
    }
  }, [searchParams, navigate])

  // Load data source status on mount
  useEffect(() => {
    if (user?.sub) {
      loadDataSourceStatus()
    }
  }, [user])

  const loadDataSourceStatus = async () => {
    if (!user?.sub) return
    
    setIsLoadingStatus(true)
    setError('')
    
    try {
      const status = await getDataSourceStatus(user.sub)
      setDataSource(status.dataSource || 'google-fit')
      setGoogleFitConnected(status.googleFitConnected || false)
      setFitbitConnected(status.fitbitConnected || false)
    } catch (err) {
      console.error('Failed to load data source status:', err)
      setError('Failed to load data source status')
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleDataSourceChange = async (newDataSource) => {
    if (!user?.sub) return
    
    // Don't allow switching if already selected
    if (newDataSource === dataSource) return
    
    setIsLoading(true)
    setError('')
    setSuccess('')
    
    try {
      // If switching to Fitbit, check if connected
      if (newDataSource === 'fitbit' && !fitbitConnected) {
        setError('Please connect your Fitbit account first')
        setIsLoading(false)
        return
      }
      
      await updateDataSource(user.sub, newDataSource)
      setDataSource(newDataSource)
      setSuccess(`Data source switched to ${newDataSource === 'fitbit' ? 'Fitbit' : 'Google Fit'}`)
      
      // Update user context if available
      if (user) {
        // The user context will be updated on next data fetch
      }
    } catch (err) {
      console.error('Failed to update data source:', err)
      if (err.message.includes('requiresAuth')) {
        setError('Please connect your Fitbit account first')
      } else {
        setError(err.message || 'Failed to update data source')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectFitbit = () => {
    if (!user?.sub) return
    initiateFitbitOAuth(user.sub)
  }

  const handleBack = () => {
    navigate('/settings')
  }

  const getDataSourceDisplayName = (source) => {
    return source === 'fitbit' ? 'Fitbit' : 'Google Fit'
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-center text-white flex-1">
            Data Source
          </h1>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>
      </header>

      <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
        <main className="p-6 pb-24 safe-area-content">
          {/* Page header */}
          <div className="mb-6">
            <h1 className={unifiedDesignSystem.typography.hierarchy.pageTitle}>
              Data Source Settings
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Choose where your step and weight data comes from
            </p>
          </div>

          {isLoadingStatus ? (
            <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Google Fit Option */}
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-gray-600">
                      <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Google Fit</h3>
                      <p className="text-sm text-gray-600">
                        {googleFitConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {dataSource === 'google-fit' && (
                      <span className="text-blue-600 font-semibold text-sm">Active</span>
                    )}
                    {dataSource !== 'google-fit' && (
                      <button
                        onClick={() => handleDataSourceChange('google-fit')}
                        disabled={isLoading}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
                {dataSource === 'google-fit' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Your step and weight data will be synced from Google Fit
                    </p>
                  </div>
                )}
              </div>

              {/* Fitbit Option */}
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-gray-600">
                      <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 1.2c-4.64 0-8.4 3.76-8.4 8.4s3.76 8.4 8.4 8.4 8.4-3.76 8.4-8.4S16.64 3.6 12 3.6zm0 1.2c3.978 0 7.2 3.222 7.2 7.2S15.978 19.2 12 19.2 4.8 15.978 4.8 12 8.022 4.8 12 4.8zm0 1.2c-3.312 0-6 2.688-6 6s2.688 6 6 6 6-2.688 6-6-2.688-6-6-6zm0 1.2c2.646 0 4.8 2.154 4.8 4.8S14.646 16.8 12 16.8 7.2 14.646 7.2 12 9.354 7.2 12 7.2z" fill="#00B0B9"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Fitbit</h3>
                      <p className="text-sm text-gray-600">
                        {fitbitConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {dataSource === 'fitbit' && (
                      <span className="text-blue-600 font-semibold text-sm">Active</span>
                    )}
                    {dataSource !== 'fitbit' && fitbitConnected && (
                      <button
                        onClick={() => handleDataSourceChange('fitbit')}
                        disabled={isLoading}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
                {!fitbitConnected && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      onClick={handleConnectFitbit}
                      variant="primary"
                      size="md"
                      className="w-full"
                    >
                      Connect Fitbit
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Connect your Fitbit account to sync step and weight data
                    </p>
                  </div>
                )}
                {fitbitConnected && dataSource === 'fitbit' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Your step and weight data will be synced from Fitbit
                    </p>
                  </div>
                )}
              </div>

              {/* Error and Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 text-sm">{success}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> You can only use one data source at a time. Switching data sources will immediately start fetching data from the selected provider.
                </p>
              </div>
            </div>
          )}

          {/* Back Button */}
          <div className="mt-8">
            <Button
              type="button"
              variant="secondary"
              onClick={handleBack}
              size="lg"
              className="w-full"
            >
              Back to Settings
            </Button>
          </div>
        </main>
      </div>
    </>
  )
}

export default DataSourceSettings
