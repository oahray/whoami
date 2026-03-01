import { describe, it, expect } from 'vitest'
import { calculateScore } from './scoring.js'

describe('calculateScore', () => {
  const ROUND_DURATION = 30000

  describe('basic scoring', () => {
    it('should calculate score based on time remaining', () => {
      const score = calculateScore({
        timeElapsedMs: 0,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      expect(score).toBeGreaterThan(0)
      expect(score).toBe(1500)
    })

    it('should give lower score when more time has elapsed', () => {
      const earlyScore = calculateScore({
        timeElapsedMs: 5000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      const lateScore = calculateScore({
        timeElapsedMs: 25000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      expect(earlyScore).toBeGreaterThan(lateScore)
    })
  })

  describe('clue multipliers', () => {
    it('should apply 1.5x multiplier for first clue (index 0)', () => {
      const firstClueScore = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      const secondClueScore = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(firstClueScore).toBeGreaterThan(secondClueScore)
      const expectedFirst = Math.floor(1000 * (20000 / ROUND_DURATION) * 1.5)
      expect(firstClueScore).toBe(expectedFirst)
      const expectedSecond = Math.floor(1000 * (20000 / ROUND_DURATION) * 1.0)
      expect(secondClueScore).toBe(expectedSecond)
    })

    it('should apply 1.0x multiplier for second clue (index 1)', () => {
      const score = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBeGreaterThan(0)
    })

    it('should default to 1.0x multiplier for invalid clue index', () => {
      const score = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 99,
        isFirst: false
      })
      expect(score).toBeGreaterThan(0)
    })
  })

  describe('first place bonus', () => {
    it('should add 100 points bonus for first correct guess', () => {
      const firstScore = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: true
      })
      const notFirstScore = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      expect(firstScore).toBe(notFirstScore + 100)
    })

    it('should not add bonus for non-first guesses', () => {
      const score = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBeGreaterThan(0)
    })
  })

  describe('floor points', () => {
    it('should never return less than 50 points', () => {
      const score = calculateScore({
        timeElapsedMs: ROUND_DURATION - 1,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBeGreaterThanOrEqual(50)
    })

    it('should return exactly 50 points when time runs out', () => {
      const score = calculateScore({
        timeElapsedMs: ROUND_DURATION,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBe(50)
    })

    it('should return 50 points even when time exceeds duration', () => {
      const score = calculateScore({
        timeElapsedMs: ROUND_DURATION + 1000,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBe(50)
    })

    it('should return 50 points when round duration is zero', () => {
      const score = calculateScore({
        timeElapsedMs: 0,
        roundDuration: 1,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBeGreaterThanOrEqual(50)
    })
  })

  describe('edge cases', () => {
    it('should handle very short round duration', () => {
      const score = calculateScore({
        timeElapsedMs: 1000,
        roundDuration: 5000,
        clueIndex: 0,
        isFirst: true
      })
      expect(score).toBeGreaterThanOrEqual(50)
    })

    it('should handle very long round duration', () => {
      const score = calculateScore({
        timeElapsedMs: 10000,
        roundDuration: 60000,
        clueIndex: 0,
        isFirst: false
      })
      expect(score).toBeGreaterThanOrEqual(50)
    })

    it('should calculate correctly at exact midpoint', () => {
      const score = calculateScore({
        timeElapsedMs: ROUND_DURATION / 2,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      expect(score).toBe(750)
    })

    it('should handle negative time elapsed gracefully', () => {
      const score = calculateScore({
        timeElapsedMs: -1000,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: false
      })
      expect(score).toBeGreaterThan(0)
    })
  })

  describe('score calculation formula', () => {
    it('should match expected formula for first clue, first place', () => {
      const timeElapsed = 10000
      const timeRemaining = ROUND_DURATION - timeElapsed
      const expectedBase = Math.floor(1000 * (timeRemaining / ROUND_DURATION) * 1.5)
      const expectedScore = expectedBase + 100

      const score = calculateScore({
        timeElapsedMs: timeElapsed,
        roundDuration: ROUND_DURATION,
        clueIndex: 0,
        isFirst: true
      })
      expect(score).toBe(expectedScore)
    })

    it('should match expected formula for second clue, not first', () => {
      const timeElapsed = 15000
      const timeRemaining = ROUND_DURATION - timeElapsed
      const expectedBase = Math.floor(1000 * (timeRemaining / ROUND_DURATION) * 1.0)
      const expectedScore = Math.max(expectedBase, 50)

      const score = calculateScore({
        timeElapsedMs: timeElapsed,
        roundDuration: ROUND_DURATION,
        clueIndex: 1,
        isFirst: false
      })
      expect(score).toBe(expectedScore)
    })
  })
})
