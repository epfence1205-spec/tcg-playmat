import { useState, useEffect } from 'react'
import type { CardData } from '../types'

export interface CommanderPromptState {
  isOpen: boolean
  cardId: string
  destination: 'graveyard' | 'exile'
  commanders: CardData[]
  /** Choices made so far — cardId → 'commandZone' | destination */
  choices: Map<string, 'commandZone' | 'graveyard' | 'exile'>
}

export const EMPTY_COMMANDER_PROMPT: CommanderPromptState = {
  isOpen: false,
  cardId: '',
  destination: 'graveyard',
  commanders: [],
  choices: new Map(),
}

interface CommanderZonePromptProps {
  prompt: CommanderPromptState
  onComplete: (choices: Map<string, 'commandZone' | 'graveyard' | 'exile'>) => void
  onCancel: () => void
}

/**
 * CommanderZonePrompt — Modal dialog that prompts for each commander in a mutate stack
 * when the creature moves to graveyard or exile.
 *
 * Displays one prompt per commander (sequentially). Player chooses
 * "Command Zone" or "Send to [destination]" for each.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export function CommanderZonePrompt({ prompt, onComplete, onCancel }: CommanderZonePromptProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [choices, setChoices] = useState<Map<string, 'commandZone' | 'graveyard' | 'exile'>>(new Map())

  // Reset internal state when a new prompt opens
  useEffect(() => {
    if (prompt.isOpen) {
      setCurrentIndex(0)
      setChoices(new Map())
    }
  }, [prompt.isOpen])

  if (!prompt.isOpen || prompt.commanders.length === 0) return null

  const currentCommander = prompt.commanders[currentIndex]
  if (!currentCommander) return null

  const destinationLabel = prompt.destination === 'graveyard' ? 'Graveyard' : 'Exile'

  const handleChoice = (choice: 'commandZone' | 'graveyard' | 'exile') => {
    const newChoices = new Map(choices)
    newChoices.set(currentCommander.id, choice)

    if (currentIndex + 1 >= prompt.commanders.length) {
      // All commanders prompted — complete
      onComplete(newChoices)
      setCurrentIndex(0)
      setChoices(new Map())
    } else {
      // Move to next commander
      setChoices(newChoices)
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commander-prompt-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 flex flex-col gap-4">
        <h2
          id="commander-prompt-title"
          className="text-lg font-semibold text-gray-100"
        >
          Commander Zone Replacement
        </h2>
        <p className="text-sm text-gray-300">
          Send <span className="font-semibold text-indigo-300">{currentCommander.name}</span> to Command Zone?
        </p>
        {prompt.commanders.length > 1 && (
          <p className="text-xs text-gray-500">
            Commander {currentIndex + 1} of {prompt.commanders.length}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={() => handleChoice(prompt.destination)}
          >
            Send to {destinationLabel}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onClick={() => handleChoice('commandZone')}
          >
            Command Zone
          </button>
        </div>
      </div>
    </div>
  )
}
