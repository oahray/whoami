import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })
  }
  return socketInstance
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
