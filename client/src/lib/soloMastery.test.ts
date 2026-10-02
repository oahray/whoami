import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyMasteryOutcome,
  clearMasteryForDataset,
  getMasterySummary,
  getNeedsReviewEntityIds,
  listEntityMastery
} from './soloMastery'

describe('soloMastery', () => {
  beforeEach(() => localStorage.clear())

  it('applies a settled round only once', () => {
    const outcome = {
      eventId: 'run-1:0',
      datasetId: 'bible',
      entityId: 'moses',
      entityName: 'Moses',
      correct: true,
      revealedClueCount: 1
    }

    applyMasteryOutcome(outcome)
    applyMasteryOutcome(outcome)

    expect(listEntityMastery('bible')[0]).toMatchObject({
      encounters: 1,
      correctCount: 1,
      firstClueCorrectCount: 1
    })
  })

  it('marks a miss for review and softens it after successful recall', () => {
    const missed = applyMasteryOutcome({
      eventId: 'run-1:0',
      datasetId: 'bible',
      entityId: 'abel',
      entityName: 'Abel',
      correct: false,
      revealedClueCount: 6
    })
    expect(missed.state).toBe('needs_review')
    expect(getNeedsReviewEntityIds('bible')).toEqual(['abel'])

    const recalled = applyMasteryOutcome({
      eventId: 'run-2:0',
      datasetId: 'bible',
      entityId: 'abel',
      entityName: 'Abel',
      correct: true,
      revealedClueCount: 2
    })
    expect(recalled).toMatchObject({
      previousState: 'needs_review',
      state: 'learning',
      changed: true
    })
    expect(getNeedsReviewEntityIds('bible')).toEqual([])
  })

  it('masters an entity after three correct answers including a first-clue answer', () => {
    for (let index = 0; index < 3; index += 1) {
      applyMasteryOutcome({
        eventId: `run-${index}:0`,
        datasetId: 'bible',
        entityId: 'ruth',
        entityName: 'Ruth',
        correct: true,
        revealedClueCount: index === 2 ? 1 : 2
      })
    }

    expect(listEntityMastery('bible')[0]?.state).toBe('mastered')
    expect(getMasterySummary('bible')).toEqual({
      encountered: 1,
      mastered: 1,
      needsReview: 0,
      firstClueAccuracy: 1 / 3
    })
  })

  it('clears progress for one dataset only', () => {
    applyMasteryOutcome({
      eventId: 'bible:ent:1',
      datasetId: 'bible',
      entityId: 'paul',
      entityName: 'Paul',
      correct: false,
      revealedClueCount: 4
    })
    applyMasteryOutcome({
      eventId: 'history:ent:1',
      datasetId: 'history',
      entityId: 'caesar',
      entityName: 'Caesar',
      correct: true,
      revealedClueCount: 1
    })

    clearMasteryForDataset('bible')

    expect(getMasterySummary('bible').encountered).toBe(0)
    expect(getMasterySummary('history').encountered).toBe(1)
  })

  it('scopes progress by dataset', () => {
    applyMasteryOutcome({
      eventId: 'bible:1',
      datasetId: 'bible',
      entityId: 'paul',
      entityName: 'Paul',
      correct: false,
      revealedClueCount: 4
    })
    applyMasteryOutcome({
      eventId: 'history:1',
      datasetId: 'history',
      entityId: 'caesar',
      entityName: 'Caesar',
      correct: true,
      revealedClueCount: 1
    })

    expect(getMasterySummary('bible')).toMatchObject({
      encountered: 1,
      needsReview: 1
    })
    expect(getMasterySummary('history')).toMatchObject({
      encountered: 1,
      needsReview: 0
    })
  })
})
