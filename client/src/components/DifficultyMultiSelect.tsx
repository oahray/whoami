import {
  DIFFICULTY_TIERS,
  DIFFICULTY_TIER_OPTIONS,
  formatDifficultySelection,
  isAnyDifficultySelection,
  type DifficultySelection,
  type DifficultyTier
} from '../lib/difficultySelection'

type DifficultyMultiSelectProps = {
  value: DifficultySelection
  onChange: (next: DifficultySelection) => void
  /** Per-tier availability; tiers with 0 are disabled. */
  tierCounts?: Partial<Record<DifficultyTier, number>>
  disabled?: boolean
  id?: string
}

export function DifficultyMultiSelect({
  value,
  onChange,
  tierCounts,
  disabled = false,
  id = 'difficulty'
}: DifficultyMultiSelectProps) {
  const anySelected = isAnyDifficultySelection(value)

  function handleToggle(tier: DifficultyTier) {
    if (anySelected) {
      onChange(DIFFICULTY_TIERS.filter((value) => value !== tier))
      return
    }

    const next = value.includes(tier)
      ? value.filter((value) => value !== tier)
      : [...value, tier]

    onChange(next.length === 0 ? [] : DIFFICULTY_TIERS.filter((value) => next.includes(value)))
  }

  return (
    <div>
      <p id={id} className="block text-sm font-semibold">
        Difficulty
      </p>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-labelledby={id}>
        {DIFFICULTY_TIER_OPTIONS.map((option) => {
          const available = (tierCounts?.[option.value] ?? 1) > 0
          const selected = available && (anySelected || value.includes(option.value))
          const tierDisabled =
            disabled ||
            (typeof tierCounts?.[option.value] === 'number' && tierCounts[option.value] === 0)
          return (
            <button
              key={option.value}
              type="button"
              disabled={tierDisabled}
              aria-pressed={selected}
              onClick={() => handleToggle(option.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors disabled:opacity-40 text-foreground ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-edge bg-surface-muted'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs font-normal text-foreground-muted">
        {anySelected
          ? 'Using every clue. Deselect tiers to narrow the mix.'
          : `Using ${formatDifficultySelection(value)} clues. Select one or more tiers.`}
      </p>
    </div>
  )
}
