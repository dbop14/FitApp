import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChallenge } from '../context/ChallengeContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import BarChart from '../components/ui/BarChart'

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
  const { user } = useContext(UserContext)
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

  // Fetch missing days from the appropriate data source (currently Fitbit only).
  // For Google Fit users, we now rely solely on backend FitnessHistory data so
  // we do not call the Google Fit API directly from the frontend anymore.
  const fetchMissingDaysFromDataSource = async (missingDays, dayMap) => {
    if (missingDays.length === 0) {
      return dayMap
    }
    
    // Check user's data source
    const dataSource = user?.dataSource || 'google-fit'
    
    // For Fitbit, fetch from backend which handles Fitbit API calls
    if (dataSource === 'fitbit') {
      return await fetchMissingDaysFromFitbit(missingDays, dayMap)
    }
    
    // For Google Fit (and any other sources), rely solely on backend FitnessHistory.
    // Do not call Google Fit APIs directly from the frontend.
    return dayMap
  }
  
  // Fetch missing days from Fitbit via backend
  const fetchMissingDaysFromFitbit = async (missingDays, dayMap) => {
    try {
      const sortedMissingDays = [...missingDays].sort((a, b) => a - b)
      const startDate = new Date(sortedMissingDays[0])
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(sortedMissingDays[sortedMissingDays.length - 1])
      endDate.setHours(23, 59, 59, 999)
      
      console.log('🔄 Fetching missing days from Fitbit via backend:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        missingDaysCount: missingDays.length
      })
      
      const apiUrl = getApiUrl()
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      const response = await fetchWithAuth(
        `${apiUrl}/api/user/fitness-history/${user.sub}?startDate=${startDateStr}&endDate=${endDateStr}&limit=100`
      )
      
      if (response.ok) {
        const data = await response.json()
        const today = new Date()
        
        data.forEach(entry => {
          if (entry.date && entry.steps !== null && entry.steps !== undefined) {
            const entryDate = new Date(entry.date)
            const dateKey = entryDate.toISOString().split('T')[0]
            
            // Only update if this day was missing and we found data
            if (dayMap.has(dateKey) && dayMap.get(dateKey).steps === 0 && entry.steps > 0) {
              const isToday = entryDate.toDateString() === today.toDateString()
              dayMap.set(dateKey, {
                date: entryDate,
                steps: entry.steps,
                isToday
              })
              console.log(`✅ Fetched ${entry.steps} steps for ${dateKey} from Fitbit`)
            }
          }
        })
      } else {
        console.warn('⚠️ Failed to fetch missing days from Fitbit:', response.status)
      }
    } catch (error) {
      console.error('❌ Error fetching missing days from Fitbit:', error)
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
          
          // Fill in actual step data, plus workout effort and strength (Google Health / WHOOP)
          data.forEach(entry => {
            if (!entry.date) return
            const dateKey = new Date(entry.date).toISOString().split('T')[0]
            const day = dayMap.get(dateKey)
            if (!day) return
            if (entry.steps !== null && entry.steps !== undefined) {
              day.steps = entry.steps
            }
            for (const f of ['effortPoints', 'moderateMinutes', 'vigorousMinutes', 'strengthSessions']) {
              if (entry[f] !== null && entry[f] !== undefined) day[f] = entry[f]
            }
          })
          
          // Find missing days (days with 0 steps that are not today)
          const missingDays = []
          dayMap.forEach((dayData, dateKey) => {
            if (dayData.steps === 0 && !dayData.isToday) {
              missingDays.push(dayData.date.getTime())
            }
          })
          
          // Fetch missing days from the appropriate data source if available
          let finalDayMap = dayMap
          if (missingDays.length > 0) {
            finalDayMap = await fetchMissingDaysFromDataSource(missingDays, dayMap)
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

  const selectedDayDate = selectedDay?.date instanceof Date ? selectedDay.date : selectedDay?.date ? new Date(selectedDay.date) : null
  const chartBars = bars.map((bar, idx) => {
    const d = bar.date instanceof Date ? bar.date : new Date(bar.date)
    const kind = bar.barColor === '#9ca3af' ? 'muted' : bar.barColor === '#10b981' ? 'met' : 'under'
    return {
      key: d.toDateString(),
      value: bar.steps || 0,
      kind,
      isToday: bar.isToday,
      isSelected: selectedDayDate ? d.toDateString() === selectedDayDate.toDateString() : bar.isToday,
      topLabel: d.getDate(),
      bottomLabel: viewMode === 'W' ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short' }),
      showLabel: viewMode === 'W' || idx % 7 === 0,
      ariaLabel: `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${(bar.steps || 0).toLocaleString()} steps`,
    }
  })
  const nextDisabled = dateRangeOffset <= 0 && currentDateRange.end >= new Date()
  const goalPct = stepGoal > 0 ? Math.min(100, Math.round((displayDay.steps / stepGoal) * 100)) : 0
  const hasWorkouts = displayDay.effortPoints !== undefined || displayDay.strengthSessions !== undefined

  return (
    <>
      <PageHeader title="Steps history" back />

      <div className="page">
        {loading && !hasEverBeenReadyRef.current ? (
          <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
            <div className="skeleton h-40" />
            <div className="skeleton h-40 lg:col-span-2" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            {/* Selected day */}
            <div className="space-y-4">
              <section className="card-brand p-5" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                  {displayDay.isToday ? 'Today' : displayDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-white">{displayDay.steps.toLocaleString()}</span>
                  <span className="text-sm text-blue-100">steps</span>
                </div>
                {stepGoal > 0 && (
                  <>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[rgb(255_255_255/0.2)]">
                      <div className="h-full rounded-full bg-[#fff]" style={{ width: `${goalPct}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-blue-100">
                      {goalPct}% of {stepGoal.toLocaleString()} goal
                    </p>
                  </>
                )}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[rgb(255_255_255/0.12)] px-3 py-2">
                  <span className="text-xs font-medium text-blue-50">{totalStepPoints !== null ? 'Total step points' : 'Goal days'}</span>
                  <span className="text-lg font-bold text-white">{totalStepPoints !== null ? totalStepPoints : stepPoints}</span>
                </div>
              </section>

              {/* Workouts for the selected day (sources that report them) */}
              {hasWorkouts && (
                <section className="card card-pad grid grid-cols-2 gap-3" aria-label="Workouts">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <Icon name="flame" className="h-4 w-4 text-orange-600" />
                      Effort Points
                    </div>
                    <div className="mt-1 text-2xl font-bold text-ink">{displayDay.effortPoints ?? 0}</div>
                    <div className="text-xs text-ink-muted">
                      {displayDay.moderateMinutes ?? 0} moderate + {displayDay.vigorousMinutes ?? 0} vigorous min
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <Icon name="dumbbell" className="h-4 w-4 text-brand-ink" />
                      Strength sessions
                    </div>
                    <div className="mt-1 text-2xl font-bold text-ink">{displayDay.strengthSessions ?? 0}</div>
                    <div className="text-xs text-ink-muted">from workouts</div>
                  </div>
                </section>
              )}
            </div>

            {/* Chart */}
            <section className="card card-pad min-w-0 lg:col-span-2" aria-labelledby="steps-chart-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="steps-chart-title" className="card-title">Daily steps</h2>
                  <p className="card-subtitle">Goal: {stepGoal.toLocaleString()} steps</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Range">
                    {[
                      { v: 'W', label: 'Week' },
                      { v: 'M', label: 'Month' },
                    ].map(({ v, label }) => (
                      <button
                        key={v}
                        role="tab"
                        aria-selected={viewMode === v}
                        onClick={() => setViewMode(v)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          viewMode === v ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center rounded-xl bg-surface-2 p-1">
                    <button onClick={() => navigateDateRange('prev')} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink" aria-label="Previous period">
                      <Icon name="chevron-left" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={resetToToday}
                      className="min-w-[72px] rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                      title="Back to the current period"
                    >
                      {formatDateRange()}
                    </button>
                    <button
                      onClick={() => navigateDateRange('next')}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next period"
                      disabled={nextDisabled}
                    >
                      <Icon name="chevron-right" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <BarChart bars={chartBars} goal={stepGoal} onSelect={(i) => handleBarClick(bars[i])} />

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-teal-500" />Goal met</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-500" />Under goal</span>
                {activeChallenge?.startDate && (
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[rgb(var(--line-strong))]" />Before challenge</span>
                )}
                <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-teal-500" />Goal</span>
              </div>
            </section>

            {/* Info */}
            <div className="callout callout-info lg:col-span-3">
              <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                {activeChallenge?.scoringMode === 'v2'
                  ? 'In this Points v2 challenge you earn points for steps, a bonus each day you reach the goal, workouts (Effort Points) and strength sessions. Tap your row on the leaderboard for the full breakdown.'
                  : `Step points are earned when you meet your daily step goal. Each day you reach ${stepGoal.toLocaleString()} steps, you earn a step point.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default StepsHistory
