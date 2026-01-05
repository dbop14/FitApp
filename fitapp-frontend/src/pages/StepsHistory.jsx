import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChallenge } from '../context/ChallengeContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'

/**
 * StepsHistory Page Component
 * 
 * Features:
 * - Bar chart showing daily step counts
 * - Week and Month view options
 * - Goal line indicator (dotted)
 * - Green bars for days meeting goal, blue for days under goal
 * - Step point count display
 * - Date range navigation
 */

const StepsHistory = () => {
  const navigate = useNavigate()
  const { user, requestGoogleFitPermissions } = useContext(UserContext)
  const { challenge: activeChallenge } = useChallenge()
  
  const [viewMode, setViewMode] = useState('W') // 'W' for week, 'M' for month
  const [historyData, setHistoryData] = useState([])
  const hasEverBeenReadyRef = useRef(false) // Track if we've ever been ready (one-way gate)
  const [loading, setLoading] = useState(true)
  const [currentDateRange, setCurrentDateRange] = useState({ start: null, end: null })
  const [dateRangeOffset, setDateRangeOffset] = useState(0) // Track current offset from today (0 = today's period)
  const [stepPoints, setStepPoints] = useState(0)
  const [totalStepPoints, setTotalStepPoints] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null) // Track selected day for display
  const [chartWidth, setChartWidth] = useState(1100) // Dynamic chart width
  const chartContainerRef = useRef(null)
  
  // Helper to generate cache key for date range
  const getCacheKey = (start, end, mode) => {
    if (!start || !end) return null
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    return `fitapp_stepsHistory_${mode}_${startStr}_${endStr}`
  }
  
  // Load from cache when date range is set
  useEffect(() => {
    if (currentDateRange.start && currentDateRange.end) {
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode)
      if (cacheKey) {
        try {
          const cached = sessionStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            // Convert date strings back to Date objects
            const historyDataWithDates = (parsed.historyData || []).map(day => ({
              ...day,
              date: day.date instanceof Date ? day.date : new Date(day.date)
            }))
            setHistoryData(historyDataWithDates)
            setStepPoints(parsed.stepPoints || 0)
            setTotalStepPoints(parsed.totalStepPoints || null)
            if (parsed.selectedDay) {
              setSelectedDay({
                ...parsed.selectedDay,
                date: parsed.selectedDay.date instanceof Date ? parsed.selectedDay.date : new Date(parsed.selectedDay.date)
              })
            }
            hasEverBeenReadyRef.current = true
            setLoading(false) // Show cached data immediately
          }
        } catch (e) {
          // Ignore cache errors
        }
      }
    }
  }, [currentDateRange.start, currentDateRange.end, viewMode])
  
  // Cache data when it changes
  useEffect(() => {
    if (currentDateRange.start && currentDateRange.end && historyData.length > 0) {
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode)
      if (cacheKey) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            historyData,
            stepPoints,
            totalStepPoints,
            selectedDay,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore storage errors
        }
      }
    }
  }, [historyData, stepPoints, totalStepPoints, selectedDay, currentDateRange.start, currentDateRange.end, viewMode])
  
  const stepGoal = activeChallenge?.stepGoal || 10000

  // Helper to check if user has valid Google Fit permissions
  const hasValidGoogleFitPermissions = () => {
    const token = localStorage.getItem('fitapp_access_token')
    const expiry = localStorage.getItem('fitapp_access_token_expiry')
    
    if (!token || !expiry) return false
    
    // Check if token is expired (with 30 minute buffer)
    const bufferTime = 30 * 60 * 1000 // 30 minutes
    return Date.now() < (parseInt(expiry, 10) - bufferTime)
  }

  // Fetch missing days from Google Fit
  const fetchMissingDaysFromGoogleFit = async (missingDays, dayMap) => {
    if (missingDays.length === 0 || !hasValidGoogleFitPermissions()) {
      return dayMap
    }

    try {
      const accessToken = localStorage.getItem('fitapp_access_token')
      if (!accessToken) return dayMap

      // Get date range for missing days
      const sortedMissingDays = [...missingDays].sort((a, b) => a - b)
      const startDate = new Date(sortedMissingDays[0])
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(sortedMissingDays[sortedMissingDays.length - 1])
      endDate.setHours(23, 59, 59, 999)

      console.log('🔄 Fetching missing days from Google Fit:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        missingDaysCount: missingDays.length
      })

      const requestBody = {
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' }
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 }, // Daily buckets
        startTimeMillis: startDate.getTime(),
        endTimeMillis: endDate.getTime()
      }

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StepsHistory.jsx:144',message:'StepsHistory API call - before fetch',data:{hasAccessToken:!!accessToken,tokenLength:accessToken?accessToken.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      let response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StepsHistory.jsx:151',message:'StepsHistory API call - after fetch',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // If we get 401 (Unauthorized), the token is invalid - refresh it and retry
      if (response.status === 401 && requestGoogleFitPermissions) {
        console.log('⚠️ Token invalid (401) on StepsHistory API call, refreshing token...');
        try {
          const newAccessToken = await requestGoogleFitPermissions();
          // Retry the API call with the new token
          response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
          
          console.log('📥 Retry StepsHistory API call response status:', response.status, response.statusText);
        } catch (refreshError) {
          console.error('❌ Failed to refresh token after 401 on StepsHistory call:', refreshError);
          return dayMap; // Return existing dayMap on error
        }
      }

      if (response.ok) {
        const data = await response.json()
        
        if (data.bucket && data.bucket.length > 0) {
          const today = new Date()
          
          data.bucket.forEach(bucket => {
            // Google Fit returns startTimeMillisNanos (nanoseconds) - convert to milliseconds
            const bucketStartMillis = bucket.startTimeMillisNanos ? 
              parseInt(bucket.startTimeMillisNanos) / 1000000 : 
              bucket.startTimeMillis
            
            // Validate the timestamp before creating Date
            if (!bucketStartMillis || isNaN(bucketStartMillis) || bucketStartMillis <= 0) {
              return // Skip invalid buckets
            }
            
            const bucketDate = new Date(bucketStartMillis)
            
            // Validate the date is valid before using it
            if (isNaN(bucketDate.getTime())) {
              return // Skip invalid dates
            }
            
            const dateKey = bucketDate.toISOString().split('T')[0]
            
            // Find step data in the bucket
            const stepsData = bucket.dataset?.find(d => 
              d.dataTypeName === 'com.google.step_count.delta' ||
              d.dataSourceId?.includes('step_count.delta')
            )
            
            const steps = stepsData?.point?.[0]?.value?.[0]?.intVal ?? 0
            
            // Update dayMap if this day was missing and we found data
            if (dayMap.has(dateKey) && dayMap.get(dateKey).steps === 0 && steps > 0) {
              const isToday = bucketDate.toDateString() === today.toDateString()
              dayMap.set(dateKey, {
                date: bucketDate,
                steps: steps,
                isToday
              })
              console.log(`✅ Fetched ${steps} steps for ${dateKey} from Google Fit`)
            }
          })
        }
      } else {
        console.warn('⚠️ Failed to fetch missing days from Google Fit:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching missing days from Google Fit:', error)
    }

    return dayMap
  }

  // Calculate date range based on view mode
  const calculateDateRange = (mode, offset = 0) => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    let start, end
    
    if (mode === 'W') {
      // Week view: 7 days ending today
      end = new Date(today)
      end.setDate(end.getDate() - (offset * 7))
      start = new Date(end)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    } else {
      // Month view: 30 days ending today
      end = new Date(today)
      end.setDate(end.getDate() - (offset * 30))
      start = new Date(end)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
    }
    
    return { start, end }
  }

  // Initialize date range and reset offset when view mode changes
  useEffect(() => {
    setDateRangeOffset(0) // Reset to today's period when view mode changes
    const range = calculateDateRange(viewMode, 0)
    setCurrentDateRange(range)
  }, [viewMode])
  
  // Update date range when offset changes
  useEffect(() => {
    const range = calculateDateRange(viewMode, dateRangeOffset)
    setCurrentDateRange(range)
  }, [viewMode, dateRangeOffset])

  // Calculate chart width based on container size
  useEffect(() => {
    const updateChartWidth = () => {
      if (chartContainerRef.current) {
        const containerWidth = chartContainerRef.current.offsetWidth
        // Scale the viewBox width based on container width
        // Use a multiplier to ensure lines extend fully on larger screens
        // Minimum 1100 for mobile, scale up for larger screens
        const calculatedWidth = Math.max(1100, Math.ceil(containerWidth * 3))
        setChartWidth(calculatedWidth)
      }
    }

    // Initial calculation
    updateChartWidth()
    
    // Update on resize
    window.addEventListener('resize', updateChartWidth)
    
    // Also update after a short delay to ensure container is rendered
    const timeoutId = setTimeout(updateChartWidth, 100)
    
    return () => {
      window.removeEventListener('resize', updateChartWidth)
      clearTimeout(timeoutId)
    }
  }, [historyData, viewMode])

  // Fetch participant data for total step points
  useEffect(() => {
    const fetchParticipantData = async () => {
      if (!user?.sub || !activeChallenge?._id) {
        setTotalStepPoints(null)
        return
      }
      
      try {
        const apiUrl = getApiUrl()
        const response = await fetchWithAuth(
          `${apiUrl}/api/challenge/${activeChallenge._id}/participant/${user.sub}`
        )
        
        if (response.ok) {
          const data = await response.json()
          setTotalStepPoints(data.participant?.stepGoalPoints || 0)
        }
      } catch (error) {
        console.error('Failed to fetch participant data:', error)
      }
    }
    
    fetchParticipantData()
  }, [user?.sub, activeChallenge?._id])

  // Fetch step history data
  useEffect(() => {
    const fetchStepHistory = async () => {
      if (!user?.sub || !currentDateRange.start || !currentDateRange.end) return
      
      // Check cache first
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode)
      const hasCachedData = cacheKey && sessionStorage.getItem(cacheKey)
      
      // Only show loading if we don't have cached data
      if (!hasCachedData) {
        setLoading(true)
      }
      try {
        const apiUrl = getApiUrl()
        const startDateStr = currentDateRange.start.toISOString().split('T')[0]
        const endDateStr = currentDateRange.end.toISOString().split('T')[0]
        
        // Add cache-busting query parameter based on lastSync to force refresh after sync
        const cacheBuster = user?.lastSync ? `&_t=${new Date(user.lastSync).getTime()}` : ''
        
        const response = await fetchWithAuth(
          `${apiUrl}/api/user/fitness-history/${user.sub}?startDate=${startDateStr}&endDate=${endDateStr}&limit=100${cacheBuster}`
        )
        
        if (response.ok) {
          const data = await response.json()
          
          // Create a map of all days in the range with step counts
          const dayMap = new Map()
          const today = new Date()
          
          // Initialize all days in range with 0 steps
          for (let d = new Date(currentDateRange.start); d <= currentDateRange.end; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0]
            const isToday = d.toDateString() === today.toDateString()
            dayMap.set(dateKey, {
              date: new Date(d),
              steps: 0,
              isToday
            })
          }
          
          // Fill in actual step data
          data.forEach(entry => {
            if (entry.date && entry.steps !== null && entry.steps !== undefined) {
              const dateKey = new Date(entry.date).toISOString().split('T')[0]
              if (dayMap.has(dateKey)) {
                dayMap.get(dateKey).steps = entry.steps
              }
            }
          })
          
          // Find missing days (days with 0 steps that are not today)
          const missingDays = []
          dayMap.forEach((dayData, dateKey) => {
            if (dayData.steps === 0 && !dayData.isToday) {
              missingDays.push(dayData.date.getTime())
            }
          })
          
          // Fetch missing days from Google Fit if available
          let finalDayMap = dayMap
          if (missingDays.length > 0) {
            finalDayMap = await fetchMissingDaysFromGoogleFit(missingDays, dayMap)
          }
          
          // Convert to array and sort by date
          const sortedData = Array.from(finalDayMap.values()).sort((a, b) => a.date - b.date)
          setHistoryData(sortedData)
          
          // Set today as the default selected day
          const todayData = sortedData.find(d => d.isToday)
          if (todayData) {
            setSelectedDay(todayData)
          }
          
          // Calculate step points (days where goal was met in current view)
          const points = sortedData.filter(day => day.steps >= stepGoal).length
          setStepPoints(points)
          
          // Mark as ready after data is set
          hasEverBeenReadyRef.current = true
        }
      } catch (error) {
        console.error('Failed to fetch step history:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchStepHistory()
  }, [user?.sub, user?.lastSync, currentDateRange, stepGoal])

  // Navigate date range
  const navigateDateRange = (direction) => {
    if (direction === 'next') {
      // Going forward in time (towards future)
      setDateRangeOffset(prev => prev - 1)
    } else {
      // Going backward in time (towards past)
      setDateRangeOffset(prev => prev + 1)
    }
  }
  
  // Reset to today's period
  const resetToToday = () => {
    setDateRangeOffset(0)
  }

  // Format date range for display
  const formatDateRange = () => {
    if (!currentDateRange.start || !currentDateRange.end) return ''
    
    const start = currentDateRange.start
    const end = currentDateRange.end
    
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    
    return `${startStr.toUpperCase()} - ${endStr.toUpperCase()}`
  }

  // Calculate chart dimensions and scaling
  const getChartData = () => {
    if (historyData.length === 0) return { maxSteps: stepGoal, bars: [] }
    
    const maxSteps = Math.max(
      stepGoal,
      ...historyData.map(d => d.steps),
      10000 // Minimum scale
    )
    
    // Round up to nearest 5000 for cleaner Y-axis
    const roundedMax = Math.ceil(maxSteps / 5000) * 5000
    
    // Get challenge date range if available
    const challengeStartDate = activeChallenge?.startDate ? new Date(activeChallenge.startDate) : null
    const challengeEndDate = activeChallenge?.endDate ? new Date(activeChallenge.endDate) : null
    
    // Normalize challenge dates to start/end of day for comparison
    if (challengeStartDate) {
      challengeStartDate.setHours(0, 0, 0, 0)
    }
    if (challengeEndDate) {
      challengeEndDate.setHours(23, 59, 59, 999)
    }
    
    const bars = historyData.map((day, index) => {
      const height = day.steps > 0 ? (day.steps / roundedMax) * 100 : 0
      const metGoal = day.steps >= stepGoal
      
      // Determine bar color based on challenge date range and goal
      let barColor = '#3b82f6' // Default blue
      
      if (challengeStartDate) {
        const dayDate = new Date(day.date)
        dayDate.setHours(0, 0, 0, 0)
        
        // Gray out bars before challenge start date
        if (dayDate < challengeStartDate) {
          barColor = '#9ca3af' // Gray
        } else {
          // Day is on or after challenge start date
          if (challengeEndDate) {
            // Check if within challenge date range (before or on end date)
            const dayDateOnly = new Date(day.date)
            dayDateOnly.setHours(0, 0, 0, 0)
            const challengeEndDateOnly = new Date(challengeEndDate)
            challengeEndDateOnly.setHours(0, 0, 0, 0)
            
            if (dayDateOnly <= challengeEndDateOnly) {
              // Within challenge range - green if goal met, blue otherwise
              barColor = metGoal ? '#10b981' : '#3b82f6'
            } else {
              // After challenge end date - blue
              barColor = '#3b82f6'
            }
          } else {
            // Challenge has no end date - green if goal met and on/after start date, blue otherwise
            barColor = metGoal ? '#10b981' : '#3b82f6'
          }
        }
      } else {
        // No challenge or no start date - use original logic
        barColor = metGoal ? '#10b981' : '#3b82f6'
      }
      
      return {
        ...day,
        height,
        metGoal,
        index,
        barColor
      }
    })
    
    return { maxSteps: roundedMax, bars }
  }

  const { maxSteps, bars } = getChartData()
  const todaySteps = historyData.find(d => d.isToday)?.steps || 0
  
  // Use selected day or default to today
  const rawDisplayDay = selectedDay || historyData.find(d => d.isToday) || { date: new Date(), steps: todaySteps, isToday: true }
  
  // Ensure date is always a Date object (it might be a string from cache/API)
  const displayDay = {
    ...rawDisplayDay,
    date: rawDisplayDay.date instanceof Date ? rawDisplayDay.date : new Date(rawDisplayDay.date)
  }
  
  // Handle bar click
  const handleBarClick = (bar) => {
    setSelectedDay(bar)
  }

  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors text-white"
            aria-label="Go back"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-white">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold flex-1 text-center text-white">STEPS HISTORY</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="w-full bg-gray-50 min-h-screen relative">
        {/* Main content with bottom navigation offset and top padding for fixed header */}
        <main className="px-0 py-6 pb-24 pt-20">
        {loading && !hasEverBeenReadyRef.current ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected Day's Steps */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-800 rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs opacity-90 mb-0.5">
                    {displayDay.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold mb-1">{displayDay.steps.toLocaleString()}</div>
                  <div className="text-xs opacity-75">
                    {displayDay.isToday ? 'Steps Today' : 'Steps'}
                  </div>
                </div>
                <div className="flex flex-col items-end text-right">
                  <div className="text-xs opacity-90 mb-0.5">
                    {totalStepPoints !== null ? 'TOTAL POINTS' : 'GOAL DAYS'}
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    {totalStepPoints !== null ? totalStepPoints : stepPoints}
                  </div>
                  {totalStepPoints !== null && (
                    <div className="text-xs opacity-75">
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-xl px-4 py-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Daily Steps</h3>
                  <p className="text-sm text-gray-500">Goal: {stepGoal.toLocaleString()} steps</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* Time Period Selector (W/M buttons) */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('W')}
                      className={`px-3 py-1 rounded-md font-semibold text-sm transition-all ${
                        viewMode === 'W'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      W
                    </button>
                    <button
                      onClick={() => setViewMode('M')}
                      className={`px-3 py-1 rounded-md font-semibold text-sm transition-all ${
                        viewMode === 'M'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      M
                    </button>
                  </div>
                  {/* Date Range Navigation */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-1">
                    <button
                      onClick={() => navigateDateRange('prev')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      aria-label="Previous period"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-gray-600">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={resetToToday}
                      className="text-xs font-semibold text-gray-700 min-w-[60px] text-center hover:bg-gray-200 rounded px-2 py-1 transition-colors"
                      title="Click to return to today's period"
                    >
                      {formatDateRange()}
                    </button>
                    <button
                      onClick={() => navigateDateRange('next')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Next period"
                      disabled={dateRangeOffset <= 0 && currentDateRange.end >= new Date()}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={(dateRangeOffset <= 0 && currentDateRange.end >= new Date()) ? 'text-gray-300' : 'text-gray-600'}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-[18px]">
                <div ref={chartContainerRef} className="relative" style={{ height: '320px' }}>
                {/* Y-axis labels as HTML - independent of SVG */}
                {(() => {
                  const maxValue = 33333
                  const chartHeight = 320
                  const svgHeight = 320
                  const ticks = [, 5000, 10000, 15000, 20000, 25000]
                  
                  return (
                    <>
                      {ticks.map((value, i) => {
                        // Calculate Y position in SVG coordinates - top tick (25000) at y=15 (15px buffer from top)
                        // Scale so 25000 maps to 15 and 0 maps to chartHeight
                        const topTickValue = 25000
                        const topBuffer = 15
                        const svgY = topBuffer + (chartHeight - topBuffer) - (value / topTickValue) * (chartHeight - topBuffer)
                        // Convert to percentage of container
                        const topPosition = (svgY / svgHeight) * 100
                        const isGoalValue = value === stepGoal && stepGoal > 0
                        
                        return (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: '-30px',
                              top: `${topPosition}%`,
                              fontSize: '11px',
                              fontWeight: '600',
                              color: isGoalValue ? '#10b981' : '#6b7280',
                              transform: 'translateY(-50%)',
                              zIndex: 10,
                              pointerEvents: 'none',
                              textAlign: 'right',
                              width: '50px'
                            }}
                          >
                            {value.toLocaleString()}
                          </div>
                        )
                      })}
                      {/* Goal label as HTML - only show if goal doesn't match a tick */}
                      {stepGoal > 0 && !ticks.includes(stepGoal) && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '-30px',
                            top: `${((15 + (305 - (stepGoal / 25000) * 305)) / 320) * 100}%`,
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#10b981',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            pointerEvents: 'none',
                            textAlign: 'right',
                            width: '50px'
                          }}
                        >
                          {stepGoal.toLocaleString()}
                        </div>
                      )}
                    </>
                  )
                })()}
                
                <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} 320`} preserveAspectRatio="none">
                  {/* Calculate leftmost and rightmost bar edges for all lines */}
                  {(() => {
                    const labelOffset = 80
                    const availableWidth = chartWidth - labelOffset
                    const barWidth = availableWidth / bars.length
                    
                    let leftmostEdge = 150 // Default start
                    let rightmostEdge = chartWidth
                    
                    if (bars.length > 0) {
                      // Calculate leftmost bar position (index 0)
                      let firstBarX
                      if (viewMode === 'W') {
                        const firstBarWidth = barWidth * 0.25
                        firstBarX = labelOffset + 0 * barWidth + (barWidth - firstBarWidth) / 2
                      } else {
                        const barSpacing = barWidth * 0.05
                        firstBarX = labelOffset + 0 * barWidth + barSpacing / 2
                      }
                      // Start lines before the first bar with some padding
                      leftmostEdge = Math.min(150, firstBarX - 10)
                      
                      // Calculate rightmost bar position
                      const lastIndex = bars.length - 1
                      let lastBarX, lastBarWidth
                      
                      if (viewMode === 'W') {
                        lastBarWidth = barWidth * 0.25
                        lastBarX = labelOffset + lastIndex * barWidth + (barWidth - lastBarWidth) / 2
                      } else {
                        const barSpacing = barWidth * 0.05
                        lastBarWidth = barWidth - barSpacing
                        lastBarX = labelOffset + lastIndex * barWidth + barSpacing / 2
                      }
                      
                      rightmostEdge = lastBarX + lastBarWidth + 10
                    }
                    
                    return (
                      <>
                        {/* Grid lines only - no text labels */}
                        {(() => {
                          const chartHeight = 320
                          const maxValue = 33333
                          const ticks = [0, 5000, 10000, 15000, 20000, 25000]
                          
                          return ticks.map((value, i) => {
                            // Skip the tick that matches the goal - it will be shown as dashed goal line
                            if (value === stepGoal && stepGoal > 0) {
                              return null
                            }
                            
                            // Scale so 25000 maps to 15 (15px buffer) and 0 maps to chartHeight
                            const topTickValue = 25000
                            const topBuffer = 15
                            const y = topBuffer + (chartHeight - topBuffer) - (value / topTickValue) * (chartHeight - topBuffer)
                            return (
                              <line
                                key={i}
                                x1={leftmostEdge}
                                y1={y}
                                x2={rightmostEdge}
                                y2={y}
                                stroke="#e5e7eb"
                                strokeWidth="2"
                              />
                            )
                          })
                        })()}
                      </>
                    )
                  })()}
                  
                  {/* Calculate leftmost and rightmost bar edges for baseline */}
                  {(() => {
                    const chartHeight = 380
                    const maxValue = 33333
                    const labelOffset = 80
                    const availableWidth = chartWidth - labelOffset
                    const barWidth = availableWidth / bars.length
                    
                    let leftmostEdge = 150 // Default start
                    let rightmostEdge = chartWidth
                    
                    if (bars.length > 0) {
                      // Calculate leftmost bar position (index 0)
                      let firstBarX
                      if (viewMode === 'W') {
                        const firstBarWidth = barWidth * 0.25
                        firstBarX = labelOffset + 0 * barWidth + (barWidth - firstBarWidth) / 2
                      } else {
                        const barSpacing = barWidth * 0.05
                        firstBarX = labelOffset + 0 * barWidth + barSpacing / 2
                      }
                      // Start lines before the first bar with some padding
                      leftmostEdge = Math.min(150, firstBarX - 10)
                      
                      // Calculate rightmost bar position
                      const lastIndex = bars.length - 1
                      let lastBarX, lastBarWidth
                      
                      if (viewMode === 'W') {
                        lastBarWidth = barWidth * 0.25
                        lastBarX = labelOffset + lastIndex * barWidth + (barWidth - lastBarWidth) / 2
                      } else {
                        const barSpacing = barWidth * 0.05
                        lastBarWidth = barWidth - barSpacing
                        lastBarX = labelOffset + lastIndex * barWidth + barSpacing / 2
                      }
                      
                      rightmostEdge = lastBarX + lastBarWidth + 10
                    }
                    
                    return (
                      <>
                        {/* X-axis line at base of graph */}
                        <line
                          x1={leftmostEdge}
                          y1="320"
                          x2={rightmostEdge}
                          y2="320"
                          stroke="#9ca3af"
                          strokeWidth="2"
                        />
                        
                        {/* Goal line - show as dashed line */}
                        {stepGoal > 0 && (
                          <line
                            x1={leftmostEdge}
                            y1={15 + (305 - (stepGoal / 25000) * 305)}
                            x2={rightmostEdge}
                            y2={15 + (305 - (stepGoal / 25000) * 305)}
                            stroke="#9ca3af"
                            strokeWidth="2"
                            strokeDasharray="20,20"
                            opacity="0.5"
                          />
                        )}
                      </>
                    )
                  })()}
                  
                  {/* Bars */}
                  {bars.map((bar, index) => {
                    const chartHeight = 320
                    const topTickValue = 25000
                    const labelOffset = 80
                    const availableWidth = chartWidth - labelOffset
                    const barWidth = availableWidth / bars.length
                    
                    let actualWidth, x
                    if (viewMode === 'W') {
                      // Week view: bars are 1/4 of space, rest is spacing
                      actualWidth = barWidth * 0.25
                      x = labelOffset + index * barWidth + (barWidth - actualWidth) / 2
                    } else {
                      // Month view: minimal spacing
                      const barSpacing = barWidth * 0.05
                      actualWidth = barWidth - barSpacing
                      x = labelOffset + index * barWidth + barSpacing / 2
                    }
                    
                    const topBuffer = 15
                    const barHeight = (bar.steps / topTickValue) * (chartHeight - topBuffer)
                    const y = topBuffer + (chartHeight - topBuffer) - barHeight
                    const selectedDayDate = selectedDay?.date instanceof Date ? selectedDay.date : selectedDay?.date ? new Date(selectedDay.date) : null
                    const isSelected = selectedDayDate && bar.date.toDateString() === selectedDayDate.toDateString()
                    
                    return (
                      <g key={index}>
                        <rect
                          x={x}
                          y={y}
                          width={actualWidth}
                          height={barHeight}
                          fill={bar.barColor}
                          rx="2"
                          opacity={bar.steps > 0 ? 1 : 0.3}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleBarClick(bar)}
                        />
                        {/* Selected day indicator */}
                        {isSelected && (
                          <rect
                            x={x}
                            y={y}
                            width={actualWidth}
                            height={barHeight}
                            fill="white"
                            rx="2"
                            opacity="0.3"
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                        {/* Today indicator */}
                        {bar.isToday && (
                          <line
                            x1={x + actualWidth / 2}
                            y1={y}
                            x2={x + actualWidth / 2}
                            y2={y - 20}
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeDasharray="2,2"
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                      </g>
                    )
                  })}
                </svg>
                
                {/* X-axis labels */}
                <div className="flex justify-between mt-1 mb-2" style={{ paddingLeft: '35px', paddingRight: '8px' }}>
                  {bars.length > 0 && (
                    <>
                      {viewMode === 'M' ? (
                        // Month view: Show labels every 7 days
                        <>
                          {[0, 7, 14, 21, 28].map((dayIndex) => {
                            if (dayIndex < bars.length) {
                              const bar = bars[dayIndex]
                              return (
                                <div key={dayIndex} className="flex flex-col items-center text-xs text-gray-500">
                                  <span className="font-semibold">{bar.date.getDate()}</span>
                                  <span>{bar.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                                </div>
                              )
                            }
                            return null
                          })}
                        </>
                      ) : (
                        // Week view: Show all 7 days with day of week
                        <>
                          {bars.map((bar, idx) => (
                            <div key={idx} className="flex flex-col items-center text-xs text-gray-500">
                              <span className="font-semibold">{bar.date.getDate()}</span>
                              <span>{bar.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-16 mt-12">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-xs text-gray-600">Goal Met</span>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-4">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-blue-600 mt-0.5 flex-shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-blue-800">
                Step points are earned when you meet your daily step goal. Each day you reach {stepGoal.toLocaleString()} steps, you earn 1 point.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
    </>
  )
}

export default StepsHistory

