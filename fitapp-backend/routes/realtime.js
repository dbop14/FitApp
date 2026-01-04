const express = require('express')
const router = express.Router()
const User = require('../models/User')
const ChallengeParticipant = require('../models/ChallengeParticipant')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

// Store active SSE connections
const activeConnections = new Map()

// Helper function to safely write debug logs
const writeDebugLog = (location, message, data, hypothesisId) => {
  try {
    const logPath = '/Volumes/docker/fitapp/.cursor/debug.log'
    const logDir = path.dirname(logPath)
    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const logEntry = JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId
    }) + '\n'
    fs.appendFileSync(logPath, logEntry)
  } catch (logError) {
    // Silently fail if logging directory doesn't exist (e.g., in Docker container)
    // Only log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Debug log write failed:', logError.message)
    }
  }
}

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret')
  } catch (error) {
    return null
  }
}

// SSE endpoint for user data updates
router.get('/events/:googleId', async (req, res) => {
  const { googleId } = req.params
  // Accept token from query param (EventSource doesn't support headers)
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  // Verify JWT token
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
  }
  
  // Verify user can only access their own data
  if (decoded.googleId !== googleId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  // Force HTTP/1.1 or HTTP/2 - SSE doesn't work reliably with HTTP/3/QUIC
  // Set Alt-Svc header to clear any HTTP/3 hints (if supported by proxy)
  res.setHeader('Alt-Svc', 'clear')
  // Additional header to hint at HTTP/1.1 compatibility
  res.setHeader('X-Protocol-Version', 'HTTP/1.1')
  
  // #region agent log
  writeDebugLog('realtime.js:44', 'Setting SSE headers', {headersSet:true,protocol:req.protocol,httpVersion:req.httpVersion}, 'D')
  // #endregion
  
  // Flush headers immediately to establish connection
  res.flushHeaders()
  
  // Send initial connection message
  res.write(`: connected\n\n`)
  
  // Flush the initial message to ensure it's sent immediately
  if (typeof res.flush === 'function') {
    res.flush()
  }
  
  // #region agent log
  writeDebugLog('realtime.js:48', 'Initial connection message sent', {connectionId:`${googleId}-${Date.now()}`}, 'B')
  // #endregion
  
  // Store connection
  const connectionId = `${googleId}-${Date.now()}`
  activeConnections.set(connectionId, { res, googleId, lastSent: null })
  
  console.log(`✅ SSE connection established for user ${googleId} (${connectionId})`)
  
  // #region agent log
  writeDebugLog('realtime.js:53', 'SSE connection stored', {connectionId,activeConnectionsCount:activeConnections.size,resWritable:!res.destroyed && !res.closed}, 'B')
  // #endregion
  
  // Send initial data
  try {
    // #region agent log
    writeDebugLog('realtime.js:56', 'Before fetching user data for initial send', {connectionId,resWritable:!res.destroyed && !res.closed}, 'B')
    // #endregion
    
    const user = await User.findOne({ googleId })
    if (user) {
      const initialData = {
        type: 'userData',
        data: {
          steps: user.steps,
          weight: user.weight,
          lastSync: user.lastSync
        }
      }
      
      // #region agent log
      writeDebugLog('realtime.js:67', 'Before writing initial data', {connectionId,resWritable:!res.destroyed && !res.closed,dataSize:JSON.stringify(initialData).length}, 'B')
      // #endregion
      
      res.write(`data: ${JSON.stringify(initialData)}\n\n`)
      
      // Flush initial data immediately
      if (typeof res.flush === 'function') {
        res.flush()
      }
      
      // #region agent log
      writeDebugLog('realtime.js:70', 'Initial data written', {connectionId,resWritable:!res.destroyed && !res.closed}, 'B')
      // #endregion
      
      // Update lastSent to prevent duplicate initial send
      const connection = activeConnections.get(connectionId)
      if (connection) {
        connection.lastSent = {
          steps: user.steps,
          weight: user.weight,
          lastSync: user.lastSync
        }
      }
    }
  } catch (error) {
    console.error('Error sending initial data:', error)
    // #region agent log
    writeDebugLog('realtime.js:80', 'Error sending initial data', {error:error.message,stack:error.stack,connectionId}, 'B')
    // #endregion
  }
  
  // Set up MongoDB change stream for user data
  // Note: This requires MongoDB replica set or sharded cluster
  // For standalone MongoDB, we'll use polling instead
  let changeStream = null
  
  try {
    // Try to use change streams (requires replica set)
    // Check if we're connected to a replica set
    const mongoClient = User.db.client
    const adminDb = mongoClient.db().admin()
    const serverStatus = await adminDb.serverStatus()
    
    if (serverStatus.repl) {
      console.log('✅ MongoDB replica set detected, using change streams')
      changeStream = User.watch([
        { $match: { 'fullDocument.googleId': googleId } }
      ], { fullDocument: 'updateLookup' })
      
      changeStream.on('change', (change) => {
        if (change.operationType === 'update' || change.operationType === 'replace') {
          const updatedUser = change.fullDocument
          if (updatedUser && updatedUser.googleId === googleId) {
            const connections = Array.from(activeConnections.values())
              .filter(conn => conn.googleId === googleId && conn.res)
            
            connections.forEach(conn => {
              try {
                if (conn.res && !conn.res.destroyed && !conn.res.closed) {
                  const data = {
                    type: 'userData',
                    data: {
                      steps: updatedUser.steps,
                      weight: updatedUser.weight,
                      lastSync: updatedUser.lastSync
                    }
                  }
                  conn.res.write(`data: ${JSON.stringify(data)}\n\n`)
                  conn.lastSent = {
                    steps: updatedUser.steps,
                    weight: updatedUser.weight,
                    lastSync: updatedUser.lastSync
                  }
                }
              } catch (error) {
                // Connection closed - will be cleaned up on next check
                if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
                  console.error('Error writing to change stream connection:', error)
                }
              }
            })
          }
        }
      })
      
      changeStream.on('error', (error) => {
        console.error('Change stream error:', error)
        // Fall back to polling if change streams fail
        changeStream = null
      })
    } else {
      console.log('⚠️ MongoDB standalone detected, using polling fallback')
    }
  } catch (error) {
    console.log('⚠️ Change streams not available, using polling:', error.message)
    // Fall back to polling
  }
  
  // Helper to check if connection is still writable
  const isConnectionAlive = () => {
    const connection = activeConnections.get(connectionId)
    return connection && connection.res && !connection.res.destroyed && !connection.res.closed
  }
  
  // Keep-alive interval to prevent Cloudflare tunnel timeout
  // Send a comment line every 30 seconds to keep connection alive
  const keepAliveInterval = setInterval(() => {
    try {
      if (!isConnectionAlive()) {
        clearInterval(keepAliveInterval)
        return
      }
      
      const connection = activeConnections.get(connectionId)
      if (connection && connection.res && !connection.res.destroyed && !connection.res.closed) {
        // Send keep-alive comment (SSE comment lines start with :)
        connection.res.write(`: keep-alive ${Date.now()}\n\n`)
      } else {
        clearInterval(keepAliveInterval)
      }
    } catch (error) {
      // Connection closed - will be cleaned up
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
        console.error('Error sending keep-alive:', error)
      }
      clearInterval(keepAliveInterval)
    }
  }, 30000) // Send keep-alive every 30 seconds
  
  // Polling fallback (if change streams not available or failed)
  const pollInterval = setInterval(async () => {
    try {
      // Check if connection is still alive before polling
      if (!isConnectionAlive()) {
        clearInterval(pollInterval)
        clearInterval(keepAliveInterval)
        return
      }
      
      const user = await User.findOne({ googleId })
      if (user) {
        const connection = activeConnections.get(connectionId)
        
        if (connection && connection.res && !connection.res.destroyed && !connection.res.closed) {
          // Only send if data changed
          const lastSent = connection.lastSent
          const hasChanged = !lastSent || 
            lastSent.steps !== user.steps ||
            lastSent.weight !== user.weight ||
            (lastSent.lastSync?.getTime() !== user.lastSync?.getTime())
          
          if (hasChanged) {
            try {
              const data = {
                type: 'userData',
                data: {
                  steps: user.steps,
                  weight: user.weight,
                  lastSync: user.lastSync
                }
              }
              connection.res.write(`data: ${JSON.stringify(data)}\n\n`)
              connection.lastSent = {
                steps: user.steps,
                weight: user.weight,
                lastSync: user.lastSync
              }
              console.log(`📡 Sent update to ${googleId}:`, data.data)
            } catch (writeError) {
              // Connection closed while writing - clean up
              if (writeError.code === 'ECONNRESET' || writeError.code === 'EPIPE') {
                console.log(`🔌 Connection closed while writing to ${googleId}`)
                clearInterval(pollInterval)
                clearInterval(keepAliveInterval)
                activeConnections.delete(connectionId)
              } else {
                console.error('Error writing to SSE connection:', writeError)
              }
            }
          }
        } else {
          // Connection is dead, clean up
          clearInterval(pollInterval)
          clearInterval(keepAliveInterval)
          activeConnections.delete(connectionId)
        }
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, 5000) // Poll every 5 seconds
  
  // Clean up on client disconnect
  req.on('close', () => {
    // #region agent log
    writeDebugLog('realtime.js:217', 'Request close event', {connectionId,resWritable:!res.destroyed && !res.closed}, 'B')
    // #endregion
    const connection = activeConnections.get(connectionId)
    if (connection) {
      console.log(`🔌 SSE connection closed for user ${googleId} (${connectionId})`)
      activeConnections.delete(connectionId)
      if (changeStream) {
        changeStream.close().catch(() => {}) // Silently handle close errors
      }
      clearInterval(pollInterval)
      clearInterval(keepAliveInterval)
    }
  })
  
  // Handle errors
  req.on('error', (error) => {
    // #region agent log
    writeDebugLog('realtime.js:230', 'Request error event', {errorCode:error.code,errorMessage:error.message,connectionId,resWritable:!res.destroyed && !res.closed}, 'A')
    // #endregion
    // ECONNRESET is normal when client disconnects - don't log as error
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      const connection = activeConnections.get(connectionId)
      if (connection) {
        console.log(`🔌 SSE connection reset for user ${googleId} (${connectionId})`)
        activeConnections.delete(connectionId)
        if (changeStream) {
          changeStream.close().catch(() => {})
        }
        clearInterval(pollInterval)
        clearInterval(keepAliveInterval)
      }
    } else {
      // Only log unexpected errors
      console.error(`❌ SSE connection error for user ${googleId}:`, error)
      activeConnections.delete(connectionId)
      if (changeStream) {
        changeStream.close().catch(() => {})
      }
      clearInterval(pollInterval)
      clearInterval(keepAliveInterval)
    }
  })
  
  // Also handle response errors
  res.on('error', (error) => {
    // #region agent log
    writeDebugLog('realtime.js:254', 'Response error event', {errorCode:error.code,errorMessage:error.message,connectionId,resDestroyed:res.destroyed,resClosed:res.closed}, 'A')
    // #endregion
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
      console.error(`❌ SSE response error for user ${googleId}:`, error)
    }
    activeConnections.delete(connectionId)
    if (changeStream) {
      changeStream.close().catch(() => {})
    }
    clearInterval(pollInterval)
    clearInterval(keepAliveInterval)
  })
})

// Helper function to broadcast updates (can be called from other routes)
const broadcastUserUpdate = (googleId, data) => {
  const connections = Array.from(activeConnections.values())
    .filter(conn => conn.googleId === googleId && conn.res)
  
  if (connections.length > 0) {
    const updateData = {
      type: 'userData',
      data: {
        steps: data.steps,
        weight: data.weight,
        lastSync: data.lastSync
      }
    }
    
    connections.forEach(conn => {
      try {
        if (conn.res && !conn.res.destroyed && !conn.res.closed) {
          conn.res.write(`data: ${JSON.stringify(updateData)}\n\n`)
          conn.lastSent = {
            steps: data.steps,
            weight: data.weight,
            lastSync: data.lastSync
          }
          console.log(`📡 Broadcasted update to ${googleId}`)
        } else {
          // Connection is dead, find and remove it
          const connectionId = Array.from(activeConnections.entries())
            .find(([_, c]) => c.googleId === googleId && c.res === conn.res)?.[0]
          if (connectionId) {
            activeConnections.delete(connectionId)
          }
        }
      } catch (error) {
        // ECONNRESET/EPIPE are normal when client disconnects
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
          console.error(`Error broadcasting to ${googleId}:`, error)
        }
        // Remove broken connection
        const connectionId = Array.from(activeConnections.entries())
          .find(([_, c]) => c.googleId === googleId && c.res === conn.res)?.[0]
        if (connectionId) {
          activeConnections.delete(connectionId)
        }
      }
    })
  }
}

module.exports = { router, broadcastUserUpdate }

