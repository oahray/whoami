// In-memory room store
const rooms = new Map()

/**
 * Generate a unique room code
 * @returns {string} 6-character room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Ensure uniqueness
  if (rooms.has(code)) {
    return generateRoomCode()
  }

  return code
}

/**
 * Create a new room
 * @param {string} hostId - Socket ID of the host
 * @param {string} hostNickname - Nickname of the host
 * @returns {Object} Room state
 */
export function createRoom(hostId, hostNickname) {
  const code = generateRoomCode()

  const room = {
    code,
    hostId,
    players: new Map(),
    settings: {
      roundDuration: 20000, // 20 seconds in ms
      clueRevealTime: 10000, // 10 seconds in ms
      totalRounds: 5,
      difficultyMode: 'medium',
      strictMode: false,
      transparencyMode: 'full',
      maxGuessesPerRound: 10
    },
    status: 'waiting', // 'waiting' | 'in_progress' | 'finished'
    currentRound: null,
    roundHistory: [],
    entityPool: [],
    usedEntityIds: new Set(),
    scores: new Map()
  }

  // Add host as first player
  room.players.set(hostId, {
    id: hostId,
    nickname: hostNickname,
    isHost: true,
    isConnected: true,
    disconnectedAt: null,
    guessCount: 0,
    lastGuessAt: null,
    isLocked: false
  })

  rooms.set(code, room)
  return room
}

/**
 * Get room by code
 * @param {string} code - Room code
 * @returns {Object|null} Room state or null if not found
 */
export function getRoom(code) {
  return rooms.get(code) || null
}

/**
 * Get room by socket ID
 * @param {string} socketId - Socket ID
 * @returns {Object|null} Room state or null if not found
 */
export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      return room
    }
  }
  return null
}

/**
 * Delete a room
 * @param {string} code - Room code
 */
export function deleteRoom(code) {
  rooms.delete(code)
}

/**
 * Get all rooms (for debugging/admin)
 * @returns {Map} All rooms
 */
export function getAllRooms() {
  return rooms
}
