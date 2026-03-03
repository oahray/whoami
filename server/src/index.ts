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
  handleSubmitGuess
} from './sockets/handlers/index.js'
import adminRoutes from './admin/routes/index.js'

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const CLIENT_ORIGINS = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(',').map(origin => origin.trim())
  : [CLIENT_ORIGIN]

const allowedOrigins = [...CLIENT_ORIGINS, CLIENT_ORIGIN].filter(Boolean)

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

app.use('/admin', adminRoutes)

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
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

  socket.on('UPDATE_SETTINGS', (payload) => {
    try {
      handleUpdateSettings(io, socket, payload)
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
