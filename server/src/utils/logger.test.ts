import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from './logger.js'

describe('logger', () => {
  let logSpy: any
  let warnSpy: any
  let errorSpy: any
  const originalLevel = logger.getLevel()

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.setLevel('debug')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    logger.setLevel(originalLevel)
  })

  it('logs info messages with timestamp and level prefix', () => {
    logger.info('hello world')

    expect(logSpy).toHaveBeenCalledTimes(1)
    const line = logSpy.mock.calls[0][0] as string
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO hello world$/)
  })

  it('appends JSON context when provided', () => {
    logger.info('joined', { roomCode: 'ABCD', count: 3 })

    const line = logSpy.mock.calls[0][0] as string
    expect(line).toContain('INFO joined')
    expect(line).toContain('{"roomCode":"ABCD","count":3}')
  })

  it('routes warn to console.warn and error to console.error', () => {
    logger.warn('careful')
    logger.error('boom')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('extracts name + message + stack from Error instances', () => {
    const err = new Error('something broke')
    logger.error('handler crashed', err, { socketId: 's-1' })

    const line = errorSpy.mock.calls[0][0] as string
    expect(line).toContain('handler crashed')
    expect(line).toContain('"errorName":"Error"')
    expect(line).toContain('"errorMessage":"something broke"')
    expect(line).toContain('"socketId":"s-1"')
  })

  it('handles unknown error shapes gracefully', () => {
    logger.error('weird', 'just a string')
    logger.error('weird-obj', { code: 42 })

    const lineA = errorSpy.mock.calls[0][0] as string
    const lineB = errorSpy.mock.calls[1][0] as string
    expect(lineA).toContain('"error":"just a string"')
    expect(lineB).toContain('"error":{"code":42}')
  })

  it('respects level threshold', () => {
    logger.setLevel('warn')

    logger.debug('quiet')
    logger.info('quiet')
    logger.warn('loud')
    logger.error('boom')

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('does not throw on circular context', () => {
    const a: Record<string, unknown> = {}
    a.self = a

    expect(() => logger.info('cycle', a)).not.toThrow()
    const line = logSpy.mock.calls[0][0] as string
    expect(line).toContain('[unserializable context]')
  })
})
