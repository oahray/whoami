import {
  DIFFICULTY_TIER_OPTIONS,
  formatDifficultySelection,
  isAnyDifficultySelection,
  toggleDifficultyTier,
  type DifficultySelection,
  type DifficultyTier
} from '../lib/difficultySelection'

type DifficultyMultiSelectProps = {
  value: DifficultySelection
  onChange: (next: DifficultySelection) => void
  /** Per-tier availability; tiers with 0 are disabled. */
  tierCounts?: Partial<Record<DifficultyTier, number>>
  anyCount?: number
  disabled?: boolean
  id?: string
}

export function DifficultyMultiSelect({
  value,
  onChange,
  tierCounts,
  anyCount,
  disabled = false,
  id = 'difficulty'
}: DifficultyMultiSelectProps) {
  const anySelected = isAnyDifficultySelection(value)
  const anyDisabled = disabled || (typeof anyCount === 'number' && anyCount === 0)

  return (
    <div>
      <p id={id} className="block text-sm font-semibold">
        Difficulty
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        <button
          type="button"
          disabled={anyDisabled}
          aria-pressed={anySelected}
          onClick={() => onChange([])}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
            anySelected
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-edge bg-surface-muted text-foreground'
          }`}
        >
          Any
        </button>
        {DIFFICULTY_TIER_OPTIONS.map((option) => {
          const selected = !anySelected && value.includes(option.value)
          const tierDisabled =
            disabled ||
            (typeof tierCounts?.[option.value] === 'number' && tierCounts[option.value] === 0)
          return (
            <button
              key={option.value}
              type="button"
              disabled={tierDisabled}
              aria-pressed={selected}
              onClick={() => onChange(toggleDifficultyTier(value, option.value))}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors disabled:opacity-40 ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-edge bg-surface-muted text-foreground'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs font-normal text-foreground-muted">
        {anySelected
          ? 'Uses every clue regardless of difficulty.'
          : `Using ${formatDifficultySelection(value)} clues. Select multiple to combine.`}
      </p>
    </div>
  )
}
