import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/UserContext'
import { useChallenge } from '../context/ChallengeContext'
import { fetchWithAuth, getApiUrl } from '../utils/apiService'
import PageHeader from '../components/ui/PageHeader'
import Icon from '../components/ui/Icon'
import LineChart from '../components/ui/LineChart'

/**
 * WeightHistory Page Component
 * 
 * Features:
 * - Line graph showing daily weight measurements
 * - Week and Month view options
 * - Line with selectable data points
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


  // Chart geometry: one slot per day in the visible range
  const chartRange = calculateDateRange(viewMode, dateRangeOffset)
  const chartDays = []
  if (chartRange.start && chartRange.end) {
    for (let d = new Date(chartRange.start); d <= chartRange.end; d.setDate(d.getDate() + 1)) {
      chartDays.push(new Date(d))
    }
  }
  const chartTicks = [0, 1, 2, 3].map((i) => minWeight + i * 10)
  const chartXLabels = (() => {
    if (chartDays.length === 0) return []
    if (viewMode === 'W') {
      return chartDays.map((d, i) => ({ index: i, top: d.getDate(), bottom: d.toLocaleDateString('en-US', { weekday: 'short' }) }))
    }
    const idx = []
    for (let i = 0; i < chartDays.length; i += 7) idx.push(i)
    if (idx[idx.length - 1] !== chartDays.length - 1 && chartDays.length - 1 - idx[idx.length - 1] >= 3) idx.push(chartDays.length - 1)
    return idx.map((i) => ({ index: i, top: chartDays[i].getDate(), bottom: chartDays[i].toLocaleDateString('en-US', { month: 'short' }) }))
  })()
  const selectedDayDate = selectedDay?.date instanceof Date ? selectedDay.date : selectedDay?.date ? new Date(selectedDay.date) : null
  const chartPoints = points
    .filter((p) => p.weight !== null && p.weight !== undefined)
    .map((p) => ({
      ...p,
      key: p.date.toISOString(),
      value: p.weight,
      isSelected: !!selectedDayDate && p.date.toDateString() === selectedDayDate.toDateString(),
      ariaLabel: `${p.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${p.weight.toFixed(1)} lbs`,
    }))
  const nextDisabled = (() => {
    if (!currentDateRange.end) return true
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(currentDateRange.end)
    endDate.setHours(0, 0, 0, 0)
    return endDate >= today
  })()

  return (
    <>
      <PageHeader title="Weight history" back />

      <div className="page">
        {loading && !hasEverBeenReadyRef.current ? (
          <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
            <div className="skeleton h-40" />
            <div className="skeleton h-72 lg:col-span-2" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            {/* Selected day */}
            <section className="card-brand self-start p-5" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                {displayDay.isToday ? 'Today' : displayDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {displayDay.weight !== null && displayDay.weight !== undefined ? displayDay.weight.toFixed(1) : 'N/A'}
                </span>
                {displayDay.weight !== null && displayDay.weight !== undefined && <span className="text-sm text-blue-100">lbs</span>}
              </div>
              {weightLossData && (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-[rgb(255_255_255/0.12)] px-3 py-2">
                  <Icon name={weightLossData.isLoss ? 'trending-down' : 'trending-up'} className="h-5 w-5 text-white" />
                  <div className="text-sm text-white">
                    <span className="font-bold">
                      {weightLossData.isLoss ? '-' : '+'}
                      {weightLossData.percentage.toFixed(1)}%
                    </span>
                    <span className="text-blue-100"> ({weightLossData.change.toFixed(1)} lbs) this period</span>
                  </div>
                </div>
              )}
            </section>

            {/* Chart */}
            <section className="card card-pad min-w-0 lg:col-span-2" aria-labelledby="weight-chart-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="weight-chart-title" className="card-title">Weight trend</h2>
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
                    <button
                      onClick={() => navigateDateRange('prev')}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous period"
                      disabled={!hasPreviousPeriodData}
                    >
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

              {chartPoints.length === 0 ? (
                <div className="flex h-[260px] flex-col items-center justify-center text-center text-sm text-ink-muted">
                  <Icon name="scale" className="mb-2 h-8 w-8 text-ink-subtle" />
                  No weigh-ins in this period.
                </div>
              ) : (
                <LineChart
                  slots={chartDays.length}
                  points={chartPoints}
                  yMin={minWeight}
                  yMax={maxWeight}
                  ticks={chartTicks}
                  xLabels={chartXLabels}
                  onSelect={handlePointClick}
                  formatTick={(v) => v.toFixed(0)}
                />
              )}
            </section>

            <div className="callout callout-info lg:col-span-3">
              <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Track your weight over time. Tap any point to see that day.</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default WeightHistory
