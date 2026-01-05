import { useState } from 'react'

const useGoogleFit = () => {
  const [steps, setSteps] = useState(null)
  const [weight, setWeight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  const syncSteps = async (token) => {
    setLoading(true)
    setError(null)

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()

    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGoogleFit.js:19',message:'useGoogleFit API call - before fetch',data:{hasToken:!!token,tokenLength:token?token.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      let response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.weight' }
          ],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: start.getTime(),
          endTimeMillis: end.getTime()
        }),
      })
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/c7863d5d-8e4d-45b7-84a6-daf3883297fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGoogleFit.js:34',message:'useGoogleFit API call - after fetch',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // If we get 401 (Unauthorized), the token is invalid
      if (response.status === 401) {
        console.log('⚠️ Token invalid (401) on useGoogleFit API call');
        // Check if there's a newer token in localStorage (might have been refreshed elsewhere)
        const newToken = localStorage.getItem('fitapp_access_token');
        if (newToken && newToken !== token) {
          console.log('🔄 Found newer token in localStorage, retrying with new token...');
          response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              aggregateBy: [
                { dataTypeName: 'com.google.step_count.delta' },
                { dataTypeName: 'com.google.weight' }
              ],
              bucketByTime: { durationMillis: 86400000 },
              startTimeMillis: start.getTime(),
              endTimeMillis: end.getTime()
            }),
          });
          console.log('📥 Retry useGoogleFit API call response status:', response.status, response.statusText);
        }
      }

      const raw = await response.text()
      console.log('📡 Google Fit raw response:', raw)

      if (!response.ok) {
        throw new Error(`Google Fit API error: ${response.status}`)
      }

      const data = JSON.parse(raw)
      const bucket = data.bucket?.[0]
      if (!bucket || !bucket.dataset) {
        throw new Error('Empty bucket or missing dataset')
      }

      const stepsData = bucket.dataset.find(d =>
        d.dataSourceId?.includes('step_count.delta')
      )
      const weightData = bucket.dataset.find(d =>
        d.dataSourceId?.includes('weight.summary') || d.dataSourceId?.includes('weight')
      )

      const stepsVal = stepsData?.point?.[0]?.value?.find(v => 'intVal' in v)?.intVal ?? 0

      const allWeightVals = weightData?.point
        ?.flatMap(p => p.value.map(v => v.fpVal))
        ?.filter(Number.isFinite) ?? []

      const weightVal = allWeightVals.length
        ? allWeightVals.reduce((sum, val) => sum + val, 0) / allWeightVals.length
        : null

      setSteps(stepsVal)
      setWeight(weightVal)
      setLastSync(new Date())

      // Sync with backend to update user data and calculate points
      await syncWithBackend(stepsVal, weightVal)

    } catch (err) {
      console.error('❌ Google Fit sync error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const syncWithBackend = async (steps, weight) => {
    try {
      const user = JSON.parse(localStorage.getItem('fitapp_user'))
      if (!user) {
        console.log('⚠️ No user found in localStorage')
        return
      }

      // Get active challenge from localStorage
      const activeChallenge = JSON.parse(localStorage.getItem('fitapp_challenge'))
      const challengeIds = activeChallenge?._id ? [activeChallenge._id] : []

      const apiUrl = import.meta.env.VITE_API_URL || 'https://fitappbackend.herringm.com'
      console.log('🔄 Syncing with backend:', { steps, weight, userId: user.sub, challengeIds })

      const response = await fetch(`${apiUrl}/api/user/userdata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: user.sub,
          name: user.name,
          email: user.email,
          steps: steps,
          weight: weight,
          challengeIds: challengeIds
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Backend sync successful:', result)
        return result
      } else {
        const error = await response.json()
        console.error('❌ Backend sync failed:', error)
        throw new Error(error.error || 'Backend sync failed')
      }
    } catch (err) {
      console.error('❌ Backend sync error:', err)
      throw err
    }
  }

  return { steps, weight, syncSteps, loading, error, lastSync }
}

export default useGoogleFit
