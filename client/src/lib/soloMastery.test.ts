import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyMasteryOutcome,
  applyResolveRemaps,
  clearMasteryForDataset,
  formatMasteryRunDelta,
  getMasterySummary,
  getNeedsReviewEntityIds,
  listEntityMastery,
  masterySettleCue,
  rekeyMasteryToCatalog,
  summarizeMasteryRun
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

  it('marks an entity familiar after three correct answers', () => {
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

    expect(listEntityMastery('bible')[0]?.state).toBe('familiar')
    expect(getMasterySummary('bible')).toEqual({
      encountered: 1,
      mastered: 0,
      needsReview: 0,
      firstClueAccuracy: 1 / 3
    })
  })

  it('masters an entity after five correct answers including a first-clue answer', () => {
    for (let index = 0; index < 5; index += 1) {
      applyMasteryOutcome({
        eventId: `run-${index}:0`,
        datasetId: 'bible',
        entityId: 'ruth',
        entityName: 'Ruth',
        correct: true,
        revealedClueCount: index === 4 ? 1 : 2
      })
    }

    expect(listEntityMastery('bible')[0]?.state).toBe('mastered')
    expect(getMasterySummary('bible').mastered).toBe(1)
  })

  it('stays familiar at five correct answers when none used the first clue', () => {
    for (let index = 0; index < 5; index += 1) {
      applyMasteryOutcome({
        eventId: `run-${index}:0`,
        datasetId: 'bible',
        entityId: 'esther',
        entityName: 'Esther',
        correct: true,
        revealedClueCount: 2
      })
    }

    expect(listEntityMastery('bible')[0]?.state).toBe('familiar')
  })

  it('moves older three-correct mastered rows to familiar', () => {
    localStorage.setItem(
      'whoami-solo-mastery-v1',
      JSON.stringify({
        version: 1,
        entities: {
          'bible:ruth': {
            datasetId: 'bible',
            entityId: 'ruth',
            entityName: 'Ruth',
            encounters: 3,
            correctCount: 3,
            firstClueCorrectCount: 1,
            missCount: 0,
            lastCorrect: true,
            lastEncounteredAt: '2026-01-01T00:00:00.000Z',
            state: 'mastered'
          }
        },
        appliedEvents: {}
      })
    )

    expect(listEntityMastery('bible')[0]?.state).toBe('familiar')
    expect(getMasterySummary('bible')).toMatchObject({
      encountered: 1,
      mastered: 0
    })
  })

  it('summarizes stage changes from one run', () => {
    const missed = applyMasteryOutcome({
      eventId: 'run-1:0',
      datasetId: 'bible',
      entityId: 'adam',
      entityName: 'Adam',
      correct: false,
      revealedClueCount: 4
    })
    const learned = applyMasteryOutcome({
      eventId: 'run-1:1',
      datasetId: 'bible',
      entityId: 'eve',
      entityName: 'Eve',
      correct: true,
      revealedClueCount: 2
    })

    expect(formatMasteryRunDelta(summarizeMasteryRun([missed, learned]))).toBe(
      '+2 encountered'
    )
  })

  it('remaps mastery onto new entity ids by name after a content reimport', () => {
    applyMasteryOutcome({
      eventId: 'run-old:0',
      datasetId: 'bible',
      entityId: 'old-moses-id',
      entityName: 'Moses',
      correct: false,
      revealedClueCount: 4
    })
    applyMasteryOutcome({
      eventId: 'run-old:1',
      datasetId: 'bible',
      entityId: 'gone-id',
      entityName: 'Deleted Person',
      correct: false,
      revealedClueCount: 3
    })

    const result = rekeyMasteryToCatalog('bible', [
      { id: 'new-moses-id', name: 'Moses' },
      { id: 'aaron', name: 'Aaron' }
    ])

    expect(result).toEqual({ remapped: 1, removed: 1 })
    expect(getNeedsReviewEntityIds('bible')).toEqual(['new-moses-id'])
    expect(listEntityMastery('bible').map((entity) => entity.entityId)).toEqual(['new-moses-id'])
  })

  it('only shows a settle cue when mastery state changes', () => {
    const first = applyMasteryOutcome({
      eventId: 'run-1:0',
      datasetId: 'bible',
      entityId: 'joseph',
      entityName: 'Joseph',
      correct: true,
      revealedClueCount: 2
    })
    expect(masterySettleCue(first)).toMatchObject({
      label: 'Learning',
      icon: 'menu_book'
    })

    const second = applyMasteryOutcome({
      eventId: 'run-2:0',
      datasetId: 'bible',
      entityId: 'joseph',
      entityName: 'Joseph',
      correct: true,
      revealedClueCount: 2
    })
    expect(second.changed).toBe(false)
    expect(masterySettleCue(second)).toBeNull()
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

  it('applies resolve remaps and drops unresolved review ids', () => {
    applyMasteryOutcome({
      eventId: 'run-1:0',
      datasetId: 'bible',
      entityId: 'old-moses',
      entityName: 'Moses',
      correct: false,
      revealedClueCount: 4
    })
    applyMasteryOutcome({
      eventId: 'run-1:1',
      datasetId: 'bible',
      entityId: 'gone-id',
      entityName: 'Deleted Person',
      correct: false,
      revealedClueCount: 3
    })
    applyMasteryOutcome({
      eventId: 'run-1:2',
      datasetId: 'bible',
      entityId: 'aaron',
      entityName: 'Aaron',
      correct: true,
      revealedClueCount: 1
    })

    const result = applyResolveRemaps(
      'bible',
      [{ id: 'new-moses-id', name: 'Moses', previousId: 'old-moses' }],
      ['old-moses', 'gone-id']
    )

    expect(result).toEqual({ remapped: 1, removed: 1 })
    expect(getNeedsReviewEntityIds('bible')).toEqual(['new-moses-id'])
    expect(listEntityMastery('bible').map((entity) => entity.entityId).sort()).toEqual([
      'aaron',
      'new-moses-id'
    ])
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
