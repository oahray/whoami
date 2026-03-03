import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    let url = SOCKET_URL
    if (SOCKET_URL.startsWith('http://')) {
      url = SOCKET_URL.replace('http://', 'ws://')
    } else if (SOCKET_URL.startsWith('https://')) {
      url = SOCKET_URL.replace('https://', 'wss://')
    }
    socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      upgrade: true
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
