import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChallenge } from '../context/ChallengeContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import { unifiedDesignSystem } from '../config/unifiedDesignSystem'

/**
 * WeightHistory Page Component
 * 
 * Features:
 * - Line graph showing daily weight measurements
 * - Week and Month view options
 * - Purple line with circular data points
 * - Date range navigation
 */

const WeightHistory = () => {
  const navigate = useNavigate()
  const { user } = useContext(UserContext)
  const { challenge: activeChallenge } = useChallenge()
  
  const [viewMode, setViewMode] = useState('M') // 'W' for week, 'M' for month
  const [historyData, setHistoryData] = useState([])
  const hasEverBeenReadyRef = useRef(false) // Track if we've ever been ready (one-way gate)
  const [loading, setLoading] = useState(true)
  const [currentDateRange, setCurrentDateRange] = useState({ start: null, end: null })
  const [dateRangeOffset, setDateRangeOffset] = useState(0) // Track current offset from today (0 = today's period)
  const [selectedDay, setSelectedDay] = useState(null) // Track selected day for display
  const [chartWidth, setChartWidth] = useState(1100) // Dynamic chart width
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [hasPreviousPeriodData, setHasPreviousPeriodData] = useState(false) // Track if previous period has data - start as false until verified
  const chartContainerRef = useRef(null)
  const svgRef = useRef(null)
  const fetchIdRef = useRef(0) // Track fetch requests to ignore stale responses
  
  // Helper to generate cache key for date range
  const getCacheKey = (start, end, mode, offset) => {
    if (!start || !end) return null
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    return `fitapp_weightHistory_${mode}_${offset}_${startStr}_${endStr}`
  }
  
  // Load from cache when date range is set
  useEffect(() => {
    if (currentDateRange.start && currentDateRange.end) {
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode, dateRangeOffset)
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
  }, [currentDateRange.start, currentDateRange.end, viewMode, dateRangeOffset])
  
  // Cache data when it changes
  useEffect(() => {
    if (currentDateRange.start && currentDateRange.end && historyData.length >= 0) {
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode, dateRangeOffset)
      if (cacheKey) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            historyData,
            selectedDay,
            timestamp: Date.now()
          }))
        } catch (e) {
          // Ignore storage errors
        }
      }
    }
  }, [historyData, selectedDay, currentDateRange.start, currentDateRange.end, viewMode, dateRangeOffset])

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
    // Increment fetch ID to invalidate any in-flight fetches from previous view
    fetchIdRef.current++
    // Set loading to true immediately to prevent showing stale or empty data
    setLoading(true)
    setDateRangeOffset(0) // Reset to today's period when view mode changes
    const range = calculateDateRange(viewMode, 0)
    setCurrentDateRange(range)
    // Clear historyData when switching views to prevent showing stale data
    setHistoryData([])
  }, [viewMode])
  
  // Update date range when offset changes
  useEffect(() => {
    const range = calculateDateRange(viewMode, dateRangeOffset)
    setCurrentDateRange(range)
  }, [viewMode, dateRangeOffset])

  // Calculate chart width based on container size
  useEffect(() => {
    const updateChartWidth = () => {
      if (chartContainerRef.current && svgRef.current) {
        const containerWidth = chartContainerRef.current.offsetWidth
        const containerHeight = chartContainerRef.current.offsetHeight
        // Scale the viewBox width based on container width
        // Use a multiplier to ensure lines extend fully on larger screens
        // Minimum 1100 for mobile, scale up for larger screens
        const calculatedWidth = Math.max(1100, Math.ceil(containerWidth * 3))
        setChartWidth(calculatedWidth)
        
        // Update container dimensions for dot positioning
        if (containerWidth > 0 && containerHeight > 0) {
          setContainerDimensions({ width: containerWidth, height: containerHeight })
        }
      }
    }

    // Initial calculation
    updateChartWidth()
    
    // Update on resize
    window.addEventListener('resize', updateChartWidth)
    
    // Also update after a short delay to ensure container is rendered
    const timeoutId = setTimeout(updateChartWidth, 100)
    
    // Use ResizeObserver for more accurate dimension tracking
    let resizeObserver = null
    if (chartContainerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateChartWidth()
      })
      resizeObserver.observe(chartContainerRef.current)
    }
    
    return () => {
      window.removeEventListener('resize', updateChartWidth)
      clearTimeout(timeoutId)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [historyData, viewMode])

  // Fetch weight history data
  useEffect(() => {
    const fetchWeightHistory = async () => {
      if (!user?.sub || !currentDateRange.start || !currentDateRange.end) {
        return
      }
      
      // Increment fetch ID to track this specific fetch request
      const currentFetchId = ++fetchIdRef.current
      const currentViewMode = viewMode
      const currentOffset = dateRangeOffset
      const currentStartDate = currentDateRange.start.toISOString().split('T')[0]
      const currentEndDate = currentDateRange.end.toISOString().split('T')[0]
      
      // Check cache first
      const cacheKey = getCacheKey(currentDateRange.start, currentDateRange.end, viewMode, dateRangeOffset)
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
          
          console.log('📊 WeightHistory: API returned', data.length, 'entries')
          console.log('📊 WeightHistory: Date range requested:', startDateStr, 'to', endDateStr)
          
          // Log sample of raw API data to see structure
          if (data.length > 0) {
            console.log('📊 WeightHistory: Sample raw entry:', {
              date: data[0].date,
              weight: data[0].weight,
              steps: data[0].steps,
              allKeys: Object.keys(data[0]),
              fullEntry: data[0]
            })
          }
          
          // Check for entries with weight data - try multiple checks
          const entriesWithWeight1 = data.filter(e => e.weight !== null && e.weight !== undefined)
          const entriesWithWeight2 = data.filter(e => e.weight != null) // Loose equality check
          const entriesWithWeight3 = data.filter(e => typeof e.weight === 'number' && !isNaN(e.weight))
          
          console.log('📊 WeightHistory: Entries with weight (strict null check):', entriesWithWeight1.length)
          console.log('📊 WeightHistory: Entries with weight (loose null check):', entriesWithWeight2.length)
          console.log('📊 WeightHistory: Entries with weight (number check):', entriesWithWeight3.length)
          
          // Log ALL entries to see what we're getting
          const allEntriesLog = data.map(e => {
            const entryDate = new Date(e.date)
            const entryDateStr = entryDate.toISOString().split('T')[0]
            return {
              date: e.date,
              dateStr: entryDateStr,
              weight: e.weight,
              weightValue: e.weight,
              weightType: typeof e.weight,
              steps: e.steps,
              hasWeightField: 'weight' in e,
              isWeightNull: e.weight === null,
              isWeightUndefined: e.weight === undefined,
              isWeightNumber: typeof e.weight === 'number',
              inRequestedRange: entryDateStr >= startDateStr && entryDateStr <= endDateStr
            }
          })
          
          console.log('📊 WeightHistory: ALL entries:', allEntriesLog)
          
          if (entriesWithWeight3.length > 0) {
            console.log('📊 WeightHistory: Entries with numeric weight:', entriesWithWeight3.map(e => ({
              date: e.date,
              weight: e.weight
            })))
          }
          
          // Create a map of all days in the range with weight values
          const dayMap = new Map()
          const today = new Date()
          
          // Initialize all days in range with null weight
          for (let d = new Date(currentDateRange.start); d <= currentDateRange.end; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0]
            const isToday = d.toDateString() === today.toDateString()
            dayMap.set(dateKey, {
              date: new Date(d),
              weight: null,
              isToday
            })
          }
          
          console.log('📊 WeightHistory: Initialized', dayMap.size, 'days in date range')
          console.log('📊 WeightHistory: Date range keys:', Array.from(dayMap.keys()).slice(0, 5), '...', Array.from(dayMap.keys()).slice(-5))
          
          // Fill in actual weight data
          let weightDataAdded = 0
          let entriesOutsideRange = 0
          let entriesWithNullWeight = 0
          const weightEntriesOutsideRange = []
          
          data.forEach(entry => {
            const entryDate = new Date(entry.date)
            const dateKey = entryDate.toISOString().split('T')[0]
            
            // Check if entry has weight data
            if (entry.weight !== null && entry.weight !== undefined && typeof entry.weight === 'number' && !isNaN(entry.weight)) {
              if (dayMap.has(dateKey)) {
                dayMap.get(dateKey).weight = entry.weight
                weightDataAdded++
                console.log('📊 WeightHistory: Added weight', entry.weight, 'for date', dateKey)
              } else {
                entriesOutsideRange++
                weightEntriesOutsideRange.push({ date: dateKey, weight: entry.weight })
                console.log('📊 WeightHistory: Entry with weight', entry.weight, 'outside date range:', dateKey, 'Range:', startDateStr, 'to', endDateStr)
              }
            } else {
              entriesWithNullWeight++
              // Only log first few to avoid spam
              if (entriesWithNullWeight <= 3) {
                console.log('📊 WeightHistory: Entry has null/undefined weight:', {
                  date: entry.date,
                  dateKey,
                  weight: entry.weight,
                  weightType: typeof entry.weight,
                  inRange: dayMap.has(dateKey)
                })
              }
            }
          })
          
          console.log('📊 WeightHistory: Added weight data to', weightDataAdded, 'days')
          console.log('📊 WeightHistory: Entries with weight outside range:', entriesOutsideRange)
          console.log('📊 WeightHistory: Entries with null/undefined weight:', entriesWithNullWeight)
          
          // Convert to array and sort by date, filter to only entries with weight data
          const beforeFilter = Array.from(dayMap.values())
          const sortedData = beforeFilter
            .filter(day => day.weight !== null)
            .sort((a, b) => a.date - b.date)
          
          console.log('📊 WeightHistory: After filtering,', sortedData.length, 'days with weight data')
          if (sortedData.length > 0) {
            console.log('📊 WeightHistory: First entry:', { date: sortedData[0].date, weight: sortedData[0].weight })
            console.log('📊 WeightHistory: Last entry:', { date: sortedData[sortedData.length - 1].date, weight: sortedData[sortedData.length - 1].weight })
          }
          
          // If in week view and current week has no data, automatically navigate to most recent week with data
          // Keep loading true while we check for wider range data
          if (viewMode === 'W' && sortedData.length === 0 && dateRangeOffset === 0) {
            // Fetch a wider range (30 days) to find the most recent week with data
            const wideStart = new Date(currentDateRange.end)
            wideStart.setDate(wideStart.getDate() - 29)
            wideStart.setHours(0, 0, 0, 0)
            const wideEnd = new Date(currentDateRange.end)
            wideEnd.setHours(23, 59, 59, 999)
            
            const wideStartStr = wideStart.toISOString().split('T')[0]
            const wideEndStr = wideEnd.toISOString().split('T')[0]
            
            try {
              const wideResponse = await fetchWithAuth(
                `${apiUrl}/api/user/fitness-history/${user.sub}?startDate=${wideStartStr}&endDate=${wideEndStr}&limit=100${cacheBuster}`
              )
              
              if (wideResponse.ok) {
                const wideData = await wideResponse.json()
                const entriesWithWeight = wideData.filter(e => e.weight !== null && e.weight !== undefined && typeof e.weight === 'number' && !isNaN(e.weight))
                
                if (entriesWithWeight.length > 0) {
                  // Find the most recent entry with weight data
                  const mostRecentEntry = entriesWithWeight.reduce((latest, entry) => {
                    const entryDate = new Date(entry.date)
                    const latestDate = new Date(latest.date)
                    return entryDate > latestDate ? entry : latest
                  })
                  
                  const mostRecentDate = new Date(mostRecentEntry.date)
                  const today = new Date()
                  today.setHours(23, 59, 59, 999)
                  
                  // Calculate which week this date falls into (how many weeks ago from today)
                  const daysDiff = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24))
                  const weeksAgo = Math.floor(daysDiff / 7)
                  
                  // Set the offset to navigate to that week
                  if (weeksAgo >= 0) {
                    setDateRangeOffset(weeksAgo)
                    // Don't set historyData here - let the effect re-run with the new offset
                    // Loading will be cleared when the new fetch completes
                    return
                  }
                }
              }
            } catch (error) {
              console.error('Failed to fetch wider range for week view:', error)
              // Continue with normal flow if wide fetch fails
            }
          }
          
          // Only set historyData and clear loading if we're not auto-navigating
          // Check if this fetch is still current (not stale)
          if (currentFetchId !== fetchIdRef.current) {
            return // Ignore stale fetch response
          }
          
          // Verify the fetch matches current state
          if (viewMode !== currentViewMode || dateRangeOffset !== currentOffset) {
            return // State changed, ignore this response
          }
          
          // Verify the date range matches what we expect for this viewMode and offset
          const expectedRange = calculateDateRange(currentViewMode, currentOffset)
          const expectedStartDate = expectedRange.start?.toISOString().split('T')[0]
          const expectedEndDate = expectedRange.end?.toISOString().split('T')[0]
          
          if (currentStartDate !== expectedStartDate || currentEndDate !== expectedEndDate) {
            return // Date range doesn't match, ignore this response
          }
          
          // Only set empty data if we're sure this is the correct fetch and there's truly no data
          // If we have existing data and this fetch returns empty, double-check it's not a stale response
          if (sortedData.length === 0 && historyData.length > 0) {
            // Verify one more time that the state hasn't changed
            if (viewMode !== currentViewMode || dateRangeOffset !== currentOffset) {
              return // Don't overwrite existing data with empty data if state changed
            }
          }
          
          setHistoryData(sortedData)
          
          // Set today as the default selected day if it has weight data
          const todayData = sortedData.find(d => d.isToday)
          if (todayData) {
            setSelectedDay(todayData)
          } else if (sortedData.length > 0) {
            // If today doesn't have data, select the most recent entry
            setSelectedDay(sortedData[sortedData.length - 1])
          }
          
          // Mark as ready after data is set
          hasEverBeenReadyRef.current = true
          
          // Clear loading state after all data processing is complete
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to fetch weight history:', error)
        setLoading(false)
      }
    }
    
    fetchWeightHistory()
  }, [user?.sub, user?.lastSync, currentDateRange, viewMode, dateRangeOffset])

  // Check if previous period has weight data
  useEffect(() => {
    const checkPreviousPeriodData = async () => {
      if (!user?.sub || !viewMode) {
        setHasPreviousPeriodData(false) // Default to disabled if we can't check
        return
      }
      
      // Calculate previous period date range (offset + 1)
      const previousRange = calculateDateRange(viewMode, dateRangeOffset + 1)
      
      if (!previousRange.start || !previousRange.end) {
        setHasPreviousPeriodData(false)
        return
      }
      
      // Immediately disable button while checking
      setHasPreviousPeriodData(false)
      
      try {
        const apiUrl = getApiUrl()
        const startDateStr = previousRange.start.toISOString().split('T')[0]
        const endDateStr = previousRange.end.toISOString().split('T')[0]
        
        const cacheBuster = user?.lastSync ? `&_t=${new Date(user.lastSync).getTime()}` : ''
        const response = await fetchWithAuth(
          `${apiUrl}/api/user/fitness-history/${user.sub}?startDate=${startDateStr}&endDate=${endDateStr}&limit=100${cacheBuster}`
        )
        
        if (response.ok) {
          const data = await response.json()
          
          // Use the same logic as the main fetch: create a dayMap for the previous period
          // This ensures we check data availability the same way we'll display it
          const previousDayMap = new Map()
          for (let d = new Date(previousRange.start); d <= previousRange.end; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0]
            previousDayMap.set(dateKey, { date: new Date(d), weight: null })
          }
          
          // Fill in actual weight data from the API response
          let hasWeightData = false
          data.forEach(entry => {
            const entryDate = new Date(entry.date)
            const dateKey = entryDate.toISOString().split('T')[0]
            
            if (entry.weight !== null && 
                entry.weight !== undefined && 
                typeof entry.weight === 'number' && 
                !isNaN(entry.weight) &&
                previousDayMap.has(dateKey)) {
              hasWeightData = true
            }
          })
          
          // Legacy: keep entriesInRange and entriesWithWeight for logging
          const entriesInRange = data.filter(entry => {
            const entryDate = new Date(entry.date)
            const entryDateStr = entryDate.toISOString().split('T')[0]
            return entryDateStr >= startDateStr && entryDateStr <= endDateStr
          })
          
          const entriesWithWeight = entriesInRange.filter(entry => 
            entry.weight !== null && 
            entry.weight !== undefined && 
            typeof entry.weight === 'number' && 
            !isNaN(entry.weight)
          )
          
          console.log(`📊 WeightHistory: Previous period (${viewMode}, offset ${dateRangeOffset + 1}) check:`, {
            hasWeightData,
            range: `${startDateStr} to ${endDateStr}`,
            totalEntries: data.length,
            entriesInRange: entriesInRange.length,
            entriesWithWeight: entriesInRange.filter(e => e.weight !== null && typeof e.weight === 'number' && !isNaN(e.weight)).length
          })
          
          setHasPreviousPeriodData(hasWeightData)
        } else {
          console.log(`📊 WeightHistory: Failed to fetch previous period data, disabling navigation`)
          setHasPreviousPeriodData(false)
        }
      } catch (error) {
        console.error('Failed to check previous period data:', error)
        setHasPreviousPeriodData(false) // Disable on error to be safe
      }
    }
    
    checkPreviousPeriodData()
  }, [user?.sub, user?.lastSync, viewMode, dateRangeOffset])

  // Navigate date range
  const navigateDateRange = (direction) => {
    if (direction === 'next') {
      // Going forward in time (towards future)
      setDateRangeOffset(prev => prev - 1)
    } else {
      // Going backward in time (towards past)
      // Prevent navigation if previous period has no data
      if (!hasPreviousPeriodData) {
        return
      }
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

  // Calculate chart dimensions and scaling for weight
  const getChartData = () => {
    if (historyData.length === 0) {
      return { minWeight: 0, maxWeight: 200, points: [] }
    }
    
    const weights = historyData.map(d => d.weight).filter(w => w !== null && w !== undefined)
    if (weights.length === 0) {
      return { minWeight: 0, maxWeight: 200, points: [] }
    }
    
    // Calculate average weight
    const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length
    
    // Create a 30 lb range centered around the average, rounded to 10 lb increments
    // Bottom will be average - 15, rounded down to nearest 10
    const bottomWeight = Math.floor((averageWeight - 15) / 10) * 10
    const topWeight = bottomWeight + 30
    
    // Ensure minimum weight is at least 0
    const minWeight = Math.max(0, bottomWeight)
    const maxWeight = topWeight
    
    // Calculate date range directly from viewMode to avoid race condition
    // Use currentDateRange if it matches viewMode, otherwise calculate fresh
    const effectiveDateRange = calculateDateRange(viewMode, dateRangeOffset)
    
    // Generate all days in the date range to calculate correct X positions
    const allDays = []
    if (effectiveDateRange.start && effectiveDateRange.end) {
      for (let d = new Date(effectiveDateRange.start); d <= effectiveDateRange.end; d.setDate(d.getDate() + 1)) {
        allDays.push(new Date(d))
      }
    }
    
    // Filter historyData to only include entries within the effective date range
    const effectiveStartDate = effectiveDateRange.start?.toISOString().split('T')[0]
    const effectiveEndDate = effectiveDateRange.end?.toISOString().split('T')[0]
    
    const filteredHistoryData = effectiveStartDate && effectiveEndDate
      ? historyData.filter((day) => {
          // Ensure date is a Date object
          const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
          const dayDateKey = dayDate.toISOString().split('T')[0]
          const inRange = dayDateKey >= effectiveStartDate && dayDateKey <= effectiveEndDate
          return inRange
        })
      : historyData // Fallback to all data if date range is invalid
    
    // Create a map of all days by date key for quick lookup
    const allDaysByDate = new Map()
    allDays.forEach((day, index) => {
      const dateKey = day.toISOString().split('T')[0]
      allDaysByDate.set(dateKey, index)
    })
    
    const points = filteredHistoryData.map((day) => {
      // Ensure date is a Date object
      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
      const dateKey = dayDate.toISOString().split('T')[0]
      const dayIndex = allDaysByDate.get(dateKey) ?? 0
      return {
        ...day,
        date: dayDate, // Use normalized date
        index: dayIndex,
        x: dayIndex,
        y: day.weight
      }
    })
    
    return { minWeight, maxWeight, points }
  }

  const { minWeight, maxWeight, points } = getChartData()
  const todayWeight = historyData.find(d => d.isToday)?.weight || null
  
  // Use selected day or default to most recent, or today if no data
  const rawDisplayDay = selectedDay || (historyData.length > 0 ? historyData[historyData.length - 1] : { 
    date: currentDateRange.end || new Date(), 
    weight: null, 
    isToday: currentDateRange.end ? new Date(currentDateRange.end).toDateString() === new Date().toDateString() : false 
  })
  
  // Ensure date is always a Date object (it might be a string from cache/API)
  const displayDay = {
    ...rawDisplayDay,
    date: rawDisplayDay.date instanceof Date ? rawDisplayDay.date : new Date(rawDisplayDay.date)
  }
  
  // Calculate weight loss percentage (compared to first weight in current period)
  const calculateWeightLossPercentage = () => {
    if (!displayDay.weight || historyData.length === 0) return null
    
    // Find the earliest weight in the current period (first entry in sorted historyData)
    const firstWeight = historyData[0]?.weight
    if (!firstWeight || firstWeight === displayDay.weight) return null
    
    // Calculate percentage change
    const change = displayDay.weight - firstWeight
    const percentage = (change / firstWeight) * 100
    
    return {
      percentage: Math.abs(percentage),
      isLoss: change < 0,
      change: Math.abs(change)
    }
  }
  
  const weightLossData = calculateWeightLossPercentage()
  
  // Handle point click
  const handlePointClick = (point) => {
    setSelectedDay(point)
  }


  return (
    <>
      {/* Edge-to-edge header - spans full width */}
      <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
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
          <h1 className="text-xl font-bold flex-1 text-center text-white">WEIGHT HISTORY</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="w-full bg-gray-50 min-h-screen relative">
        {/* Main content with bottom navigation offset and top padding for fixed header */}
        <main className="px-0 py-6 pb-24 safe-area-content">
        {(() => {
          if (loading && !hasEverBeenReadyRef.current) {
            return (
              <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )
          }
          
          console.log('📊 WeightHistory: Rendering data view with', historyData.length, 'data points')
          
          return (
          <div className="space-y-6">
            {/* Selected Day's Weight */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-800 rounded-2xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs opacity-90 mb-0.5">
                    {displayDay.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    {displayDay.weight !== null && displayDay.weight !== undefined 
                      ? `${displayDay.weight.toFixed(1)} lbs` 
                      : 'N/A'}
                  </div>
                  <div className="text-xs opacity-75">
                    {displayDay.isToday ? 'Weight Today' : 'Weight'}
                  </div>
                </div>
                {weightLossData && (
                  <div className="flex flex-col items-end text-right">
                    <div className="text-xl font-bold">
                      {weightLossData.isLoss ? '-' : '+'}{weightLossData.percentage.toFixed(1)}%
                    </div>
                    <div className="text-xs opacity-75">
                      {weightLossData.change.toFixed(1)} lbs
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Graph */}
            <div className="bg-white rounded-xl px-4 py-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Weight Trend</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* Time Period Selector (W/M buttons) */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => {
                        setViewMode('W')
                      }}
                      className={`px-3 py-1 rounded-md font-semibold text-sm transition-all ${
                        viewMode === 'W'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      W
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('M')
                      }}
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
                      className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Previous period"
                      disabled={!hasPreviousPeriodData}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={hasPreviousPeriodData ? 'text-gray-600' : 'text-gray-300'}>
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
                      disabled={(() => {
                        if (!currentDateRange.end) return true
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const endDate = new Date(currentDateRange.end)
                        endDate.setHours(0, 0, 0, 0)
                        // Disable if end date is today or in the future
                        return endDate >= today
                      })()}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={(() => {
                        if (!currentDateRange.end) return 'text-gray-300'
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const endDate = new Date(currentDateRange.end)
                        endDate.setHours(0, 0, 0, 0)
                        return endDate >= today ? 'text-gray-300' : 'text-gray-600'
                      })()}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="px-[2px] pb-8">
                <div ref={chartContainerRef} className="relative" style={{ height: '320px' }}>
                {/* Y-axis labels as HTML - independent of SVG */}
                {(() => {
                  const containerHeight = 320 // Match container and viewBox height
                  const weightRange = maxWeight - minWeight || 1 // Prevent division by zero
                  
                  // Show labels in 10 lb increments: minWeight, minWeight+10, minWeight+20, minWeight+30
                  const ticks = []
                  for (let i = 0; i <= 3; i++) {
                    ticks.push(minWeight + (i * 10))
                  }
                  
                  return (
                    <>
                      {ticks.map((value, i) => {
                        // Calculate Y position using same calculation as grid lines
                        const topBuffer = 20
                        const bottomBuffer = 10
                        const availableHeight = containerHeight - topBuffer - bottomBuffer
                        const normalizedValue = (value - minWeight) / weightRange
                        const svgY = topBuffer + availableHeight - (normalizedValue * availableHeight)
                        // Convert to percentage of container height (now matches viewBox)
                        const topPosition = (svgY / containerHeight) * 100
                        
                        return (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: '-30px',
                              top: `${topPosition}%`,
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#6b7280',
                              transform: 'translateY(-50%)',
                              zIndex: 10,
                              pointerEvents: 'none',
                              textAlign: 'right',
                              width: '50px'
                            }}
                          >
                            {value.toFixed(0)}
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
                
                <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${chartWidth} 320`} preserveAspectRatio="none">
                  {/* Grid lines */}
                  {(() => {
                    const containerHeight = 320 // Match label coordinate system
                    const weightRange = maxWeight - minWeight || 1
                    
                    // Show grid lines in 10 lb increments: minWeight+10, minWeight+20, minWeight+30
                    // Skip the first one (minWeight) as it's at the baseline
                    const ticks = []
                    for (let i = 1; i <= 3; i++) {
                      ticks.push(minWeight + (i * 10))
                    }
                    
                    const labelOffset = 80
                    const horizontalPadding = 20
                    const gridStartX = labelOffset + horizontalPadding
                    const gridEndX = chartWidth - horizontalPadding
                    
                    return ticks.map((value, i) => {
                      const containerHeight = 320 // Match container and viewBox height
                      const topBuffer = 20
                      const bottomBuffer = 10
                      const availableHeight = containerHeight - topBuffer - bottomBuffer
                      const weightRange = maxWeight - minWeight || 1 // Prevent division by zero
                      const normalizedValue = (value - minWeight) / weightRange
                      // Use same calculation as labels - now in containerHeight coordinate system
                      const y = topBuffer + availableHeight - (normalizedValue * availableHeight)
                      
                      return (
                        <line
                          key={i}
                          x1={gridStartX}
                          y1={y}
                          x2={gridEndX}
                          y2={y}
                          stroke="#e5e7eb"
                          strokeWidth="2"
                        />
                      )
                    })
                  })()}
                  
                  {/* X-axis line at base of graph */}
                  {(() => {
                    const containerHeight = 320 // Match container and viewBox height
                    const topBuffer = 20
                    const bottomBuffer = 10
                    const availableHeight = containerHeight - topBuffer - bottomBuffer
                    const weightRange = maxWeight - minWeight || 1
                    // Baseline is at minWeight, which should be at the bottom
                    const normalizedValue = (minWeight - minWeight) / weightRange
                    // Use same calculation as labels and grid lines
                    const baselineY = topBuffer + availableHeight - (normalizedValue * availableHeight)
                    
                    return (
                      <line
                        x1={80 + 20}
                        y1={baselineY}
                        x2={chartWidth - 20}
                        y2={baselineY}
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                    )
                  })()}
                  
                  {/* Blue line connecting data points - removed from SVG, rendered outside for perfect alignment */}
                  
                </svg>
                
                {/* Blue line connecting data points - rendered outside SVG for perfect alignment with dots */}
                {points.length >= 2 && (() => {
                  if (!currentDateRange.start || !currentDateRange.end) return null
                  
                  const chartHeight = 320
                  const topBuffer = 20
                  const bottomBuffer = 10
                  const availableHeight = chartHeight - topBuffer - bottomBuffer
                  const weightRange = maxWeight - minWeight || 1
                  
                  // Generate all days array to get total count for index-based positioning
                  const allDays = []
                  if (currentDateRange.start && currentDateRange.end) {
                    for (let d = new Date(currentDateRange.start); d <= currentDateRange.end; d.setDate(d.getDate() + 1)) {
                      allDays.push(new Date(d))
                    }
                  }
                  const totalDaysCount = allDays.length
                  
                  // Create a map to verify indices match
                  const allDaysByDateMap = new Map()
                  allDays.forEach((day, idx) => {
                    const dateKey = day.toISOString().split('T')[0]
                    allDaysByDateMap.set(dateKey, idx)
                  })
                  
                  // Get label container dimensions (same width as chart container)
                  const labelContainer = document.querySelector('[style*="paddingLeft: \'30px\'"]')
                  const containerElement = chartContainerRef.current
                  if (!containerElement) return null
                  
                  const svgHeight = containerElement.clientHeight
                  const svgWidth = containerElement.clientWidth
                  if (svgHeight === 0) return null
                  
                  // Use chart container width as fallback since they should be the same
                  const labelContainerWidth = labelContainer?.clientWidth || svgWidth
                  const labelPaddingLeft = 30
                  const labelPaddingRight = 10
                  const labelAvailableWidth = Math.max(0, labelContainerWidth - labelPaddingLeft - labelPaddingRight)
                  
                  if (labelAvailableWidth <= 0) return null
                  
                  // Calculate offset between label container and chart container
                  const chartContainerRect = containerElement.getBoundingClientRect()
                  const labelContainerRect = labelContainer?.getBoundingClientRect()
                  const containerOffsetX = labelContainerRect ? (labelContainerRect.left - chartContainerRect.left) : 0
                  
                  const scaleY = svgHeight / 320
                  const svgOffsetX = 2
                  const svgOffsetY = 0
                  
                  // Sort points by date to connect them in order
                  const sortedPoints = [...points].sort((a, b) => a.date - b.date)
                  
                  // Calculate line segments between consecutive points
                  const lineSegments = []
                  let prevPoint = null
                  
                  sortedPoints.forEach((point) => {
                    const pointDateStr = new Date(point.date).toISOString().split('T')[0]
                    // Recalculate index from current allDays array to ensure it matches
                    const dayIndex = allDaysByDateMap.get(pointDateStr) ?? point.index ?? 0
                    
                    // Calculate label position using the same logic as data points
                    let labelX = 0
                    if (viewMode === 'M') {
                      const labelsToShow = []
                      for (let i = 0; i < totalDaysCount; i += 7) {
                        labelsToShow.push(i)
                      }
                      const lastIndex = totalDaysCount - 1
                      if (labelsToShow[labelsToShow.length - 1] !== lastIndex) {
                        labelsToShow.push(lastIndex)
                      }
                      const labelIndex = labelsToShow.indexOf(dayIndex)
                      if (labelIndex >= 0) {
                        const labelCount = labelsToShow.length
                        const labelSpacing = labelCount > 1 ? labelAvailableWidth / (labelCount - 1) : 0
                        labelX = labelPaddingLeft + (labelIndex * labelSpacing)
                      } else {
                        // Interpolate between surrounding labels
                        let lowerLabelIndex = -1
                        let upperLabelIndex = -1
                        for (let i = 0; i < labelsToShow.length - 1; i++) {
                          if (dayIndex >= labelsToShow[i] && dayIndex <= labelsToShow[i + 1]) {
                            lowerLabelIndex = i
                            upperLabelIndex = i + 1
                            break
                          }
                        }
                        if (lowerLabelIndex >= 0 && upperLabelIndex >= 0) {
                          const labelCount = labelsToShow.length
                          const labelSpacing = labelCount > 1 ? labelAvailableWidth / (labelCount - 1) : 0
                          const lowerX = labelPaddingLeft + (lowerLabelIndex * labelSpacing)
                          const upperX = labelPaddingLeft + (upperLabelIndex * labelSpacing)
                          const dayRange = labelsToShow[upperLabelIndex] - labelsToShow[lowerLabelIndex]
                          const dayOffset = dayIndex - labelsToShow[lowerLabelIndex]
                          const ratio = dayRange > 0 ? dayOffset / dayRange : 0
                          labelX = lowerX + (upperX - lowerX) * ratio
                        }
                      }
                    } else {
                      // Week view: all days are labels, evenly spaced
                      const labelSpacing = totalDaysCount > 1 ? labelAvailableWidth / (totalDaysCount - 1) : 0
                      labelX = labelPaddingLeft + (dayIndex * labelSpacing)
                    }
                    
                    // Convert label X position to chart container coordinate system (same as data points)
                    // Use labelPaddingLeft instead of svgOffsetX to align with y-axis label area
                    const screenX = (labelX - labelPaddingLeft) + containerOffsetX + labelPaddingLeft
                    
                    // Calculate Y position
                    const normalizedWeight = (point.weight - minWeight) / weightRange
                    const svgY = topBuffer + availableHeight - (normalizedWeight * availableHeight)
                    const screenY = svgOffsetY + (svgY * scaleY)
                    
                    if (prevPoint) {
                      lineSegments.push({ x1: prevPoint.x, y1: prevPoint.y, x2: screenX, y2: screenY })
                    }
                    prevPoint = { x: screenX, y: screenY }
                  })
                  
                  return (
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 15
                      }}
                    >
                      {lineSegments.map((segment, idx) => (
                        <line
                          key={idx}
                          x1={segment.x1}
                          y1={segment.y1}
                          x2={segment.x2}
                          y2={segment.y2}
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </svg>
                  )
                })()}
                
                {/* Data points as circles - rendered outside SVG for 1:1 ratio */}
                {(() => {
                  if (!currentDateRange.start || !currentDateRange.end) return null
                  
                  const labelOffset = 80
                  const horizontalPadding = 20
                  const availableWidth = chartWidth - labelOffset - (horizontalPadding * 2)
                  
                  const chartHeight = 320
                  const topBuffer = 20
                  const bottomBuffer = 10
                  const availableHeight = chartHeight - topBuffer - bottomBuffer
                  const weightRange = maxWeight - minWeight || 1
                  
                  // Generate all days array to get total count for index-based positioning
                  const allDays = []
                  if (currentDateRange.start && currentDateRange.end) {
                    for (let d = new Date(currentDateRange.start); d <= currentDateRange.end; d.setDate(d.getDate() + 1)) {
                      allDays.push(new Date(d))
                    }
                  }
                  const totalDaysCount = allDays.length
                  const totalIntervalsForIndex = Math.max(1, totalDaysCount - 1)
                  
                  // Create a map to verify indices match
                  const allDaysByDateMap = new Map()
                  allDays.forEach((day, idx) => {
                    const dateKey = day.toISOString().split('T')[0]
                    allDaysByDateMap.set(dateKey, idx)
                  })
                  
                  // Calculate label positions for month view (same logic as X-axis labels)
                  let labelPositions = []
                  if (viewMode === 'M') {
                    const labelsToShow = []
                    for (let i = 0; i < totalDaysCount; i += 7) {
                      labelsToShow.push(i)
                    }
                    const lastIndex = totalDaysCount - 1
                    if (labelsToShow[labelsToShow.length - 1] !== lastIndex) {
                      labelsToShow.push(lastIndex)
                    }
                    // With justify-between, labels are evenly spaced: labelPos / (labelsToShow.length - 1)
                    labelPositions = labelsToShow.map((dayIdx, labelPos) => ({
                      dayIndex: dayIdx,
                      positionRatio: labelsToShow.length > 1 ? labelPos / (labelsToShow.length - 1) : 0
                    }))
                  } else {
                    // Week view: all days evenly spaced
                    labelPositions = allDays.map((_, idx) => ({
                      dayIndex: idx,
                      positionRatio: totalDaysCount > 1 ? idx / (totalDaysCount - 1) : 0
                    }))
                  }
                  
                  // Helper function to interpolate position between label positions
                  const getPositionRatio = (dayIndex) => {
                    if (labelPositions.length === 0) return 0
                    if (dayIndex <= labelPositions[0].dayIndex) return labelPositions[0].positionRatio
                    if (dayIndex >= labelPositions[labelPositions.length - 1].dayIndex) {
                      return labelPositions[labelPositions.length - 1].positionRatio
                    }
                    // Find the two label positions to interpolate between
                    for (let i = 0; i < labelPositions.length - 1; i++) {
                      const lower = labelPositions[i]
                      const upper = labelPositions[i + 1]
                      if (dayIndex >= lower.dayIndex && dayIndex <= upper.dayIndex) {
                        // Linear interpolation
                        const range = upper.dayIndex - lower.dayIndex
                        const offset = dayIndex - lower.dayIndex
                        const ratio = range > 0 ? offset / range : 0
                        return lower.positionRatio + (upper.positionRatio - lower.positionRatio) * ratio
                      }
                    }
                    return 0
                  }
                  
                  // Get actual SVG and container elements to calculate correct scaling
                  const svgElement = svgRef.current
                  const containerElement = chartContainerRef.current
                  
                  if (!svgElement || !containerElement) {
                    return null
                  }
                  
                  // Use clientWidth/clientHeight which account for padding
                  // The container has px-[2px] which is 2px horizontal padding
                  const svgWidth = containerElement.clientWidth
                  const svgHeight = containerElement.clientHeight
                  
                  // Ensure we have valid dimensions
                  if (svgWidth === 0 || svgHeight === 0) {
                    return null
                  }
                  
                  // Calculate scale factors from viewBox to actual rendered size
                  // The SVG scales non-uniformly with preserveAspectRatio="none"
                  const scaleX = svgWidth / chartWidth
                  const scaleY = svgHeight / 320
                  
                  // SVG is positioned at the top-left of the container (accounting for padding)
                  // Since container has px-[2px], the SVG starts 2px from the left
                  const svgOffsetX = 2 // px-[2px] = 2px left padding
                  const svgOffsetY = 0 // No top padding on the container div
                  
                  // Get label container dimensions (same width as chart container)
                  // Use chart container width as fallback since they should be the same
                  const labelContainer = document.querySelector('[style*="paddingLeft: \'30px\'"]')
                  const labelContainerWidth = labelContainer?.clientWidth || svgWidth
                  const labelPaddingLeft = 30
                  const labelPaddingRight = 10
                  const labelAvailableWidth = Math.max(0, labelContainerWidth - labelPaddingLeft - labelPaddingRight)
                  
                  // Calculate offset between label container and chart container
                  const chartContainerRect = containerElement.getBoundingClientRect()
                  const labelContainerRect = labelContainer?.getBoundingClientRect()
                  const containerOffsetX = labelContainerRect ? (labelContainerRect.left - chartContainerRect.left) : 0
                  
                  // Ensure we have valid label container dimensions
                  if (labelAvailableWidth <= 0) {
                    return null
                  }
                  
                  return points.map((point) => {
                    const pointDateStr = new Date(point.date).toISOString().split('T')[0]
                    // Recalculate index from current allDays array to ensure it matches
                    const dayIndex = allDaysByDateMap.get(pointDateStr) ?? point.index ?? 0
                    
                    // Calculate label position using the same logic as the label container
                    // Labels use justify-between with paddingLeft: 30px, paddingRight: 10px
                    let labelX = 0
                    if (viewMode === 'M') {
                      // Month view: labels at indices 0, 7, 14, 21, 28, 29 (last day)
                      const labelsToShow = []
                      for (let i = 0; i < totalDaysCount; i += 7) {
                        labelsToShow.push(i)
                      }
                      const lastIndex = totalDaysCount - 1
                      if (labelsToShow[labelsToShow.length - 1] !== lastIndex) {
                        labelsToShow.push(lastIndex)
                      }
                      const labelIndex = labelsToShow.indexOf(dayIndex)
                      if (labelIndex >= 0) {
                        // This is a label day - use exact label position
                        const labelCount = labelsToShow.length
                        const labelSpacing = labelCount > 1 ? labelAvailableWidth / (labelCount - 1) : 0
                        labelX = labelPaddingLeft + (labelIndex * labelSpacing)
                      } else {
                        // Interpolate between surrounding labels
                        const labelsToShow = []
                        for (let i = 0; i < totalDaysCount; i += 7) {
                          labelsToShow.push(i)
                        }
                        const lastIndex = totalDaysCount - 1
                        if (labelsToShow[labelsToShow.length - 1] !== lastIndex) {
                          labelsToShow.push(lastIndex)
                        }
                        // Find surrounding labels
                        let lowerLabelIndex = -1
                        let upperLabelIndex = -1
                        for (let i = 0; i < labelsToShow.length - 1; i++) {
                          if (dayIndex >= labelsToShow[i] && dayIndex <= labelsToShow[i + 1]) {
                            lowerLabelIndex = i
                            upperLabelIndex = i + 1
                            break
                          }
                        }
                        if (lowerLabelIndex >= 0 && upperLabelIndex >= 0) {
                          const labelCount = labelsToShow.length
                          const labelSpacing = labelCount > 1 ? labelAvailableWidth / (labelCount - 1) : 0
                          const lowerX = labelPaddingLeft + (lowerLabelIndex * labelSpacing)
                          const upperX = labelPaddingLeft + (upperLabelIndex * labelSpacing)
                          const dayRange = labelsToShow[upperLabelIndex] - labelsToShow[lowerLabelIndex]
                          const dayOffset = dayIndex - labelsToShow[lowerLabelIndex]
                          const ratio = dayRange > 0 ? dayOffset / dayRange : 0
                          labelX = lowerX + (upperX - lowerX) * ratio
                        } else {
                          // Fallback to position ratio method
                          const positionRatio = getPositionRatio(dayIndex)
                          labelX = labelPaddingLeft + (positionRatio * labelAvailableWidth)
                        }
                      }
                    } else {
                      // Week view: all days are labels, evenly spaced
                      const labelSpacing = totalDaysCount > 1 ? labelAvailableWidth / (totalDaysCount - 1) : 0
                      labelX = labelPaddingLeft + (dayIndex * labelSpacing)
                    }
                    
                    // Convert label X position to chart container coordinate system
                    // labelX is relative to the label container (includes its paddingLeft: 30px)
                    // The label container's paddingLeft (30px) aligns with the y-axis label area
                    // Y-axis labels are positioned at left: '-30px' relative to chart container
                    // So data points should start at 30px from chart container left to align with first label
                    // labelX - labelPaddingLeft gives position relative to label container's content area start
                    // Then add containerOffsetX to convert to chart container coordinates
                    // Then add labelPaddingLeft (30px) to account for y-axis label area alignment
                    const screenX = (labelX - labelPaddingLeft) + containerOffsetX + labelPaddingLeft
                    
                    // Calculate Y position using existing logic
                    const normalizedWeight = (point.weight - minWeight) / weightRange
                    const svgY = topBuffer + availableHeight - (normalizedWeight * availableHeight)
                    const screenY = svgOffsetY + (svgY * scaleY)
                    
                    const selectedDayDate = selectedDay?.date instanceof Date ? selectedDay.date : selectedDay?.date ? new Date(selectedDay.date) : null
                    const pointDate = point.date instanceof Date ? point.date : new Date(point.date)
                    const isSelected = selectedDayDate && pointDate.toDateString() === selectedDayDate.toDateString()
                    const radius = isSelected ? 6 : 4
                    
                    return (
                      <div
                        key={point.date.toISOString()}
                        style={{
                          position: 'absolute',
                          left: `${screenX}px`,
                          top: `${screenY}px`,
                          width: `${radius * 2}px`,
                          height: `${radius * 2}px`,
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          border: isSelected ? '2px solid #1e40af' : 'none',
                          transform: 'translate(-50%, -50%)',
                          cursor: 'pointer',
                          zIndex: 20,
                          pointerEvents: 'auto'
                        }}
                        onClick={() => handlePointClick(point)}
                      />
                    )
                  })
                })()}
                
                {/* X-axis labels */}
                <div className="flex justify-between mt-0 mb-2" style={{ paddingLeft: '30px', paddingRight: '10px' }}>
                  {currentDateRange.start && currentDateRange.end && (() => {
                    // Generate all days in the date range
                    const allDays = []
                    for (let d = new Date(currentDateRange.start); d <= currentDateRange.end; d.setDate(d.getDate() + 1)) {
                      allDays.push(new Date(d))
                    }
                    
                    if (viewMode === 'M') {
                      // Month view: Show labels every 7 days, plus the last day (today)
                      const labelsToShow = []
                      for (let i = 0; i < allDays.length; i += 7) {
                        labelsToShow.push(i)
                      }
                      // Always include the last day (today) at the right
                      const lastIndex = allDays.length - 1
                      if (labelsToShow[labelsToShow.length - 1] !== lastIndex) {
                        labelsToShow.push(lastIndex)
                      }
                      
                      return labelsToShow.map((dayIndex) => {
                        const day = allDays[dayIndex]
                        return (
                          <div key={dayIndex} className="flex flex-col items-center text-xs text-gray-500">
                            <span className="font-semibold">{day.getDate()}</span>
                            <span>{day.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                          </div>
                        )
                      })
                    } else {
                      // Week view: Show all 7 days with day of week
                      return allDays.map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center text-xs text-gray-500">
                          <span className="font-semibold">{day.getDate()}</span>
                          <span>{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                        </div>
                      ))
                    }
                  })()}
                </div>
              </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-4">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" className="text-blue-600 mt-0.5 flex-shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-blue-800">
                Track your weight progress over time. Click on any data point to see details for that day.
              </p>
            </div>
          </div>
          )
        })()}
      </main>
    </div>
    </>
  )
}

export default WeightHistory

