/**
 * Tiny structured logger. No external deps; easy to swap for pino/winston later.
 *
 * Usage:
 *   logger.info('message', { context: 'value' })
 *   logger.warn('message', { roomCode: 'ABCD' })
 *   logger.error('message', error, { socketId: '...' })
 *
 * Output format (single line, parseable):
 *   [2026-05-08T12:34:56.789Z] LEVEL message {"context":"value"}
 *
 * Levels respect LOG_LEVEL env var (debug | info | warn | error). Defaults to "info".
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

function parseLevel(raw: string | undefined): LogLevel {
  if (!raw) return 'info'
  const lower = raw.toLowerCase()
  if (lower === 'debug' || lower === 'info' || lower === 'warn' || lower === 'error') {
    return lower
  }
  return 'info'
}

let currentLevel: LogLevel = parseLevel(process.env.LOG_LEVEL)

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel]
}

function formatContext(ctx: Record<string, unknown> | undefined): string {
  if (!ctx || Object.keys(ctx).length === 0) return ''
  try {
    return ' ' + JSON.stringify(ctx)
  } catch {
    return ' [unserializable context]'
  }
}

function emit(level: LogLevel, message: string, ctx?: Record<string, unknown>) {
  if (!shouldLog(level)) return
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${formatContext(ctx)}`
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

function errorContext(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      ...(err.stack ? { errorStack: err.stack } : {})
    }
  }
  if (typeof err === 'object' && err !== null) {
    return { error: err }
  }
  return { error: String(err) }
}

export const logger = {
  debug(message: string, ctx?: Record<string, unknown>) {
    emit('debug', message, ctx)
  },
  info(message: string, ctx?: Record<string, unknown>) {
    emit('info', message, ctx)
  },
  warn(message: string, ctx?: Record<string, unknown>) {
    emit('warn', message, ctx)
  },
  error(message: string, err?: unknown, ctx?: Record<string, unknown>) {
    emit('error', message, { ...(err !== undefined ? errorContext(err) : {}), ...(ctx ?? {}) })
  },
  setLevel(level: LogLevel) {
    currentLevel = level
  },
  getLevel(): LogLevel {
    return currentLevel
  }
}
