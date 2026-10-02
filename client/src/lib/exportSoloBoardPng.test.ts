import { describe, expect, it } from 'vitest'
import {
  soloBoardPrimaryUnit,
  soloBoardPrimaryValue,
  soloBoardSealLine,
  soloBoardShareFileName
} from './exportSoloBoardPng'
import { formatSoloScore, type SoloRecord } from './soloSession'

const classicRecord: SoloRecord = {
  datasetId: 'ds-1',
  difficulty: 'any',
  entityType: 'character',
  variation: 'challenge',
  roundDurationMs: 30_000,
  clueRevealIntervalMs: 5_000,
  correctCount: 8,
  activeElapsedMs: 90_000,
  score: 4200,
  achievedAt: '2026-10-02T12:00:00.000Z'
}

const enduranceRecord: SoloRecord = {
  ...classicRecord,
  variation: 'endurance',
  correctCount: 14,
  score: 2100
}

describe('exportSoloBoardPng helpers', () => {
  it('labels the notary seal for each board mode', () => {
    expect(soloBoardSealLine('challenge')).toBe('CLASSIC')
    expect(soloBoardSealLine('endurance')).toBe('ENDURANCE')
  })

  it('uses score for Classic and streak for Endurance', () => {
    expect(soloBoardPrimaryValue(classicRecord)).toBe(formatSoloScore(4200))
    expect(soloBoardPrimaryUnit('challenge')).toBe('PTS')
    expect(soloBoardPrimaryValue(enduranceRecord)).toBe('14')
    expect(soloBoardPrimaryUnit('endurance')).toBe('STREAK')
  })

  it('builds spoiler-free download filenames', () => {
    expect(soloBoardShareFileName('challenge')).toBe('whoami-solo-classic-board.png')
    expect(soloBoardShareFileName('endurance')).toBe('whoami-solo-endurance-board.png')
  })
})
