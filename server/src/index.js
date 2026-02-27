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
  handleUpdateSettings
} from './sockets/handlers.js'

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

// CORS configuration
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}))

app.use(express.json())

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST']
  }
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Register event handlers
  socket.on('CREATE_ROOM', (payload) => handleCreateRoom(io, socket, payload))
  socket.on('JOIN_ROOM', (payload) => handleJoinRoom(io, socket, payload))
  socket.on('LEAVE_ROOM', () => handleLeaveRoom(io, socket))
  socket.on('UPDATE_SETTINGS', (payload) => handleUpdateSettings(io, socket, payload))
  socket.on('disconnect', () => handleDisconnect(io, socket))
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`CORS enabled for: ${CLIENT_ORIGIN}`)
})
