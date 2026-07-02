import type { RowCard } from '../types'

interface SelectionOverlayProps {
  selectedCards: RowCard[]
}

/**
 * SelectionOverlay — Floating badge showing selection count and aggregate P/T.
 * Position: top-right of Zone A, z-index 91 (above SelectionToolbar).
 * Format: "[count] selected · [P]/[T]" or just "[count] selected" when no creatures.
 */
export function SelectionOverlay({ selectedCards }: SelectionOverlayProps) {
  const count = selectedCards.length
  if (count === 0) return null

  // Filter to creatures only for P/T computation
  const creatures = selectedCards.filter(rc => rc.card.cardType === 'creature')

  let label = `${count} selected`

  if (creatures.length > 0) {
    let totalPower = 0
    let totalToughness = 0

    for (const rc of creatures) {
      const basePower = parseInt(rc.card.basePower ?? '0', 10) || 0
      const baseToughness = parseInt(rc.card.baseToughness ?? '0', 10) || 0

      // +1/+1 and -1/-1 counter effects
      const plusCounters = rc.counters
        .filter(c => c.type === '+1/+1')
        .reduce((sum, c) => sum + c.value, 0)
      const minusCounters = rc.counters
        .filter(c => c.type === '-1/-1')
        .reduce((sum, c) => sum + c.value, 0)

      // Temporary power/toughness modifiers (pump spells etc.)
      const powerMod = rc.powerModifier ?? 0
      const toughnessMod = rc.toughnessModifier ?? 0

      totalPower += basePower + plusCounters - minusCounters + powerMod
      totalToughness += baseToughness + plusCounters - minusCounters + toughnessMod
    }

    label += ` \u00b7 ${totalPower}/${totalToughness}`
  }

  return (
    <div
      className="absolute top-2 right-2 bg-gray-900/90 text-cyan-300 text-sm font-medium px-3 py-1.5 rounded-md border border-cyan-400/50 pointer-events-none"
      style={{ zIndex: 91 }}
      aria-label={label}
    >
      {label}
    </div>
  )
}
