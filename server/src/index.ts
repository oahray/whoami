import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import {
  handleJoinRoom,
  handleCreateRoom,
  handleLeaveRoom,
  handleDisconnect,
  handleUpdateSettings,
  handleStartGame,
  handleSubmitGuess,
  handleKickPlayer
} from './sockets/handlers/index.js'
import adminRoutes from './admin/routes/index.js'
import { supabase } from './db/supabase.js'

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const CLIENT_ORIGINS = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(',').map(origin => origin.trim())
  : [CLIENT_ORIGIN]

const allowedOrigins = [...CLIENT_ORIGINS, CLIENT_ORIGIN].filter(Boolean)

// Basic in-memory IP throttle for internal warmth endpoint
type WarmthBucket = {
  windowStart: number
  count: number
}

const WARMTH_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const WARMTH_MAX_REQUESTS = 30         // per IP per window
const warmthBuckets = new Map<string, WarmthBucket>()

function getClientIp(req: express.Request): string {
  const xfwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
  return xfwd || req.ip || 'unknown'
}

function isWarmthAllowed(req: express.Request): boolean {
  const ip = getClientIp(req)
  const now = Date.now()
  const bucket = warmthBuckets.get(ip)

  if (!bucket || now - bucket.windowStart > WARMTH_WINDOW_MS) {
    warmthBuckets.set(ip, { windowStart: now, count: 1 })
    return true
  }

  if (bucket.count >= WARMTH_MAX_REQUESTS) {
    return false
  }

  bucket.count += 1
  return true
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Supabase-specific "warmth" endpoint used by CI to keep the project active
app.get('/internal/warmth', async (req, res) => {
  if (!isWarmthAllowed(req)) {
    return res.status(429).json({
      status: 'error',
      source: 'internal',
      message: 'Too many requests from this IP'
    })
  }

  try {
    const { error } = await supabase
      .from('entities')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Supabase warmth check error:', error.message)
      return res.status(500).json({
        status: 'error',
        source: 'internal',
        message: error.message
      })
    }

    res.json({
      status: 'ok',
      source: 'internal',
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('Supabase warmth unexpected error:', err)
    res.status(500).json({
      status: 'error',
      message: err?.message ?? 'Unknown error'
    })
  }
})

app.use('/admin', adminRoutes)

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Allow background tabs more time before disconnecting (default pingTimeout is 20s)
  pingTimeout: 60000,
  pingInterval: 25000
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('CREATE_ROOM', (payload) => {
    try {
      handleCreateRoom(io, socket, payload)
    } catch (error) {
      console.error(`Unhandled error in CREATE_ROOM for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('JOIN_ROOM', (payload) => {
    try {
      handleJoinRoom(io, socket, payload)
    } catch (error) {
      console.error(`Unhandled error in JOIN_ROOM for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('LEAVE_ROOM', () => {
    try {
      handleLeaveRoom(io, socket)
    } catch (error) {
      console.error(`Unhandled error in LEAVE_ROOM for socket ${socket.id}:`, error)
    }
  })

  socket.on('KICK_PLAYER', (payload) => {
    try {
      handleKickPlayer(io, socket, payload)
    } catch (error) {
      console.error(`Unhandled error in KICK_PLAYER for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('UPDATE_SETTINGS', (payload) => {
    try {
      handleUpdateSettings(io, socket, payload).catch((error) => {
        console.error(`Unhandled async error in UPDATE_SETTINGS for socket ${socket.id}:`, error)
        socket.emit('ROOM_ERROR', {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred'
        })
      })
    } catch (error) {
      console.error(`Unhandled error in UPDATE_SETTINGS for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('START_GAME', (payload) => {
    try {
      handleStartGame(io, socket, payload).catch((error) => {
        console.error(`Unhandled async error in START_GAME for socket ${socket.id}:`, error)
        socket.emit('ROOM_ERROR', {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred'
        })
      })
    } catch (error) {
      console.error(`Unhandled error in START_GAME for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('SUBMIT_GUESS', (payload) => {
    try {
      handleSubmitGuess(io, socket, payload)
    } catch (error) {
      console.error(`Unhandled error in SUBMIT_GUESS for socket ${socket.id}:`, error)
      socket.emit('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred'
      })
    }
  })

  socket.on('disconnect', () => {
    try {
      handleDisconnect(io, socket)
    } catch (error) {
      console.error(`Unhandled error in disconnect for socket ${socket.id}:`, error)
    }
  })
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`)
})
