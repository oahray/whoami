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
import { wrapSync, wrapAsync } from './sockets/dispatch.js'
import adminRoutes from './admin/routes/index.js'
import publicDatasetsRoutes from './routes/datasets.js'
import { supabase } from './db/supabase.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'

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
      logger.error('Supabase warmth check error', error)
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
  } catch (err) {
    logger.error('Supabase warmth unexpected error', err)
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

app.use(publicDatasetsRoutes)
app.use('/admin', adminRoutes)

app.use(errorHandler)

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
  logger.info('Client connected', { socketId: socket.id })

  const onCreateRoom = wrapSync('CREATE_ROOM', handleCreateRoom)
  const onJoinRoom = wrapSync('JOIN_ROOM', handleJoinRoom)
  const onLeaveRoom = wrapSync('LEAVE_ROOM', handleLeaveRoom, { silent: true })
  const onKickPlayer = wrapSync('KICK_PLAYER', handleKickPlayer)
  const onSubmitGuess = wrapSync('SUBMIT_GUESS', handleSubmitGuess)
  const onUpdateSettings = wrapAsync('UPDATE_SETTINGS', handleUpdateSettings)
  const onStartGame = wrapAsync('START_GAME', handleStartGame)
  const onDisconnect = wrapSync('disconnect', handleDisconnect, { silent: true })

  socket.on('CREATE_ROOM', (payload) => onCreateRoom(io, socket, payload))
  socket.on('JOIN_ROOM', (payload) => onJoinRoom(io, socket, payload))
  socket.on('LEAVE_ROOM', () => onLeaveRoom(io, socket))
  socket.on('KICK_PLAYER', (payload) => onKickPlayer(io, socket, payload))
  socket.on('UPDATE_SETTINGS', (payload) => onUpdateSettings(io, socket, payload))
  socket.on('START_GAME', (payload) => onStartGame(io, socket, payload))
  socket.on('SUBMIT_GUESS', (payload) => onSubmitGuess(io, socket, payload))
  socket.on('disconnect', () => onDisconnect(io, socket))
})

// Process-level safety nets. We log and stay alive on rejections; on truly
// unhandled exceptions (very rare with the wrappers in place) we log and
// exit so the process supervisor (Railway) can restart us cleanly.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason)
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception, exiting', err)
  // Allow the log to flush before exiting.
  setTimeout(() => process.exit(1), 100)
})

server.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    allowedOrigins
  })
})
