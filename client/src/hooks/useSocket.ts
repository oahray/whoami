import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket } from '../lib/socket'

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const socket = getSocket()

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true)
    }

    const handleDisconnect = () => {
      setConnected(false)
    }

    if (socket.connected) {
      setConnected(true)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket])

  const emit = (event: string, payload?: any) => {
    if (socket) {
      socket.emit(event, payload)
    }
  }

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback)
    }
  }

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      socket.off(event, callback)
    }
  }

  return {
    socket,
    emit,
    on,
    off,
    connected
  }
}
