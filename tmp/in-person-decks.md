# In-person play: decks of 10

## Summary

In-person play uses **decks of 10** drawn sequentially from a **single master shuffle** of all eligible entities. No character repeats until the full pool is exhausted. At the end of a deck, the player loads the **next deck**; when the pool is empty, they can **play again** (new shuffle). Within a deck, **previous card** restores the exact clue order and reveal state via client-side snapshots.

## Session model (`sessionStorage`)

```ts
{
  datasetId, difficulty, entityType,
  masterPool: string[],      // full shuffled eligible IDs (from GET /cards/deck)
  deckStartOffset: number,   // index into masterPool for current deck
  index: number,             // position within current deck (0-based)
  history: CardSnapshot[]    // per-card state for back navigation
}

type CardSnapshot = {
  card: InPersonCard,
  revealedCount: number,
  showAnswer: boolean
}
```

Current deck entities: `masterPool.slice(deckStartOffset, deckStartOffset + 10)`.

Legacy sessions (pre-migration `entityIds` only) are discarded; setup fetches a fresh pool.

## Flows

### Start play

1. `GET /cards/deck` returns full shuffled pool (unchanged server API).
2. Client stores `masterPool`, `deckStartOffset = 0`, `index = 0`, `history = []`.
3. First card loads from API; snapshot saved on interaction / advance.

### Within a deck

- **Next clue** / **Reveal answer** — update in-memory state and persist snapshot at `history[index]`.
- **Previous card** — `index--`, restore `history[index]` (no API call).
- **Next card** — snapshot current card, `index++`, load next (from history if visited, else API).

### End of deck

When `index >= currentDeck.length`:

| Condition | UI |
|-----------|-----|
| More entities in `masterPool` | **Next deck** (+ “N characters remaining”) |
| Pool exhausted | **Play again** (re-fetch deck) + back to setup |

**Next deck:** `deckStartOffset += currentDeck.length`, `index = 0`, `history = []`.

No separate “shuffle random deck” — unused-only progression through the master shuffle is sufficient.

### Play again

Re-fetch `GET /cards/deck` for a new master shuffle; reset offsets and history.

## Back navigation feasibility

Server re-shuffles clues on every `GET /cards/entity/:id`. Exact restore requires **client snapshots**, not re-fetch. Snapshots also allow back navigation offline for already-visited cards in the current deck.

## Server changes

None required for v1. Client slices the existing deck response. Optional later: `limit` / pagination if pools become very large.

## UI copy

- Header: `Card 3 of 10 · Deck 2 of 5`
- Deck complete (more remain): “Deck complete” + **Next deck**
- Session complete: “You’ve played every character” + **Play again**
