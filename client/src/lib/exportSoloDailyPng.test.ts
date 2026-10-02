import { describe, expect, it } from 'vitest'
import {
  formatSoloDailyShareDate,
  soloDailyShareFileName,
  soloRoundEfficiencyTone
} from './exportSoloDailyPng'

describe('exportSoloDailyPng helpers', () => {
  it('maps round efficiency without exposing answers', () => {
    expect(soloRoundEfficiencyTone({ correct: true, revealedClueCount: 1 })).toBe('first')
    expect(soloRoundEfficiencyTone({ correct: true, revealedClueCount: 3 })).toBe('early')
    expect(soloRoundEfficiencyTone({ correct: true, revealedClueCount: 5 })).toBe('late')
    expect(soloRoundEfficiencyTone({ correct: false, revealedClueCount: 6 })).toBe('miss')
  })

  it('formats the daily share title from the UTC date key', () => {
    expect(formatSoloDailyShareDate('2026-10-02')).toMatch(/October|Oct|2026/)
    expect(formatSoloDailyShareDate('not-a-date')).toBe('Daily challenge')
  })

  it('builds a spoiler-free download filename', () => {
    expect(soloDailyShareFileName('2026-03-15')).toBe('whoami-solo-daily-2026-03-15.png')
  })
})
