/** HTTP base URL for the game server (derived from the Socket URL env var). */
export const API_BASE_URL =
  import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:3001'
