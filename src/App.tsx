import { useState, useEffect, useCallback } from 'react'
import { DragOverlay } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { AppShell } from './components/AppShell'
import { Battlefield } from './components/Battlefield'
import type { BatchAction } from './components/SelectionToolbar'
import { PublicStack, calculateDelirium } from './components/PublicStack'
import { HandTray } from './components/HandTray'
import { DeckImportModal } from './components/DeckImportModal'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CommanderZonePrompt, EMPTY_COMMANDER_PROMPT } from './components/CommanderZonePrompt'
import type { CommanderPromptState } from './components/CommanderZonePrompt'
import { ContextMenu } from './components/ContextMenu'
import type { ContextMenuAction } from './components/ContextMenu'
import { PeekModal } from './components/PeekModal'
import { PeekModeSelector } from './components/PeekModeSelector'
import type { PeekMode, PeekResult } from './peekActions'
import { applyPeekResult } from './peekActions'
import { KeybindOverlay } from './components/KeybindOverlay'
import { GameLogOverlay } from './components/GameLogOverlay'
import { ZoneBrowser } from './components/ZoneBrowser'
import type { ZoneBrowserCard, ZoneBrowserDestination } from './components/ZoneBrowser'
import { TokenPanel } from './components/TokenPanel'
import { ToastProvider } from './contexts/ToastContext'
import { resolveTokensFromCards, clearTokenCache } from './api/tokenResolver'
import type { TokenDefinition } from './api/tokenResolver'
import type { ScryfallCard } from './api/scryfallResolver'
import { useGameState } from './hooks/useGameState'
import { getValidMutateTargets, getCommandersInStack } from './mutateActions'
import { useToastContext } from './contexts/ToastContext'
import { useHoveredCard } from './hooks/useHoveredCard'
import { useEquipmentDocking, getValidDockTargets } from './hooks/useEquipmentDocking'
import { useErrorHandling } from './hooks/useErrorHandling'
import { useKeybinds } from './hooks/useKeybinds'
import type { GameAction } from './hooks/useKeybinds'
import { moveCard, tapCard, softReset, isGameInProgress, drawCard as drawCardAction, shuffleLibrary, untapAll, flipCard, transformDFC, findCardOnBattlefield, findCardZone, removeCardFromZone, addToBattlefield, createTokens, getAllBattlefieldCards, updateBattlefieldCard } from './gameActions'
import { addCounter, removeCounter } from './counterActions'
import { attachEquipment, detachEquipment } from './equipmentActions'
import { batchTap, batchUntap, batchMoveToZone } from './batchActions'
import { CARD_BACK_URL } from './cardBack'
import { logAction } from './gameLog'
import { isAttachedEquipment, findParentCreature, getRowCards, setRowCards, reorderWithinRow as reorderWithinRowAction } from './sortableHelpers'
import { initializeMulligan } from './mulliganEngine'
import { RotationDiv } from './components/RotationDiv'
import type { GameState, CardData, Zone, RowTarget, CardType, MutateTargetingState } from './types'
import { useBroadcastPublisher } from './stream/useBroadcastPublisher'

function AppContent() {
  const { handleQuotaExceeded } = useErrorHandling()

  const { state: gameState, setState: setGameState, undo, setCreatureAreaContainerWidthPx, getCreatureAreaWidthPx, mutateOnto, splitMutateStack, moveMutatedCreature } = useGameState(handleQuotaExceeded)

  // Drag state for DragOverlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Cards animating collapse before zone change
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set())

  // Multi-select: ephemeral UI state (not persisted, not in GameState, not in undo history)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())

  const onSelectionToggle = useCallback((id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onClearSelection = useCallback(() => {
    setSelectedCardIds(new Set())
  }, [])

  const onSetSelection = useCallback((ids: Set<string>) => {
    setSelectedCardIds(ids)
  }, [])

  // Batch action handler for multi-select toolbar
  const onBatchAction = useCallback((action: BatchAction) => {
    const ids = Array.from(selectedCardIds)
    if (ids.length === 0) return

    // Push ONE undo checkpoint, then apply the batch action
    if (action === 'tap') {
      setGameState((prev: GameState) => batchTap(prev, ids))
    } else if (action === 'untap') {
      setGameState((prev: GameState) => batchUntap(prev, ids))
    } else {
      setGameState((prev: GameState) => batchMoveToZone(prev, ids, action.moveTo))
    }

    // Clear selection after batch
    setSelectedCardIds(new Set())
  }, [selectedCardIds, setGameState])

  // Toggle tap on all selected cards (triggered by clicking a selected card without modifiers)
  const onTapSelected = useCallback(() => {
    const ids = Array.from(selectedCardIds)
    if (ids.length === 0) return
    setGameState((prev: GameState) => {
      let state = prev
      for (const id of ids) {
        try { state = tapCard(state, id) }
        catch { /* card not found, skip */ }
      }
      return state
    })
    setSelectedCardIds(new Set())
  }, [selectedCardIds, setGameState])

  // Equip mode: when set, next click on a creature attaches this equipment
  const [equipModeCardId, setEquipModeCardId] = useState<string | null>(null)

  // Toast notifications
  const { addToast } = useToastContext()

  // Mutate targeting mode state
  const [mutateTargeting, setMutateTargeting] = useState<MutateTargetingState>({ isActive: false, sourceCardId: null, sourceZone: null, validTargetIds: [] })

  // Mutate placement dialog state (shown after selecting a valid target)
  const [mutatePlacement, setMutatePlacement] = useState<{
    isOpen: boolean
    targetCardId: string
  }>({ isOpen: false, targetCardId: '' })

  // Commander zone prompt state (shown when mutated creature with commanders moves to graveyard/exile)
  const [commanderPrompt, setCommanderPrompt] = useState<CommanderPromptState>(EMPTY_COMMANDER_PROMPT)

  // Cancel equip mode on Escape
  useEffect(() => {
    if (!equipModeCardId) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setEquipModeCardId(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [equipModeCardId])

  // Cancel mutate targeting mode on Escape
  useEffect(() => {
    if (!mutateTargeting.isActive) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMutateTargeting({ isActive: false, sourceCardId: null, sourceZone: null, validTargetIds: [] })
        setMutatePlacement({ isOpen: false, targetCardId: '' })
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mutateTargeting.isActive])

  // Clear multi-selection on Escape (when no modal modes are active)
  useEffect(() => {
    if (selectedCardIds.size === 0) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedCardIds(new Set())
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [selectedCardIds.size])

  // Ctrl+A: Select all / deselect all battlefield cards
  useEffect(() => {
    function handleCtrlA(e: KeyboardEvent) {
      // Suppress if focus is in a text input
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault() // Suppress browser select-all

        // Suppress during mutate targeting
        if (mutateTargeting.isActive) return

        // Collect all battlefield instanceIds
        const allIds: string[] = [
          ...gameState.creatureArea.rows.flatMap(r => r.elements.map(el => el.instanceId)),
          ...gameState.row3.left.map(el => el.instanceId),
          ...gameState.row3.right.map(el => el.instanceId),
          ...gameState.row4.left.map(el => el.instanceId),
          ...gameState.row4.right.map(el => el.instanceId),
        ]

        // Toggle: if all are already selected → clear, otherwise → select all
        const allSelected = allIds.length > 0 && allIds.every(id => selectedCardIds.has(id))
        if (allSelected) {
          setSelectedCardIds(new Set())
        } else {
          setSelectedCardIds(new Set(allIds))
        }
      }
    }

    document.addEventListener('keydown', handleCtrlA)
    return () => document.removeEventListener('keydown', handleCtrlA)
  }, [gameState, selectedCardIds, mutateTargeting.isActive])

  // Clean up stale selection IDs when cards leave the battlefield
  useEffect(() => {
    if (selectedCardIds.size === 0) return
    const allBattlefieldIds = new Set([
      ...gameState.creatureArea.rows.flatMap(r => r.elements.map(el => el.instanceId)),
      ...gameState.row3.left.map(el => el.instanceId),
      ...gameState.row3.right.map(el => el.instanceId),
      ...gameState.row4.left.map(el => el.instanceId),
      ...gameState.row4.right.map(el => el.instanceId),
    ])

    const filtered = new Set([...selectedCardIds].filter(id => allBattlefieldIds.has(id)))
    if (filtered.size !== selectedCardIds.size) {
      setSelectedCardIds(filtered)
    }
  }, [gameState, selectedCardIds])

  // Hover tracking for HD Zoom Portal
  const { hoveredCardData } = useHoveredCard(gameState)

  // Equipment docking via drag
  const { handleEquipmentDrop } = useEquipmentDocking(gameState, setGameState)
  void handleEquipmentDrop; // retained for future UI wiring

  // Keybind engine — handles all keyboard shortcuts
  const handleGameAction = useCallback((action: GameAction) => {
    switch (action.type) {
      case 'DRAW':
        setGameState((prev: GameState) => {
          const next = drawCardAction(prev)
          const drawn = next.hand[next.hand.length - 1]
          return drawn ? logAction(next, `Drew ${drawn.name}`) : next
        })
        break
      case 'SHUFFLE':
        setGameState((prev: GameState) => logAction(shuffleLibrary(prev), 'Shuffled library'))
        break
      case 'UNTAP_ALL':
        setGameState((prev: GameState) => untapAll(prev))
        break
      case 'NEXT_TURN':
        setGameState((prev: GameState) => {
          const next = { ...drawCardAction(untapAll(prev)), turnCount: prev.turnCount + 1 }
          const drawn = next.hand[next.hand.length - 1]
          return logAction(next, drawn ? `Turn ${next.turnCount} — Drew ${drawn.name}` : `Turn ${next.turnCount}`)
        })
        break
      case 'NEW_GAME':
        setShowResetConfirm(true)
        break
      case 'TAP_CARD':
        setGameState((prev: GameState) => {
          try { return tapCard(prev, action.cardId) }
          catch { return prev }
        })
        break
      case 'FLIP_CARD':
        setGameState((prev: GameState) => transformDFC(prev, action.cardId))
        break
      case 'MORPH_CARD':
        setGameState((prev: GameState) => flipCard(prev, action.cardId, 'battlefield'))
        break
      case 'PHASE_CARD':
        setGameState((prev: GameState) => updateBattlefieldCard(prev, action.cardId, rc => ({ ...rc, isPhased: !rc.isPhased })))
        break
      case 'TOKEN_COPY':
        setGameState((prev: GameState) => {
          const found = findCardOnBattlefield(prev, action.cardId)
          if (!found) return prev
          const sourceCard = found.card.card
          const isSourceToken = /\btoken\b/i.test(sourceCard.typeLine)
          const copyCard: CardData = {
            ...sourceCard,
            id: crypto.randomUUID(),
            isToken: true,
            isTokenCopy: !isSourceToken,
            isCommander: false,
          }
          return addToBattlefield(prev, copyCard, found.card.rowAssignment)
        })
        break
      case 'ADD_COUNTER':
        setGameState((prev: GameState) => addCounter(prev, action.cardId, '+1/+1'))
        break
      case 'REMOVE_COUNTER':
        setGameState((prev: GameState) => removeCounter(prev, action.cardId, '+1/+1'))
        break
      case 'DELETE_CARD':
        setGameState((prev: GameState) => {
          try {
            // Find which zone the card is in and remove it entirely
            const cardId = action.cardId
            const sourceZone = findCardZone(prev, cardId)
            if (!sourceZone) return prev
            const { newState } = removeCardFromZone(prev, sourceZone, cardId)
            return newState
          } catch { return prev }
        })
        break
      case 'TOGGLE_REVEAL':
        // Toggle reveal state for hand cards (visual indicator)
        setRevealedCardIds(prev => {
          const next = new Set(prev)
          if (next.has(action.cardId)) next.delete(action.cardId)
          else next.add(action.cardId)
          return next
        })
        break
      case 'EQUIP_MODE':
        // Enter equip mode for the hovered card
        setEquipModeCardId(action.cardId)
        break
      case 'MOVE_CARD':
        {
          const cardId = action.cardId
          const dest = action.destination

          // Check for commander prompt before animating (battlefield → graveyard/exile with mutated commander)
          if ((dest === 'graveyard' || dest === 'exile')) {
            const found = findCardOnBattlefield(gameState, cardId)
            if (found && found.card.mutateStack.length > 0) {
              const commanders = getCommandersInStack(found.card)
              if (commanders.length > 0) {
                setCommanderPrompt({
                  isOpen: true,
                  cardId,
                  destination: dest as 'graveyard' | 'exile',
                  commanders,
                  choices: new Map(),
                })
                break
              }
            }
          }

          // Always use fresh state inside updater — never rely on stale gameState closure
          setGameState((prev: GameState) => {
            try {
              const onBattlefield = !!findCardOnBattlefield(prev, cardId)
              const inHand = prev.hand.some(c => c.id === cardId)

              if (onBattlefield || inHand) {
                // Animate collapse, then move after 200ms
                setCollapsingIds(s => new Set(s).add(cardId))
                setTimeout(() => {
                  setCollapsingIds(s => { const n = new Set(s); n.delete(cardId); return n; })
                  setGameState((fresh: GameState) => {
                    try {
                      const sourceZone = findCardZone(fresh, cardId)
                      if (!sourceZone) return fresh
                      return moveCard(fresh, cardId, sourceZone, dest, undefined, getCreatureAreaWidthPx(), window.innerHeight / 100)
                    } catch { return fresh }
                  })
                }, 200)
                return prev // Don't change state yet — collapse animates first
              }

              // Other zones: move instantly
              const sourceZone = findCardZone(prev, cardId)
              if (!sourceZone || sourceZone === dest) return prev
              return moveCard(prev, cardId, sourceZone, dest, undefined, getCreatureAreaWidthPx(), window.innerHeight / 100)
            } catch { return prev }
          })
        }
        break
      case 'QUICK_PLAY':
        {
          const card = gameState.hand[action.handIndex]
          if (!card) break
          const quickPlayId = card.id
          setCollapsingIds(prev => new Set(prev).add(quickPlayId))
          setTimeout(() => {
            setCollapsingIds(prev => { const n = new Set(prev); n.delete(quickPlayId); return n; })
            setGameState((prev: GameState) => {
              const c = prev.hand.find(h => h.id === quickPlayId)
              if (!c) return prev
              try { return moveCard(prev, quickPlayId, 'hand', 'battlefield') }
              catch { return prev }
            })
          }, 200)
        }
        break
      case 'PEEK':
        // Open mode selector (intermediate step before peek modal)
        {
          const count = Math.min(action.count, gameState.library.length)
          if (count > 0 && !showPeekModal) {
            setPeekCount(count)
            setShowPeekModeSelector(true)
          }
        }
        break
      case 'BROWSE_LIBRARY':
        setShowLibraryBrowser(true)
        break
      case 'BROWSE_GRAVEYARD':
        setShowGraveyardBrowser(true)
        break
      case 'BROWSE_EXILE':
        setShowExileBrowser(true)
        break
      case 'UNDO':
        undo()
        break
      case 'TOGGLE_KEYBIND_OVERLAY':
        setShowKeybindOverlay(prev => !prev)
        break
      case 'TOGGLE_GAME_LOG':
        setShowGameLog(prev => !prev)
        break
      case 'CLEAR_SELECTION':
        setSelectedCardIds(new Set())
        break
      default:
        break
    }
  }, [setGameState, gameState.library])

  useKeybinds({
    gameState,
    hoveredCardId: hoveredCardData.card?.id ?? null,
    hoveredZone: hoveredCardData.zone ?? 'battlefield',
    selectedCardIds: Array.from(selectedCardIds),
    onAction: handleGameAction,
  })

  // Modal/dialog state
  const [showImportModal, setShowImportModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeckSwitchConfirm, setShowDeckSwitchConfirm] = useState(false)

  // Token resolver state — persisted in localStorage for reload survival
  const [deckTokens, setDeckTokens] = useState<TokenDefinition[]>(() => {
    try {
      const stored = localStorage.getItem('tcg-playmat-deck-tokens')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [showTokenPanel, setShowTokenPanel] = useState(false)
  const [, setIsDeckSwitchMode] = useState(false)
  const [peekCards, setPeekCards] = useState<CardData[]>([])
  const [showPeekModal, setShowPeekModal] = useState(false)
  const [showPeekModeSelector, setShowPeekModeSelector] = useState(false)
  const [peekCount, setPeekCount] = useState(0)
  const [peekMode, setPeekMode] = useState<PeekMode>('peek')
  const [showKeybindOverlay, setShowKeybindOverlay] = useState(false)
  const [showGameLog, setShowGameLog] = useState(false)
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false)
  const [showGraveyardBrowser, setShowGraveyardBrowser] = useState(false)
  const [showExileBrowser, setShowExileBrowser] = useState(false)
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(new Set())

  // Broadcast game state to stream view via BroadcastChannel
  useBroadcastPublisher(gameState, Array.from(revealedCardIds))

  // Persist deckTokens to localStorage when they change
  useEffect(() => {
    try {
      if (deckTokens.length > 0) {
        localStorage.setItem('tcg-playmat-deck-tokens', JSON.stringify(deckTokens))
      }
    } catch { /* quota exceeded — non-critical */ }
  }, [deckTokens])

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    cardId: string
    cardZone: Zone
    cardType: CardType
    isEquipment: boolean
    isDocked: boolean
    isDFC: boolean
    hasMutateKeyword: boolean
    hasMutateStack: boolean
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    cardId: '',
    cardZone: 'battlefield',
    cardType: 'creature',
    isEquipment: false,
    isDocked: false,
    isDFC: false,
    hasMutateKeyword: false,
    hasMutateStack: false,
  })

  /** Opens context menu for a card at the given position */
  const handleCardContextMenu = useCallback((cardId: string, zone: Zone, position: { x: number; y: number }) => {
    // Determine card type and equipment status
    let cardType: CardType = 'creature'
    let isEquipment = false
    let isDocked = false
    let isDFC = false
    let hasMutateKeyword = false
    let hasMutateStack = false

    if (zone === 'battlefield') {
      const found = findCardOnBattlefield(gameState, cardId)
      if (found) {
        cardType = found.card.card.cardType
        isDFC = found.card.card.backFaceImageURI !== null
        isEquipment = /\b(equipment|aura)\b/i.test(found.card.card.typeLine)
        hasMutateKeyword = /\bmutate\b/i.test(found.card.card.oracleText)
        hasMutateStack = found.card.mutateStack.length > 0
        // Check if this card is docked as an attachment on another card
        const allCards = getAllBattlefieldCards(gameState)
        isDocked = allCards.some(rc => rc.attachments.some(a => a.instanceId === cardId))
      }
    } else if (zone === 'hand') {
      const card = gameState.hand.find(c => c.id === cardId)
      if (card) {
        cardType = card.cardType
        isDFC = card.backFaceImageURI !== null
        isEquipment = /\b(equipment|aura)\b/i.test(card.typeLine)
        hasMutateKeyword = /\bmutate\b/i.test(card.oracleText)
      }
    } else if (zone === 'graveyard') {
      const card = gameState.graveyard.find(c => c.id === cardId)
      if (card) {
        cardType = card.cardType
        isDFC = card.backFaceImageURI !== null
        isEquipment = /\b(equipment|aura)\b/i.test(card.typeLine)
      }
    } else if (zone === 'commandZone') {
      const card = gameState.commandZone.find(c => c.id === cardId)
      if (card) {
        cardType = card.cardType
        isDFC = card.backFaceImageURI !== null
        isEquipment = /\b(equipment|aura)\b/i.test(card.typeLine)
      }
    } else if (zone === 'exile') {
      const ec = gameState.exile.find(ec => ec.card.id === cardId)
      if (ec) {
        cardType = ec.card.cardType
        isDFC = ec.card.backFaceImageURI !== null
        isEquipment = /\b(equipment|aura)\b/i.test(ec.card.typeLine)
      }
    }

    setContextMenu({
      isOpen: true,
      position,
      cardId,
      cardZone: zone,
      cardType,
      isEquipment,
      isDocked,
      isDFC,
      hasMutateKeyword,
      hasMutateStack,
    })
  }, [gameState])

  // Global right-click handler — opens context menu on hovered card
  useEffect(() => {
    function handleGlobalContextMenu(e: MouseEvent) {
      const cardId = hoveredCardData.card?.id
      const zone = hoveredCardData.zone
      if (!cardId || !zone) return

      e.preventDefault()
      handleCardContextMenu(cardId, zone, { x: e.clientX, y: e.clientY })
    }

    document.addEventListener('contextmenu', handleGlobalContextMenu)
    return () => document.removeEventListener('contextmenu', handleGlobalContextMenu)
  }, [hoveredCardData, handleCardContextMenu])

  /** Handles zone browser move actions (library/graveyard/exile → destination) */
  const handleZoneBrowserMove = (cardId: string, sourceZone: Zone, destination: ZoneBrowserDestination) => {
    setGameState((prev: GameState) => {
      try {
        if (destination === 'battlefield-tapped') {
          const newState = moveCard(prev, cardId, sourceZone, 'battlefield')
          return updateBattlefieldCard(newState, cardId, rc => ({ ...rc, isTapped: true }))
        }
        if (destination === 'battlefield-facedown') {
          const newState = moveCard(prev, cardId, sourceZone, 'battlefield')
          return updateBattlefieldCard(newState, cardId, rc => ({ ...rc, isFaceDown: true }))
        }
        if (destination === 'battlefield-backface') {
          const newState = moveCard(prev, cardId, sourceZone, 'battlefield')
          return updateBattlefieldCard(newState, cardId, rc => ({ ...rc, showingBackFace: true }))
        }
        return moveCard(prev, cardId, sourceZone, destination as Zone)
      } catch { return prev }
    })
  }

  /** Handles context menu action dispatch — multi-select aware */
  const handleContextMenuAction = useCallback((action: ContextMenuAction) => {
    const cardId = contextMenu.cardId
    const cardZone = contextMenu.cardZone

    // Actions that should propagate to all selected cards
    const MULTI_SELECT_ACTIONS = new Set([
      'TAP', 'PHASE', 'ADD_COUNTER', 'REMOVE_COUNTER', 'ADD_POWER', 'ADD_TOUGHNESS',
      'RESET_PT', 'RESET_POWER', 'RESET_TOUGHNESS', 'ADD_PT_COMBINED', 'REMOVE_ALL_COUNTERS',
      'DELETE', 'MOVE_TO', 'FLIP', 'TRANSFORM', 'MORPH',
    ]);

    // Determine target card IDs — if right-clicked card is in selection, apply to all selected
    const targetIds: string[] = (selectedCardIds.has(cardId) && selectedCardIds.size > 1 && MULTI_SELECT_ACTIONS.has(action.type))
      ? Array.from(selectedCardIds)
      : [cardId];

    // Helper to apply an action to each target card
    const forEachTarget = (fn: (prev: GameState, id: string) => GameState) => {
      setGameState((prev: GameState) => {
        let state = prev;
        for (const id of targetIds) {
          state = fn(state, id);
        }
        return state;
      });
    };

    switch (action.type) {
      case 'TAP':
        forEachTarget((prev, id) => tapCard(prev, id))
        break
      case 'MOVE_TO': {
        const dest = action.destination
        if (dest === 'top-library') {
          // Move to top of library
          setGameState((prev: GameState) => {
            try {
              const { card, newState } = removeCardFromZone(prev, cardZone, cardId)
              return { ...newState, library: [card, ...newState.library] }
            } catch { return prev }
          })
        } else if (dest === 'bottom-library') {
          // Move to bottom of library
          setGameState((prev: GameState) => {
            try {
              const { card, newState } = removeCardFromZone(prev, cardZone, cardId)
              return { ...newState, library: [...newState.library, card] }
            } catch { return prev }
          })
        } else if (dest === 'shuffle-library') {
          // Move into library and shuffle
          setGameState((prev: GameState) => {
            try {
              const { card, newState } = removeCardFromZone(prev, cardZone, cardId)
              const newLibrary = [...newState.library, card]
              for (let i = newLibrary.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newLibrary[i], newLibrary[j]] = [newLibrary[j], newLibrary[i]]
              }
              return { ...newState, library: newLibrary }
            } catch { return prev }
          })
        } else {
          // Normal zone move — check for commander prompt before moving
          if (cardZone === 'battlefield' && (dest === 'graveyard' || dest === 'exile')) {
            // Check if mutated creature with commanders needs prompting
            const found = findCardOnBattlefield(gameState, cardId)
            if (found && found.card.mutateStack.length > 0) {
              const commanders = getCommandersInStack(found.card)
              if (commanders.length > 0) {
                // Show commander zone prompt instead of moving
                setCommanderPrompt({
                  isOpen: true,
                  cardId,
                  destination: dest as 'graveyard' | 'exile',
                  commanders,
                  choices: new Map(),
                })
                break
              }
            }
          }
          // No commander prompt needed — move normally
          setGameState((prev: GameState) => {
            try { return moveCard(prev, cardId, cardZone, dest as Zone) }
            catch { return prev }
          })
        }
        break
      }
      case 'FLIP':
        setGameState((prev: GameState) => flipCard(prev, cardId, cardZone))
        break
      case 'TRANSFORM':
        setGameState((prev: GameState) => transformDFC(prev, cardId))
        break
      case 'MORPH':
        setGameState((prev: GameState) => flipCard(prev, cardId, cardZone))
        break
      case 'PHASE':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({ ...rc, isPhased: !rc.isPhased })))
        break
      case 'ADD_COUNTER':
        forEachTarget((prev, id) => addCounter(prev, id, action.counterType))
        break
      case 'REMOVE_COUNTER':
        forEachTarget((prev, id) => removeCounter(prev, id, action.counterType))
        break
      case 'ADD_POWER':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc, powerModifier: (rc.powerModifier ?? 0) + action.amount
        })))
        break
      case 'ADD_TOUGHNESS':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc, toughnessModifier: (rc.toughnessModifier ?? 0) + action.amount
        })))
        break
      case 'RESET_PT':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc, powerModifier: 0, toughnessModifier: 0
        })))
        break
      case 'RESET_POWER':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc, powerModifier: 0
        })))
        break
      case 'RESET_TOUGHNESS':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc, toughnessModifier: 0
        })))
        break
      case 'ADD_PT_COMBINED':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc,
          powerModifier: (rc.powerModifier ?? 0) + action.amount,
          toughnessModifier: (rc.toughnessModifier ?? 0) + action.amount
        })))
        break
      case 'REMOVE_ALL_COUNTERS':
        forEachTarget((prev, id) => updateBattlefieldCard(prev, id, rc => ({
          ...rc,
          counters: rc.counters.filter(c => c.type !== action.counterType)
        })))
        break
      case 'TOKEN_COPY': {
        setGameState((prev: GameState) => {
          const found = findCardOnBattlefield(prev, cardId)
          if (!found) return prev
          let state = prev
          for (let i = 0; i < action.quantity; i++) {
            const sourceCard = found.card.card
            const isSourceToken = /\btoken\b/i.test(sourceCard.typeLine)
            const copyCard: CardData = {
              ...sourceCard,
              id: crypto.randomUUID(),
              isToken: true,
              isTokenCopy: !isSourceToken,
              isCommander: false,
            }
            state = addToBattlefield(state, copyCard, found.card.rowAssignment)
          }
          return state
        })
        break
      }
      case 'DELETE':
        forEachTarget((prev, id) => {
          try {
            const { newState } = removeCardFromZone(prev, cardZone, id)
            return newState
          } catch { return prev }
        })
        break
      case 'EQUIP':
        // Enter equip mode — next click on a creature will attach this equipment
        setEquipModeCardId(cardId)
        break
      case 'DETACH':
        // Detach equipment from creature — remove from attachments, place back on battlefield
        setGameState((prev: GameState) => {
          try {
            const { card, newState } = removeCardFromZone(prev, 'battlefield', cardId)
            return addToBattlefield(newState, card)
          } catch { return prev }
        })
        break
      case 'REVEAL':
        // Toggle reveal state — visual only
        break
      case 'VIEW_DETAILS':
        // Would open a detail modal — no-op for now
        break
      case 'PLAY_TO_BATTLEFIELD':
        setGameState((prev: GameState) => {
          try { return moveCard(prev, cardId, cardZone, 'battlefield') }
          catch { return prev }
        })
        break
      case 'PLAY_TAPPED':
        setGameState((prev: GameState) => {
          try {
            const newState = moveCard(prev, cardId, cardZone, 'battlefield')
            return updateBattlefieldCard(newState, cardId, rc => ({ ...rc, isTapped: true }))
          } catch { return prev }
        })
        break
      case 'PLAY_FACE_DOWN':
        setGameState((prev: GameState) => {
          try {
            const newState = moveCard(prev, cardId, cardZone, 'battlefield')
            return updateBattlefieldCard(newState, cardId, rc => ({ ...rc, isFaceDown: true }))
          } catch { return prev }
        })
        break
      case 'PLAY_AS_BACK_FACE':
        // Play MDFC as its back face — move to battlefield using back face's card type for row assignment, then flip
        setGameState((prev: GameState) => {
          try {
            const card = prev.hand.find(c => c.id === cardId)
            if (!card || !card.backFaceImageURI) return prev
            // Remove from hand
            const newHand = prev.hand.filter(c => c.id !== cardId)
            const stateWithoutCard = { ...prev, hand: newHand }
            // Add to battlefield using back face card type for row assignment
            const backType = card.backFaceCardType ?? card.cardType
            // Create a temporary card with the back face type for placement logic
            const cardForPlacement: CardData = { ...card, cardType: backType }
            let newState = addToBattlefield(stateWithoutCard, cardForPlacement)
            // Now set showingBackFace = true on the placed card — keep backFaceCardType as the active cardType
            const toggleBack = (cards: import('./types').RowCard[]) =>
              cards.map(rc => rc.instanceId === cardId ? { ...rc, showingBackFace: true } : rc)
            for (let i = 0; i < newState.creatureArea.rows.length; i++) {
              if (newState.creatureArea.rows[i].elements.some(rc => rc.instanceId === cardId)) {
                const newRows = newState.creatureArea.rows.map((r, ri) =>
                  ri === i ? { ...r, elements: toggleBack(r.elements) } : r
                )
                return { ...newState, creatureArea: { ...newState.creatureArea, rows: newRows } }
              }
            }
            if (newState.row3.left.some(rc => rc.instanceId === cardId))
              return { ...newState, row3: { ...newState.row3, left: toggleBack(newState.row3.left) } }
            if (newState.row3.right.some(rc => rc.instanceId === cardId))
              return { ...newState, row3: { ...newState.row3, right: toggleBack(newState.row3.right) } }
            if (newState.row4.left.some(rc => rc.instanceId === cardId))
              return { ...newState, row4: { ...newState.row4, left: toggleBack(newState.row4.left) } }
            if (newState.row4.right.some(rc => rc.instanceId === cardId))
              return { ...newState, row4: { ...newState.row4, right: toggleBack(newState.row4.right) } }
            return newState
          } catch { return prev }
        })
        break
      case 'MUTATE_ONTO': {
        // Initiate mutate target selection mode
        const sourceZone = cardZone as 'battlefield' | 'hand'
        const validTargets = getValidMutateTargets(gameState, cardId)
        if (validTargets.length === 0) {
          addToast({ type: 'info', message: 'No valid mutate targets' })
        } else {
          setMutateTargeting({
            isActive: true,
            sourceCardId: cardId,
            sourceZone,
            validTargetIds: validTargets.map(rc => rc.instanceId),
          })
        }
        break
      }
      case 'SPLIT_MUTATE_STACK':
        splitMutateStack(cardId)
        break
      case 'BROWSE_ZONE':
        if (cardZone === 'library') {
          setShowLibraryBrowser(true)
        } else if (cardZone === 'graveyard') {
          setShowGraveyardBrowser(true)
        } else if (cardZone === 'exile') {
          setShowExileBrowser(true)
        }
        break
      case 'DRAW_CARD':
        setGameState((prev: GameState) => drawCardAction(prev))
        break
      case 'SHUFFLE_LIBRARY':
        setGameState((prev: GameState) => shuffleLibrary(prev))
        break
    }
  }, [contextMenu.cardId, contextMenu.cardZone, selectedCardIds, setGameState, gameState, addToast, splitMutateStack])

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  /** Handle clicking a card while in mutate targeting mode */
  const handleMutateTargetClick = useCallback((cardId: string) => {
    if (!mutateTargeting.isActive) return
    if (!mutateTargeting.validTargetIds.includes(cardId)) return
    // Show placement dialog
    setMutatePlacement({ isOpen: true, targetCardId: cardId })
  }, [mutateTargeting])

  /** Handle mutate placement choice (Place on top / Place on bottom) */
  const handleMutatePlacementChoice = useCallback((placement: 'over' | 'under') => {
    const { sourceCardId, sourceZone } = mutateTargeting
    const { targetCardId } = mutatePlacement
    if (!sourceCardId || !sourceZone) return
    mutateOnto(sourceCardId, targetCardId, placement, sourceZone)
    // Exit targeting mode
    setMutateTargeting({ isActive: false, sourceCardId: null, sourceZone: null, validTargetIds: [] })
    setMutatePlacement({ isOpen: false, targetCardId: '' })
  }, [mutateTargeting, mutatePlacement, mutateOnto])

  /** Cancel mutate placement dialog */
  const handleMutatePlacementCancel = useCallback(() => {
    setMutatePlacement({ isOpen: false, targetCardId: '' })
  }, [])

  /** Handle commander zone prompt completion — call moveMutatedCreature with choices */
  const handleCommanderPromptComplete = useCallback((choices: Map<string, 'commandZone' | 'graveyard' | 'exile'>) => {
    const { cardId, destination } = commanderPrompt
    moveMutatedCreature(cardId, destination, choices)
    setCommanderPrompt(EMPTY_COMMANDER_PROMPT)
  }, [commanderPrompt, moveMutatedCreature])

  /** Cancel commander zone prompt — no state change */
  const handleCommanderPromptCancel = useCallback(() => {
    setCommanderPrompt(EMPTY_COMMANDER_PROMPT)
  }, [])

  const handleDraw = () => {
    setGameState((prev: GameState) => drawCardAction(prev))
  }

  // --- Drag and Drop ---
  const handleDragStart = (event: DragStartEvent) => {
    setSelectedCardIds(new Set())
    setActiveDragId(event.active.id as string)
  }

  // Cross-row mid-drag transfer: moves card between rows while dragging
  // so that the destination SortableContext picks it up for displacement.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const sourceZone = active.data.current?.sourceZone as string | undefined
    if (sourceZone !== 'battlefield') return // Only cross-row for battlefield cards

    const activeRowId = active.data.current?.rowId as RowTarget | undefined
    if (!activeRowId) return

    // Determine the row of the "over" target
    let overRowId: RowTarget | undefined
    const overData = over.data.current

    if (overData?.rowId) {
      overRowId = overData.rowId as RowTarget
    } else if ((over.id as string).startsWith('row-')) {
      // Dropping on the row droppable itself
      overRowId = (over.id as string).replace('row-', '') as RowTarget
    }

    if (!overRowId || activeRowId === overRowId) return // Same row or no target row

    // Don't transfer if this is an equipment/aura dock attempt
    const cardId = active.data.current?.cardId as string
    const overCardType = overData?.cardType as string | undefined
    if (overCardType === 'creature' && overData?.sourceZone === 'battlefield') {
      // Could be an equipment dock — let onDragEnd handle it
      const found = findCardOnBattlefield(gameState, cardId)
      if (found) {
        const typeLine = found.card.card.typeLine
        if (/\bequipment\b/i.test(typeLine) || /\baura\b/i.test(typeLine) || /\bfortification\b/i.test(typeLine)) {
          return
        }
      }
    }

    // Transfer the card from activeRow to overRow in state
    const overCardId = overData?.cardId as string | undefined
    setGameState((prev: GameState) => {
      const sourceCards = getRowCards(prev, activeRowId)
      const cardIndex = sourceCards.findIndex(rc => rc.instanceId === cardId)
      if (cardIndex === -1) return prev // Already transferred

      const card = sourceCards[cardIndex]
      const newSource = sourceCards.filter(rc => rc.instanceId !== cardId)
      const targetCards = getRowCards(prev, overRowId!)
      const insertAt = overCardId ? targetCards.findIndex(rc => rc.instanceId === overCardId) : -1
      const newTarget = [...targetCards]
      newTarget.splice(insertAt === -1 ? newTarget.length : insertAt, 0, { ...card, rowAssignment: overRowId! })

      let s = setRowCards(prev, activeRowId, newSource)
      s = setRowCards(s, overRowId!, newTarget)
      return s
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event

    if (!over) return // Dropped outside any valid zone — snap back

    const cardId = active.data.current?.cardId as string
    const sourceZone = active.data.current?.sourceZone as Zone

    if (!cardId || !sourceZone) return

    const overId = over.id as string
    const overData = over.data.current
    const cardType = active.data.current?.cardType as string

    // ── Priority 1: Attached equipment being dragged ──────────────────────────
    if (isAttachedEquipment(cardId, gameState)) {
      const parentId = findParentCreature(cardId, gameState)
      if (!parentId) return

      // Drop on different creature → re-equip
      if (overData?.cardType === 'creature' && overData?.cardId !== parentId) {
        setGameState((prev: GameState) => {
          try {
            const detached = detachEquipment(prev, cardId, parentId)
            return attachEquipment(detached, cardId, overData.cardId as string)
          } catch { return prev }
        })
        return
      }
      // Drop on battlefield row → detach to standalone
      if (overId.startsWith('row-') || overData?.rowId) {
        setGameState((prev: GameState) => {
          try {
            return detachEquipment(prev, cardId, parentId)
          } catch { return prev }
        })
        return
      }
      // Drop on hand zone → detach + move to hand
      if (overId === 'hand-zone' || overId === 'hand-drop-zone') {
        setGameState((prev: GameState) => {
          try {
            const detached = detachEquipment(prev, cardId, parentId)
            return moveCard(detached, cardId, 'battlefield', 'hand')
          } catch { return prev }
        })
        return
      }
      // Drop on zone (graveyard, exile, commandZone, library) → detach + move
      if (['commandZone', 'graveyard', 'library', 'exile'].includes(overId)) {
        const targetZone = overId as Zone
        setGameState((prev: GameState) => {
          try {
            const detached = detachEquipment(prev, cardId, parentId)
            return moveCard(detached, cardId, 'battlefield', targetZone)
          } catch { return prev }
        })
        return
      }
      // No valid target matched → snap back (do nothing)
      return
    }

    // ─── Priority 2: Equipment/Aura docking (any source zone → valid target) ─────────────
    if (overData?.cardType && overData?.sourceZone === 'battlefield' && overData?.cardId) {
      const targetId = overData.cardId as string
      const targetCardType = overData.cardType as string
      if (cardId !== targetId) {
        // Resolve the card's typeLine and oracleText to check if it's dockable
        let typeLine = ''
        let oracleText = ''
        const handCard = gameState.hand.find(c => c.id === cardId)
        if (handCard) { typeLine = handCard.typeLine; oracleText = handCard.oracleText }
        else {
          const gyCard = gameState.graveyard.find(c => c.id === cardId)
          if (gyCard) { typeLine = gyCard.typeLine; oracleText = gyCard.oracleText }
          else {
            const exCard = gameState.exile.find(ec => ec.card.id === cardId)
            if (exCard) { typeLine = exCard.card.typeLine; oracleText = exCard.card.oracleText }
            else {
              const bfCard = findCardOnBattlefield(gameState, cardId)
              if (bfCard) { typeLine = bfCard.card.card.typeLine; oracleText = bfCard.card.card.oracleText }
              else {
                // Check if it's currently an attachment
                const allBf = getAllBattlefieldCards(gameState)
                for (const rc of allBf) {
                  const att = rc.attachments.find(a => a.instanceId === cardId)
                  if (att) { typeLine = att.card.typeLine; oracleText = att.card.oracleText; break }
                }
              }
            }
          }
        }

        const isDockable = /\bequipment\b/i.test(typeLine) || /\baura\b/i.test(typeLine) || /\bfortification\b/i.test(typeLine)
        if (isDockable) {
          // Validate target type against valid dock targets
          const validTargets = getValidDockTargets(oracleText, typeLine, cardType as CardType)
          if (validTargets.includes(targetCardType as CardType)) {
            setGameState((prev: GameState) => {
              try {
                let state = prev

                // Check if the card is currently an attachment on another permanent
                const allBf = getAllBattlefieldCards(state)
                const parentPermanent = allBf.find(rc => rc.attachments.some(a => a.instanceId === cardId))

                if (parentPermanent) {
                  // Re-equip: detach from current, then attach to new
                  state = detachEquipment(state, cardId, parentPermanent.instanceId)
                  return attachEquipment(state, cardId, targetId)
                }

                if (sourceZone !== 'battlefield') {
                  // Coming from hand/graveyard/exile — move to battlefield first
                  state = moveCard(state, cardId, sourceZone, 'battlefield')
                }

                // Attach to the target
                return attachEquipment(state, cardId, targetId)
              } catch { return prev }
            })
            return
          }
        }
      }
    }

    try {
      // ─── Detach equipment if dragging an attached card to a row/zone ─────
      // If the dragged card is currently an attachment, detach it first
      const allBfCards = getAllBattlefieldCards(gameState)
      const parentOfDragged = allBfCards.find(rc => rc.attachments.some(a => a.instanceId === cardId))
      if (parentOfDragged) {
        // Dragging an attached equipment — route based on drop target
        if (overId === 'hand-zone' || overId === 'hand-drop-zone') {
          // Drop on hand → detach + move to hand
          setGameState((prev: GameState) => {
            try {
              const detached = detachEquipment(prev, cardId, parentOfDragged.instanceId)
              return moveCard(detached, cardId, 'battlefield', 'hand')
            } catch { return prev }
          })
          return
        }

        if (['commandZone', 'graveyard', 'library', 'exile'].includes(overId)) {
          // Drop on a zone → detach + move to that zone
          const targetZone = overId as Zone
          setGameState((prev: GameState) => {
            try {
              const detached = detachEquipment(prev, cardId, parentOfDragged.instanceId)
              return moveCard(detached, cardId, 'battlefield', targetZone)
            } catch { return prev }
          })
          return
        }

        if (overData?.cardType === 'creature' && overData?.sourceZone === 'battlefield') {
          // Drop on another creature → re-equip
          const targetCreatureId = overData.cardId as string
          if (targetCreatureId !== parentOfDragged.instanceId) {
            setGameState((prev: GameState) => {
              try {
                const detached = detachEquipment(prev, cardId, parentOfDragged.instanceId)
                return attachEquipment(detached, cardId, targetCreatureId)
              } catch { return prev }
            })
          }
          return
        }

        if (overId.startsWith('row-')) {
          // Drop on a battlefield row → detach + place as standalone in correct row
          setGameState((prev: GameState) => {
            try {
              return detachEquipment(prev, cardId, parentOfDragged.instanceId)
            } catch { return prev }
          })
          return
        }

        // No valid target matched → snap back (do nothing)
        return
      }

      // ── Priority 3: Same-row reorder ──────────────────────────────────────
      const activeRowId = active.data.current?.rowId as RowTarget | undefined
      let overRowId = over.data.current?.rowId as RowTarget | undefined
      // If over target is a sortable card, its data already has rowId
      let overCardId = overId
      if (!overRowId && overData?.sourceZone === 'battlefield' && overData?.cardId) {
        overCardId = overData.cardId as string
        // Find which row this card is in
        for (const row of gameState.creatureArea.rows) {
          if (row.elements.some(rc => rc.instanceId === overCardId)) {
            overRowId = row.id as RowTarget
            break
          }
        }
        if (!overRowId) {
          if (gameState.row3.left.some(rc => rc.instanceId === overCardId)) overRowId = 'row3-lands'
          else if (gameState.row3.right.some(rc => rc.instanceId === overCardId)) overRowId = 'row3-artifacts'
          else if (gameState.row4.left.some(rc => rc.instanceId === overCardId)) overRowId = 'row4-lands'
          else if (gameState.row4.right.some(rc => rc.instanceId === overCardId)) overRowId = 'row4-enchantments'
        }
      }

      if (sourceZone === 'battlefield' && activeRowId && overRowId && activeRowId === overRowId && cardId !== overCardId) {
        const rowCards = getRowCards(gameState, activeRowId)
        const oldIndex = rowCards.findIndex(rc => rc.instanceId === cardId)
        const newIndex = rowCards.findIndex(rc => rc.instanceId === overCardId)
        if (oldIndex !== -1 && newIndex !== -1) {
          setGameState((prev: GameState) => {
            const currentRowCards = getRowCards(prev, activeRowId)
            const oIdx = currentRowCards.findIndex(rc => rc.instanceId === cardId)
            const nIdx = currentRowCards.findIndex(rc => rc.instanceId === overCardId)
            if (oIdx === -1 || nIdx === -1) return prev
            return reorderWithinRowAction(prev, activeRowId, oIdx, nIdx)
          })
          return
        }
      }

      // ── Priority 4: Cross-row move ────────────────────────────────────────
      if (sourceZone === 'battlefield' && activeRowId && overRowId && activeRowId !== overRowId) {
        setGameState((prev: GameState) => {
          const sourceCards = getRowCards(prev, activeRowId)
          const cardIndex = sourceCards.findIndex(rc => rc.instanceId === cardId)
          if (cardIndex === -1) return prev
          const card = sourceCards[cardIndex]
          const newSource = sourceCards.filter(rc => rc.instanceId !== cardId)
          const targetCards = getRowCards(prev, overRowId!)
          const insertAt = targetCards.findIndex(rc => rc.instanceId === overCardId)
          const newTarget = [...targetCards]
          newTarget.splice(insertAt === -1 ? newTarget.length : insertAt, 0, { ...card, rowAssignment: overRowId! })
          let s = setRowCards(prev, activeRowId, newSource)
          s = setRowCards(s, overRowId!, newTarget)
          return s
        })
        return
      }

      // Determine destination zone
      if (overId.startsWith('row-')) {
        // Dropped on a battlefield row track — validate card type matches row
        const rowId = overData?.rowId as RowTarget
        const insertIndex = (overData?.insertIndex as number) ?? -1

        if (rowId) {
          // Auto-correct row based on card type (ignore where user dropped)
          let targetRow = rowId
          if (cardType === 'creature' || cardType === 'planeswalker' || cardType === 'battle') {
            // Creatures/PWs/Battles can only go to creature area or pw-battle column
            if (rowId === 'row3-lands' || rowId === 'row3-artifacts' || rowId === 'row4-lands' || rowId === 'row4-enchantments') {
              targetRow = cardType === 'creature' ? 'creature-1' : 'pw-battle-column'
            }
          } else if (cardType === 'land') {
            // Lands can only go to row3-lands or row4-lands
            if (rowId.startsWith('creature') || rowId === 'row3-artifacts' || rowId === 'row4-enchantments' || rowId === 'pw-battle-column') {
              targetRow = 'row3-lands'
            }
          } else if (cardType === 'artifact') {
            // Artifacts go to row3-artifacts
            if (rowId !== 'row3-artifacts') {
              targetRow = 'row3-artifacts'
            }
          } else if (cardType === 'enchantment') {
            // Enchantments go to row4-enchantments
            if (rowId !== 'row4-enchantments') {
              targetRow = 'row4-enchantments'
            }
          } else if (cardType === 'instant' || cardType === 'sorcery' || cardType === 'other') {
            // Instants/sorceries/other go to creature area (row 3 / middle of battlefield)
            targetRow = 'creature-1'
          }

          // ─── Battlefield reordering: card already on battlefield, dropped on same zone ───
          if (sourceZone === 'battlefield') {
            setGameState((prev: GameState) => {
              // Check if card is on the battlefield
              const bfResult = findCardOnBattlefield(prev, cardId)
              if (!bfResult) return prev // Not found, no-op

              // Determine which array the card is currently in and which it's going to
              const getRowArray = (state: GameState, row: RowTarget): { cards: import('./types').RowCard[]; path: string } | null => {
                if (row.startsWith('creature-') || row === 'pw-battle-column') {
                  const rowIdx = row === 'pw-battle-column' ? 0 :
                    parseInt(row.replace('creature-', ''), 10) - 1
                  if (rowIdx < state.creatureArea.rows.length) {
                    return { cards: state.creatureArea.rows[rowIdx].elements, path: `creature-${rowIdx}` }
                  }
                  return null
                }
                if (row === 'row3-lands') return { cards: state.row3.left, path: 'row3-left' }
                if (row === 'row3-artifacts') return { cards: state.row3.right, path: 'row3-right' }
                if (row === 'row4-lands') return { cards: state.row4.left, path: 'row4-left' }
                if (row === 'row4-enchantments') return { cards: state.row4.right, path: 'row4-right' }
                return null
              }

              const targetArr = getRowArray(prev, targetRow)
              if (!targetArr) return moveCard(prev, cardId, sourceZone, 'battlefield', targetRow)

              // Check if card is in the target array
              const currentIdx = targetArr.cards.findIndex(rc => rc.instanceId === cardId)
              if (currentIdx === -1) {
                // Card is on battlefield but in a different row — use moveCard
                return moveCard(prev, cardId, 'battlefield', 'battlefield', targetRow)
              }

              // Card is in the same row — reorder
              const card = targetArr.cards[currentIdx]
              const withoutCard = [...targetArr.cards.slice(0, currentIdx), ...targetArr.cards.slice(currentIdx + 1)]
              const effectiveInsertIndex = insertIndex >= 0
                ? Math.min(insertIndex > currentIdx ? insertIndex - 1 : insertIndex, withoutCard.length)
                : withoutCard.length
              const reordered = [
                ...withoutCard.slice(0, effectiveInsertIndex),
                card,
                ...withoutCard.slice(effectiveInsertIndex),
              ]

              // Apply the reordered array back to state
              if (targetRow.startsWith('creature-') || targetRow === 'pw-battle-column') {
                const rowIdx = targetRow === 'pw-battle-column' ? 0 :
                  parseInt(targetRow.replace('creature-', ''), 10) - 1
                const newRows = prev.creatureArea.rows.map((r, i) =>
                  i === rowIdx ? { ...r, elements: reordered } : r
                )
                return { ...prev, creatureArea: { ...prev.creatureArea, rows: newRows } }
              }
              if (targetRow === 'row3-lands') return { ...prev, row3: { ...prev.row3, left: reordered } }
              if (targetRow === 'row3-artifacts') return { ...prev, row3: { ...prev.row3, right: reordered } }
              if (targetRow === 'row4-lands') return { ...prev, row4: { ...prev.row4, left: reordered } }
              if (targetRow === 'row4-enchantments') return { ...prev, row4: { ...prev.row4, right: reordered } }
              return prev
            })
          } else {
            setGameState((prev: GameState) => moveCard(prev, cardId, sourceZone, 'battlefield', targetRow))
          }
        }
      } else if (sourceZone === 'hand' && overData?.sourceZone === 'hand' && overId !== cardId) {
        // ─── Sortable hand reorder: card dropped on another hand card ─────
        const overCardId = (overData?.cardId as string) ?? overId
        setGameState((prev: GameState) => {
          const oldIndex = prev.hand.findIndex(c => c.id === cardId)
          const newIndex = prev.hand.findIndex(c => c.id === overCardId)
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
          return { ...prev, hand: arrayMove(prev.hand, oldIndex, newIndex) }
        })
      } else if (overId === 'hand-zone' || overId === 'hand-drop-zone') {
        if (sourceZone === 'hand') {
          // Hand-to-hand: reorder within hand (dropped on zone generically — move to end)
          setGameState((prev: GameState) => {
            const currentIdx = prev.hand.findIndex(c => c.id === cardId)
            if (currentIdx === -1) return prev
            const card = prev.hand[currentIdx]
            const withoutCard = [...prev.hand.slice(0, currentIdx), ...prev.hand.slice(currentIdx + 1)]
            return { ...prev, hand: [...withoutCard, card] }
          })
        } else {
          setGameState((prev: GameState) => moveCard(prev, cardId, sourceZone, 'hand'))
        }
      } else if (['commandZone', 'graveyard', 'library', 'exile'].includes(overId)) {
        const destZone = overId as Zone
        if (sourceZone !== destZone) {
          setGameState((prev: GameState) => moveCard(prev, cardId, sourceZone, destZone))
        }
      }
    } catch (err) {
      // Invalid move — snap back (no state change)
      console.warn('Invalid move:', err)
    }
  }

  // --- Battlefield interactions ---
  const handleTapCard = (cardId: string) => {
    // If in equip mode, clicking a creature attaches the equipment
    if (equipModeCardId) {
      const target = findCardOnBattlefield(gameState, cardId)
      if (target && target.card.card.cardType === 'creature') {
        setGameState((prev: GameState) => {
          try {
            // Check if equipment is currently attached somewhere
            const allBf = getAllBattlefieldCards(prev)
            const parent = allBf.find(rc => rc.attachments.some(a => a.instanceId === equipModeCardId))
            let state = prev
            if (parent) {
              state = detachEquipment(state, equipModeCardId, parent.instanceId)
            }
            return attachEquipment(state, equipModeCardId, cardId)
          } catch { return prev }
        })
        setEquipModeCardId(null)
        return
      }
      // Clicked something that's not a creature — cancel equip mode
      setEquipModeCardId(null)
      return
    }
    setGameState((prev: GameState) => tapCard(prev, cardId))
  }

  const handleDropCard = (_cardId: string, _targetRow: RowTarget, _insertIndex: number) => {
    // This is handled by onDragEnd, but kept for interface compatibility
  }

  const handleAttachEquipment = (_equipmentId: string, _creatureId: string) => {
    // Equipment attachment handled via context menu or Ctrl+E
  }

  const handleMoveWithinRow = (_cardId: string, _targetRow: RowTarget, _insertIndex: number) => {
    // Reordering within a row — handled by DnD context
  }

  // --- Soft Reset ---
  const handleSoftResetClick = () => {
    setShowResetConfirm(true)
  }

  const handleSoftResetConfirm = () => {
    clearTokenCache()
    setDeckTokens([])
    localStorage.removeItem('tcg-playmat-deck-tokens')
    setSelectedCardIds(new Set())
    setGameState((prev: GameState) => {
      try {
        return initializeMulligan(softReset(prev))
      } catch (err) {
        console.error('Soft reset failed:', err)
        return prev
      }
    })
    setShowResetConfirm(false)
  }

  const handleSoftResetCancel = () => {
    setShowResetConfirm(false)
  }

  // --- Deck Switch ---
  const handleDeckSwitchClick = () => {
    if (isGameInProgress(gameState)) {
      // Game in progress — show confirmation first
      setShowDeckSwitchConfirm(true)
    } else {
      // No game in progress — open import modal directly
      setIsDeckSwitchMode(true)
      setShowImportModal(true)
    }
  }
  void handleDeckSwitchClick; // retained for future UI wiring

  const handleDeckSwitchConfirm = () => {
    clearTokenCache()
    setDeckTokens([])
    setShowDeckSwitchConfirm(false)
    setIsDeckSwitchMode(true)
    setShowImportModal(true)
  }

  const handleDeckSwitchCancel = () => {
    setShowDeckSwitchConfirm(false)
  }

  const handleImportComplete = (deck: { mainboard: CardData[]; commanders: CardData[]; resolvedScryfallCards: ScryfallCard[] }) => {
    setGameState((_prev: GameState) => {
      const freshState: GameState = {
        gamePhase: 'PLAYING',
        creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
        row3: { left: [], right: [] },
        row4: { left: [], right: [] },
        hand: [],
        commandZone: deck.commanders,
        graveyard: [],
        library: deck.mainboard,
        exile: [],
        mulliganState: null,
        deckLoaded: true,
        lifeTotal: 40,
        turnCount: 0,
        gameLog: [],
      }
      // Initialize mulligan: draws 7 from library, sets gamePhase = 'MULLIGAN'
      return initializeMulligan(freshState)
    })
    setIsDeckSwitchMode(false)

    // Eagerly resolve tokens from the already-fetched Scryfall data (single batch call)
    resolveTokensFromCards(deck.resolvedScryfallCards).then(setDeckTokens)
  }

  const handleImportClose = () => {
    setShowImportModal(false)
    setIsDeckSwitchMode(false)
  }

  // Show import modal on first load if no deck loaded
  const handleOpenImport = () => {
    setShowImportModal(true)
  }
  void handleOpenImport; // retained for future UI wiring

  // Auto-show import modal on first load if no deck loaded
  useEffect(() => {
    if (!gameState.deckLoaded) {
      setShowImportModal(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppShell
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        overlay={
          <>
            {/* Drag Overlay — renders above ALL zones via position:fixed + z-index:9999.
                Inside DndContext (via AppShell) but outside the grid to avoid overflow:hidden clipping.
                @dnd-kit DragOverlay uses CSS transform for GPU-accelerated cursor tracking.
                dropAnimation uses a smooth ease-out curve for snap-back on invalid drops. */}
            <DragOverlay
              dropAnimation={null}
              style={{ zIndex: 9999 }}
            >
              {activeDragId ? (
                <DragOverlayCard cardId={activeDragId} gameState={gameState} />
              ) : null}
            </DragOverlay>
          </>
        }
      >
        <Battlefield
          creatureArea={gameState.creatureArea}
          row3={gameState.row3}
          row4={gameState.row4}
          handCount={gameState.hand.length}
          turnCount={gameState.turnCount}
          lifeTotal={gameState.lifeTotal}
          onLifeChange={(delta: number) => setGameState((prev: GameState) => ({ ...prev, lifeTotal: prev.lifeTotal + delta }))}
          gamePhase={gameState.gamePhase}
          onDropCard={handleDropCard}
          onTapCard={handleTapCard}
          onAttachEquipment={handleAttachEquipment}
          onMoveWithinRow={handleMoveWithinRow}
          onCreatureAreaResize={setCreatureAreaContainerWidthPx}
          collapsingIds={collapsingIds}
          onEquipmentAction={(action) => {
            if (action.type === 'MOVE_TO') {
              setGameState((prev: GameState) => {
                try {
                  const allBf = getAllBattlefieldCards(prev)
                  const parent = allBf.find(rc => rc.attachments.some(a => a.instanceId === action.equipmentId))
                  if (!parent) return prev
                  const state = detachEquipment(prev, action.equipmentId, parent.instanceId)
                  return moveCard(state, action.equipmentId, 'battlefield', action.destination)
                } catch { return prev }
              })
            } else if (action.type === 'EQUIP_TO') {
              setGameState((prev: GameState) => {
                try {
                  const allBf = getAllBattlefieldCards(prev)
                  const parent = allBf.find(rc => rc.attachments.some(a => a.instanceId === action.equipmentId))
                  if (!parent) return prev
                  return detachEquipment(prev, action.equipmentId, parent.instanceId)
                } catch { return prev }
              })
            }
          }}
          mutateTargeting={mutateTargeting}
          onMutateTargetSelect={handleMutateTargetClick}
          selectedCardIds={selectedCardIds}
          onSelectionToggle={onSelectionToggle}
          onClearSelection={onClearSelection}
          onSetSelection={onSetSelection}
          onBatchAction={onBatchAction}
          onTapSelected={onTapSelected}
        >
          {/* Equip mode indicator */}
          {equipModeCardId && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-yellow-600 text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
              Click a creature to equip — Esc to cancel
            </div>
          )}
          {/* Mutate targeting mode indicator */}
          {mutateTargeting.isActive && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
              Select a mutate target — Esc to cancel
            </div>
          )}

          {/* HD Zoom Portal — large card preview, right side of Zone A */}
          {hoveredCardData.card && !hoveredCardData.isFaceDown && hoveredCardData.zone !== 'library' && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] pointer-events-none transition-opacity duration-200">
              <div
                className="bg-black rounded-lg overflow-hidden"
                style={{ height: '33vh', aspectRatio: '488 / 680' }}
              >
                <img
                  src={hoveredCardData.card.imageURILarge || hoveredCardData.card.imageURI}
                  alt={hoveredCardData.card.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            </div>
          )}
        </Battlefield>
        <PublicStack
          libraryCount={gameState.library.length}
          commandZone={gameState.commandZone}
          graveyard={gameState.graveyard}
          exile={gameState.exile}
          library={gameState.library}
          deliriumCount={calculateDelirium(gameState.graveyard)}
          onDropToZone={() => {}}
          onDrawCard={handleDraw}
          onShuffle={() => setGameState((prev: GameState) => {
            const shuffled = [...prev.library]
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            return { ...prev, library: shuffled }
          })}
          onBrowseLibrary={() => setShowLibraryBrowser(true)}
          onBrowseGraveyard={() => setShowGraveyardBrowser(true)}
        />
        <HandTray
          cards={gameState.hand}
          gamePhase={gameState.gamePhase}
          mulliganState={gameState.mulliganState}
          collapsingIds={collapsingIds}
          onDragStart={() => {}}
          onToggleReveal={(cardId) => {
            setRevealedCardIds(prev => {
              const next = new Set(prev)
              if (next.has(cardId)) next.delete(cardId)
              else next.add(cardId)
              return next
            })
          }}
          onImportDeck={() => setShowImportModal(true)}
          onNewGame={handleSoftResetClick}
          onDraw={handleDraw}
          onOpenTokenPanel={() => setShowTokenPanel(true)}
          deckLoaded={gameState.deckLoaded}
          onMulliganAction={(action) => {
            if (action.type === 'TOGGLE_PUT_BACK') {
              setGameState((prev: GameState) => {
                if (!prev.mulliganState) return prev
                const newSelected = new Set(prev.mulliganState.selectedToPutBack)
                if (newSelected.has(action.cardId)) newSelected.delete(action.cardId)
                else newSelected.add(action.cardId)
                return { ...prev, mulliganState: { ...prev.mulliganState, selectedToPutBack: newSelected } }
              })
            } else if (action.type === 'CONFIRM_KEEP') {
              setGameState((prev: GameState) => {
                if (!prev.mulliganState) return prev
                const { drawnCards, selectedToPutBack } = prev.mulliganState
                const keep = drawnCards.filter(c => !selectedToPutBack.has(c.id))
                const putBack = drawnCards.filter(c => selectedToPutBack.has(c.id))
                return { ...prev, gamePhase: 'PLAYING', hand: [...prev.hand, ...keep], library: [...prev.library, ...putBack], mulliganState: null }
              })
            } else if (action.type === 'MULLIGAN_AGAIN') {
              setGameState((prev: GameState) => {
                if (!prev.mulliganState) return prev
                const libraryWithReturned = [...prev.library, ...prev.mulliganState.drawnCards]
                // Shuffle
                for (let i = libraryWithReturned.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [libraryWithReturned[i], libraryWithReturned[j]] = [libraryWithReturned[j], libraryWithReturned[i]]
                }
                const drawCount = Math.min(7, libraryWithReturned.length)
                const drawnCards = libraryWithReturned.slice(0, drawCount)
                const remaining = libraryWithReturned.slice(drawCount)
                const newCount = prev.mulliganState.mulliganCount + 1
                return { ...prev, library: remaining, mulliganState: { mulliganCount: newCount, drawnCards, selectedToPutBack: new Set(), requiredPutBacks: Math.max(0, newCount - 1) } }
              })
            }
          }}
        />
      </AppShell>

      {/* Deck Import Modal */}
      <DeckImportModal
        isOpen={showImportModal}
        onClose={handleImportClose}
        onImportComplete={handleImportComplete}
      />

      {/* Soft Reset Confirmation */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Game?"
        message="All cards will return to the Library and Command Zone. Tap states and face-down states will be cleared. This cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleSoftResetConfirm}
        onCancel={handleSoftResetCancel}
      />

      {/* Deck Switch Confirmation (only shown when game in progress) */}
      <ConfirmDialog
        isOpen={showDeckSwitchConfirm}
        title="Switch Deck?"
        message="A game is in progress. Switching decks will discard all current cards and replace them with the new deck. This cannot be undone."
        confirmLabel="Switch Deck"
        cancelLabel="Cancel"
        onConfirm={handleDeckSwitchConfirm}
        onCancel={handleDeckSwitchCancel}
      />

      {/* Mutate Placement Dialog — Place on top or bottom */}
      {mutatePlacement.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Mutate placement choice"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleMutatePlacementCancel}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-xs mx-4 bg-gray-900 border border-indigo-500 rounded-xl shadow-2xl p-5 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-gray-100 text-center">Mutate Placement</h2>
            <p className="text-sm text-gray-300 text-center">How should the card be placed?</p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                onClick={() => handleMutatePlacementChoice('over')}
              >
                Place on top
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                onClick={() => handleMutatePlacementChoice('under')}
              >
                Place on bottom
              </button>
            </div>
            <button
              type="button"
              className="mt-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors focus:outline-none"
              onClick={handleMutatePlacementCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Commander Zone Prompt — shown when mutated creature with commanders moves to graveyard/exile */}
      <CommanderZonePrompt
        prompt={commanderPrompt}
        onComplete={handleCommanderPromptComplete}
        onCancel={handleCommanderPromptCancel}
      />

      {/* Context Menu — right-click on any card */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        cardId={contextMenu.cardId}
        cardZone={contextMenu.cardZone}
        cardType={contextMenu.cardType}
        isEquipment={contextMenu.isEquipment}
        isDocked={contextMenu.isDocked}
        isDFC={contextMenu.isDFC}
        hasMutateKeyword={contextMenu.hasMutateKeyword}
        hasMutateStack={contextMenu.hasMutateStack}
        counters={contextMenu.cardZone === 'battlefield' ? (findCardOnBattlefield(gameState, contextMenu.cardId)?.card.counters ?? []) : []}
        onAction={handleContextMenuAction}
        onClose={handleContextMenuClose}
      />

      {/* Peek Mode Selector — Alt+1-9 opens this first */}
      <PeekModeSelector
        count={peekCount}
        isOpen={showPeekModeSelector}
        onSelectMode={(mode: PeekMode) => {
          setShowPeekModeSelector(false)
          const cards = gameState.library.slice(0, peekCount)
          setPeekCards(cards)
          setPeekMode(mode)
          setShowPeekModal(true)
        }}
        onClose={() => setShowPeekModeSelector(false)}
      />

      {/* Peek Modal — interactive scry/surveil/select/peek */}
      <PeekModal
        cards={peekCards}
        mode={peekMode}
        isOpen={showPeekModal}
        onConfirm={(result: PeekResult) => {
          setGameState((prev: GameState) => applyPeekResult(prev, result))
          setShowPeekModal(false)
          setPeekMode('peek')
        }}
        onClose={() => {
          setShowPeekModal(false)
          setPeekMode('peek')
        }}
      />

      {/* Keybind Overlay — ? key shows all shortcuts */}
      <KeybindOverlay
        isOpen={showKeybindOverlay}
        onClose={() => setShowKeybindOverlay(false)}
      />

      {/* Game Log Overlay — L key toggles play history */}
      <GameLogOverlay
        isOpen={showGameLog}
        entries={gameState.gameLog}
        currentTurn={gameState.turnCount}
        onClose={() => setShowGameLog(false)}
      />

      {/* Library Browser — Ctrl+F opens searchable library view */}
      <ZoneBrowser
        zoneName="Library"
        sourceZone="library"
        cards={gameState.library as ZoneBrowserCard[]}
        isOpen={showLibraryBrowser}
        onClose={() => {
          setShowLibraryBrowser(false)
          setGameState((prev: GameState) => shuffleLibrary(prev))
        }}
        onMoveCard={(cardId, destination) => handleZoneBrowserMove(cardId, 'library', destination)}
        destinations={[
          { label: '→ Battlefield', destination: 'battlefield' },
          { label: '→ Battlefield (tapped)', destination: 'battlefield-tapped' },
          { label: '→ Battlefield (face-down)', destination: 'battlefield-facedown' },
          { label: '→ Battlefield (back face)', destination: 'battlefield-backface' },
          { label: '→ Hand', destination: 'hand' },
          { label: '→ Graveyard', destination: 'graveyard' },
          { label: '→ Exile', destination: 'exile' },
        ]}
        ringColor="ring-blue-400"
        footerText="Click a card for move options. Library will be shuffled on close."
      />

      {/* Graveyard Browser — Ctrl+Y opens searchable graveyard view */}
      <ZoneBrowser
        zoneName="Graveyard"
        sourceZone="graveyard"
        cards={gameState.graveyard as ZoneBrowserCard[]}
        isOpen={showGraveyardBrowser}
        onClose={() => setShowGraveyardBrowser(false)}
        onMoveCard={(cardId, destination) => handleZoneBrowserMove(cardId, 'graveyard', destination)}
        destinations={[
          { label: '→ Battlefield', destination: 'battlefield' },
          { label: '→ Battlefield (tapped)', destination: 'battlefield-tapped' },
          { label: '→ Battlefield (face-down)', destination: 'battlefield-facedown' },
          { label: '→ Battlefield (back face)', destination: 'battlefield-backface' },
          { label: '→ Hand', destination: 'hand' },
          { label: '→ Library (top)', destination: 'library' },
          { label: '→ Exile', destination: 'exile' },
        ]}
        ringColor="ring-purple-400"
      />

      {/* Exile Browser — Ctrl+E opens searchable exile view */}
      <ZoneBrowser
        zoneName="Exile"
        sourceZone="exile"
        cards={gameState.exile.map(ec => ({ ...ec.card, isFaceDown: ec.isFaceDown } as ZoneBrowserCard))}
        isOpen={showExileBrowser}
        onClose={() => setShowExileBrowser(false)}
        onMoveCard={(cardId, destination) => handleZoneBrowserMove(cardId, 'exile', destination)}
        destinations={[
          { label: '→ Battlefield', destination: 'battlefield' },
          { label: '→ Battlefield (tapped)', destination: 'battlefield-tapped' },
          { label: '→ Battlefield (face-down)', destination: 'battlefield-facedown' },
          { label: '→ Battlefield (back face)', destination: 'battlefield-backface' },
          { label: '→ Hand', destination: 'hand' },
          { label: '→ Library (top)', destination: 'library' },
          { label: '→ Graveyard', destination: 'graveyard' },
        ]}
        ringColor="ring-orange-400"
      />

      {/* Token Panel — create tokens from deck or search */}
      <TokenPanel
        isOpen={showTokenPanel}
        deckTokens={deckTokens}
        onCreateToken={(tokenDef, quantity) => {
          setGameState((prev: GameState) => createTokens(prev, tokenDef, quantity, getCreatureAreaWidthPx(), window.innerHeight / 100))
        }}
        onClose={() => setShowTokenPanel(false)}
      />
    </>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

/** Renders the card image in the DragOverlay (follows cursor during drag).
 *  - pointer-events-none prevents the overlay from interfering with drop detection
 *  - will-change:transform promotes to GPU layer for smooth 60fps tracking
 *  - The image renders continuously regardless of which zone the cursor is over
 *
 *  Enhanced rendering:
 *  - Battlefield creature with attachments → renders full CreatureOuterDiv
 *  - Attached equipment → renders just the equipment card image
 *  - All other cards → simple card image
 */
function DragOverlayCard({ cardId, gameState }: { cardId: string; gameState: GameState }) {
  // Find the card in any zone
  const handCard = gameState.hand.find(c => c.id === cardId)
  if (handCard) {
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={handCard.imageURI} alt={handCard.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  // Search battlefield (creatureArea rows + row3 + row4)
  const allBattlefieldCards = getAllBattlefieldCards(gameState)

  // Check if dragged card is attached equipment → render just equipment image
  if (isAttachedEquipment(cardId, gameState)) {
    for (const rc of allBattlefieldCards) {
      const att = rc.attachments.find(a => a.instanceId === cardId)
      if (att) {
        return (
          <div className="pointer-events-none" style={{ willChange: 'transform' }}>
            <img src={att.card.imageURI} alt={att.card.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
          </div>
        )
      }
    }
  }

  // Check if dragged card is a battlefield creature with attachments → render CreatureOuterDiv
  const bfCard = allBattlefieldCards.find(rc => rc.card.id === cardId)
  if (bfCard) {
    if (bfCard.attachments.length > 0) {
      return (
        <div className="pointer-events-none" style={{ willChange: 'transform' }}>
          <RotationDiv
            creature={bfCard}
            isCompressed={false}
            onTapCard={() => {}}
          />
        </div>
      )
    }
    const src = bfCard.isFaceDown
      ? CARD_BACK_URL
      : bfCard.showingBackFace && bfCard.card.backFaceImageURI
        ? bfCard.card.backFaceImageURI
        : bfCard.card.imageURI
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={src} alt={bfCard.card.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  const cmdCard = gameState.commandZone.find(c => c.id === cardId)
  if (cmdCard) {
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={cmdCard.imageURI} alt={cmdCard.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  const gyCard = gameState.graveyard.find(c => c.id === cardId)
  if (gyCard) {
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={gyCard.imageURI} alt={gyCard.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  const libCard = gameState.library.find(c => c.id === cardId)
  if (libCard) {
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={libCard.imageURI} alt={libCard.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  const exCard = gameState.exile.find(ec => ec.card.id === cardId)
  if (exCard) {
    const src = exCard.isFaceDown
      ? 'https://backs.scryfall.io/large/59/86/5986b558-80a5-4f82-a30e-0740a1552a84.jpg'
      : exCard.card.imageURI
    return (
      <div className="pointer-events-none" style={{ willChange: 'transform' }}>
        <img src={src} alt={exCard.card.name} className="w-[11.43vh] h-[16vh] object-cover rounded-md shadow-2xl" draggable={false} />
      </div>
    )
  }

  return null
}

export default App
