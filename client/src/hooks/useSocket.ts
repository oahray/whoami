import { useCallback, useEffect, useState } from 'react'
import { getSocket } from '../lib/socket'

export type TransportStatus = 'connected' | 'connecting' | 'failed'

export function useSocket() {
  const socket = getSocket()
  const [connected, setConnected] = useState(() => socket.connected)
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(() =>
    socket.connected ? 'connected' : 'connecting'
  )

  const retryConnect = useCallback(() => {
    setTransportStatus('connecting')
    if (!socket.connected) {
      socket.connect()
    }
  }, [socket])

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true)
      setTransportStatus('connected')
    }

    const handleDisconnect = () => {
      setConnected(false)
      // socket.active is true while Socket.IO is still trying to reconnect
      setTransportStatus(socket.active ? 'connecting' : 'failed')
    }

    const handleReconnectAttempt = () => {
      setConnected(false)
      setTransportStatus('connecting')
    }

    const handleReconnectFailed = () => {
      setConnected(false)
      setTransportStatus('failed')
    }

    const handleConnectError = () => {
      setConnected(false)
      setTransportStatus(socket.active ? 'connecting' : 'failed')
    }

    const resumeIfNeeded = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (socket.connected) return
      setTransportStatus('connecting')
      socket.connect()
    }

    const handleOffline = () => {
      setConnected(false)
      setTransportStatus('failed')
    }

    if (socket.connected) {
      handleConnect()
    } else {
      setTransportStatus(socket.active !== false ? 'connecting' : 'failed')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('reconnect_attempt', handleReconnectAttempt)
    socket.on('reconnect_failed', handleReconnectFailed)
    socket.on('connect_error', handleConnectError)
    document.addEventListener('visibilitychange', resumeIfNeeded)
    window.addEventListener('online', resumeIfNeeded)
    window.addEventListener('offline', handleOffline)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('reconnect_attempt', handleReconnectAttempt)
      socket.off('reconnect_failed', handleReconnectFailed)
      socket.off('connect_error', handleConnectError)
      document.removeEventListener('visibilitychange', resumeIfNeeded)
      window.removeEventListener('online', resumeIfNeeded)
      window.removeEventListener('offline', handleOffline)
    }
  }, [socket])

  const emit = (event: string, payload?: unknown) => {
    socket.emit(event, payload)
  }

  const on = (event: string, callback: (...args: unknown[]) => void) => {
    socket.on(event, callback)
  }

  const off = (event: string, callback?: (...args: unknown[]) => void) => {
    if (callback) socket.off(event, callback)
    else socket.off(event)
  }

  return {
    socket,
    emit,
    on,
    off,
    connected,
    transportStatus,
    retryConnect
  }
}
