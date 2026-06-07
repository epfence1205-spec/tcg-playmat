import type {
  CardData,
  GameState,
  Zone,
  ExileCard,
  RowCard,
  RowTarget,
  Attachment,
} from './types';
import type { TokenDefinition } from './api/tokenResolver';
import { recalculateCreatureRows, getTargetRowForNewCreature } from './creatureRows';
import { getRowCards, setRowCards } from './sortableHelpers';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Creates a RowCard from CardData with the given row assignment and position.
 */
export function createRowCard(
  card: CardData,
  rowTarget: RowTarget,
  positionIndex: number
): RowCard {
  return {
    card,
    instanceId: card.id,
    rowAssignment: rowTarget,
    positionIndex,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
  };
}

/**
 * Searches all battlefield locations for a card by ID.
 * Returns the RowCard and its location, or null if not found.
 */
export function findCardOnBattlefield(
  state: GameState,
  cardId: string
): { card: RowCard; location: 'creatureArea' | 'row3-left' | 'row3-right' | 'row4-left' | 'row4-right'; rowIndex?: number } | null {
  // Search creature area rows
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    const found = row.elements.find(rc => rc.instanceId === cardId);
    if (found) return { card: found, location: 'creatureArea', rowIndex: i };
    // Also check attachments within creature rows
    for (const rc of row.elements) {
      const attachFound = rc.attachments.find(a => a.instanceId === cardId);
      if (attachFound) {
        // Return the parent card's location — caller can inspect attachments
        return { card: found ?? rc, location: 'creatureArea', rowIndex: i };
      }
    }
  }

  // Search row3
  const r4Left = state.row3.left.find(rc => rc.instanceId === cardId);
  if (r4Left) return { card: r4Left, location: 'row3-left' };
  const r4Right = state.row3.right.find(rc => rc.instanceId === cardId);
  if (r4Right) return { card: r4Right, location: 'row3-right' };

  // Search row3 attachments
  for (const rc of state.row3.left) {
    if (rc.attachments.find(a => a.instanceId === cardId)) {
      return { card: rc, location: 'row3-left' };
    }
  }
  for (const rc of state.row3.right) {
    if (rc.attachments.find(a => a.instanceId === cardId)) {
      return { card: rc, location: 'row3-right' };
    }
  }

  // Search row4
  const r5Left = state.row4.left.find(rc => rc.instanceId === cardId);
  if (r5Left) return { card: r5Left, location: 'row4-left' };
  const r5Right = state.row4.right.find(rc => rc.instanceId === cardId);
  if (r5Right) return { card: r5Right, location: 'row4-right' };

  // Search row4 attachments
  for (const rc of state.row4.left) {
    if (rc.attachments.find(a => a.instanceId === cardId)) {
      return { card: rc, location: 'row4-left' };
    }
  }
  for (const rc of state.row4.right) {
    if (rc.attachments.find(a => a.instanceId === cardId)) {
      return { card: rc, location: 'row4-right' };
    }
  }

  return null;
}

/**
 * Finds which zone a card is currently in by searching all zones.
 * Returns the zone name or null if not found anywhere.
 */
export function findCardZone(state: GameState, cardId: string): Zone | null {
  if (findCardOnBattlefield(state, cardId)) return 'battlefield';
  if (state.hand.some(c => c.id === cardId)) return 'hand';
  if (state.graveyard.some(c => c.id === cardId)) return 'graveyard';
  if (state.commandZone.some(c => c.id === cardId)) return 'commandZone';
  if (state.library.some(c => c.id === cardId)) return 'library';
  if (state.exile.some(ec => ec.card.id === cardId)) return 'exile';
  return null;
}

/**
 * Returns all RowCards from all battlefield zones (creature area, row3, row4),
 * including cards within attachments.
 */
export function getAllBattlefieldCards(state: GameState): RowCard[] {
  const cards: RowCard[] = [];

  // Creature area
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      cards.push(rc);
    }
  }

  // Row 3
  cards.push(...state.row3.left);
  cards.push(...state.row3.right);

  // Row 4
  cards.push(...state.row4.left);
  cards.push(...state.row4.right);

  return cards;
}

/**
 * Collects all CardData from all battlefield RowCards and their attachments.
 */
function collectAllBattlefieldCardData(state: GameState): CardData[] {
  const cards: CardData[] = [];
  const allRowCards = getAllBattlefieldCards(state);
  for (const rc of allRowCards) {
    cards.push(rc.card);
    for (const att of rc.attachments) {
      cards.push(att.card);
    }
  }
  return cards;
}

// ─── Core Game Actions ───────────────────────────────────────────────────────

/**
 * Draws the top card from the library and adds it to the hand.
 *
 * Preconditions: None (gracefully handles empty library)
 *
 * Postconditions:
 * - If library non-empty: top card moved to hand
 * - If library empty: no state change
 * - Total card count unchanged
 */
export function drawCard(state: GameState): GameState {
  if (state.library.length === 0) return state;

  const [topCard, ...remainingLibrary] = state.library;

  return {
    ...state,
    library: remainingLibrary,
    hand: [...state.hand, topCard],
  };
}

/**
 * Shuffles the library using the Fisher-Yates algorithm.
 *
 * Preconditions: state.library is an array
 *
 * Postconditions:
 * - Library contains same cards in randomized order
 * - Library length unchanged
 * - No cards added or removed
 */
export function shuffleLibrary(state: GameState): GameState {
  const shuffled = [...state.library];

  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return { ...state, library: shuffled };
}

/**
 * Removes a card from the specified zone and returns the CardData.
 * For battlefield zones, searches creature rows, row3, row4, and attachment slots.
 * Throws if the card is not found.
 */
export function removeCardFromZone(
  state: GameState,
  zone: Zone,
  cardId: string
): { card: CardData; newState: GameState } {
  if (zone === 'battlefield') {
    return removeCardFromBattlefield(state, cardId);
  }

  if (zone === 'exile') {
    const index = state.exile.findIndex(ec => ec.card.id === cardId);
    if (index === -1) throw new Error(`Card ${cardId} not found in exile`);
    const card = state.exile[index].card;
    const newExile = [...state.exile.slice(0, index), ...state.exile.slice(index + 1)];
    return { card, newState: { ...state, exile: newExile } };
  }

  // hand, graveyard, library, commandZone — all are CardData[]
  const arr = state[zone] as CardData[];
  const index = arr.findIndex(c => c.id === cardId);
  if (index === -1) throw new Error(`Card ${cardId} not found in ${zone}`);
  const card = arr[index];
  const newArr = [...arr.slice(0, index), ...arr.slice(index + 1)];
  return { card, newState: { ...state, [zone]: newArr } };
}

/**
 * Internal helper: removes a card from any battlefield location
 * (creature rows, row3, row4, or attachment slots).
 */
function removeCardFromBattlefield(
  state: GameState,
  cardId: string
): { card: CardData; newState: GameState } {
  // Search creature area rows (special: needs recalculateCreatureRows)
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    const idx = row.elements.findIndex(rc => rc.instanceId === cardId);
    if (idx !== -1) {
      const card = row.elements[idx].card;
      const newElements = [...row.elements.slice(0, idx), ...row.elements.slice(idx + 1)];
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: newElements } : r
      );
      return { card, newState: { ...state, creatureArea: recalculateCreatureRows({ rows: newRows, totalElementCount: 0 }) } };
    }
    // Check attachments
    for (const rc of row.elements) {
      const attIdx = rc.attachments.findIndex(a => a.instanceId === cardId);
      if (attIdx !== -1) {
        const card = rc.attachments[attIdx].card;
        const newAttachments = [...rc.attachments.slice(0, attIdx), ...rc.attachments.slice(attIdx + 1)];
        const newElements = row.elements.map(el =>
          el.instanceId === rc.instanceId ? { ...el, attachments: newAttachments } : el
        );
        const newRows = state.creatureArea.rows.map((r, ri) =>
          ri === i ? { ...r, elements: newElements } : r
        );
        return { card, newState: { ...state, creatureArea: recalculateCreatureRows({ rows: newRows, totalElementCount: 0 }) } };
      }
    }
  }

  // Search split rows (row3-lands, row3-artifacts, row4-lands, row4-enchantments)
  const splitRowIds: RowTarget[] = ['row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments'];
  for (const rowId of splitRowIds) {
    const cards = getRowCards(state, rowId);
    // Check main cards
    const idx = cards.findIndex(rc => rc.instanceId === cardId);
    if (idx !== -1) {
      const card = cards[idx].card;
      const newCards = [...cards.slice(0, idx), ...cards.slice(idx + 1)];
      return { card, newState: setRowCards(state, rowId, newCards) };
    }
    // Check attachments
    for (const rc of cards) {
      const attIdx = rc.attachments.findIndex(a => a.instanceId === cardId);
      if (attIdx !== -1) {
        const card = rc.attachments[attIdx].card;
        const newAttachments = [...rc.attachments.slice(0, attIdx), ...rc.attachments.slice(attIdx + 1)];
        const newCards = cards.map(el =>
          el.instanceId === rc.instanceId ? { ...el, attachments: newAttachments } : el
        );
        return { card, newState: setRowCards(state, rowId, newCards) };
      }
    }
  }

  throw new Error(`Card ${cardId} not found on battlefield`);
}

/**
 * Determines the default RowTarget for a card based on its cardType and oracle text.
 * - creature → creature-1
 * - land (basic/mana-only) → row3-lands
 * - land (utility — has oracle text beyond basic mana) → row4-lands
 * - artifact → row3-artifacts
 * - enchantment → row4-enchantments
 * - planeswalker/battle → pw-battle-column
 * - other (instant/sorcery/other) → creature-1 (fallback)
 */
function getDefaultRowTarget(card: CardData): RowTarget {
  switch (card.cardType) {
    case 'creature':
      return 'creature-1';
    case 'land': {
      // Basic lands go to row3 always
      const isBasic = card.typeLine.toLowerCase().includes('basic');
      if (isBasic) return 'row3-lands';
      
      // Non-basic lands: check if they ONLY produce mana or have other abilities
      // Mana-only: oracle text only contains tap-for-mana abilities
      // Utility: has abilities beyond mana production (ETB effects, activated abilities that aren't mana, grants abilities, etc.)
      const text = (card.oracleText || '').trim();
      if (!text) return 'row3-lands'; // No text = mana-only (like some promo basics)
      
      // Split into abilities (separated by newlines)
      const abilities = text.split('\n').map(a => a.trim()).filter(a => a.length > 0);
      
      // Check if ALL abilities are mana-producing (contain "Add" and "{T}:")
      const allManaOnly = abilities.every(ability => {
        const lower = ability.toLowerCase();
        return lower.includes('add') && (lower.includes('{t}') || lower.includes('tap'));
      });
      
      return allManaOnly ? 'row3-lands' : 'row4-lands';
    }
    case 'artifact':
      return 'row3-artifacts';
    case 'enchantment':
      return 'row4-enchantments';
    case 'planeswalker':
    case 'battle':
      return 'pw-battle-column';
    case 'instant':
    case 'sorcery':
      return 'creature-2';
    default:
      return 'creature-2';
  }
}

/**
 * Adds a card to the battlefield with auto-assignment logic based on cardType.
 * If targetRow is provided, uses that; otherwise auto-assigns based on cardType.
 */
export function addToBattlefield(
  state: GameState,
  card: CardData,
  targetRow?: RowTarget,
  containerWidthPx?: number,
  vhToPx?: number
): GameState {
  let row = targetRow ?? getDefaultRowTarget(card);
  // Smart routing: if no explicit target and card is a creature, check if row 1 is at capacity
  if (!targetRow && card.cardType === 'creature' && containerWidthPx && vhToPx) {
    row = getTargetRowForNewCreature(state.creatureArea, containerWidthPx, vhToPx);
  }
  return addRowCardToTarget(state, card, row);
}

/**
 * Internal helper: adds a RowCard to the specified target row.
 */
function addRowCardToTarget(
  state: GameState,
  card: CardData,
  target: RowTarget
): GameState {
  if (target === 'creature-1' || target === 'creature-2' || target === 'creature-3' || target === 'pw-battle-column') {
    return addToCreatureArea(state, card, target);
  }

  if (target === 'row3-lands') {
    const positionIndex = state.row3.left.length;
    const rowCard = createRowCard(card, target, positionIndex);
    return { ...state, row3: { ...state.row3, left: [...state.row3.left, rowCard] } };
  }

  if (target === 'row3-artifacts') {
    const positionIndex = state.row3.right.length;
    const rowCard = createRowCard(card, target, positionIndex);
    return { ...state, row3: { ...state.row3, right: [...state.row3.right, rowCard] } };
  }

  if (target === 'row4-lands') {
    const positionIndex = state.row4.left.length;
    const rowCard = createRowCard(card, target, positionIndex);
    return { ...state, row4: { ...state.row4, left: [...state.row4.left, rowCard] } };
  }

  if (target === 'row4-enchantments') {
    const positionIndex = state.row4.right.length;
    const rowCard = createRowCard(card, target, positionIndex);
    return { ...state, row4: { ...state.row4, right: [...state.row4.right, rowCard] } };
  }

  // Fallback: add to creature-1
  return addToCreatureArea(state, card, 'creature-1');
}

/**
 * Internal helper: adds a card to the creature area at the specified row target.
 * If the target row doesn't exist yet, creates it.
 * For pw-battle-column, stores in creature-1 (the first creature row).
 * After adding, recalculates creature rows based on element count thresholds.
 */
function addToCreatureArea(
  state: GameState,
  card: CardData,
  target: RowTarget
): GameState {
  const rows = [...state.creatureArea.rows];

  // Determine which row index to use
  let rowIdx: number;
  if (target === 'creature-1') rowIdx = 0;
  else if (target === 'creature-2') rowIdx = 1;
  else if (target === 'creature-3') rowIdx = 2;
  else rowIdx = 0; // pw-battle-column stored in first creature row for now

  // Ensure the row exists
  while (rows.length <= rowIdx) {
    rows.push({ id: `creature-${rows.length + 1}`, elements: [] });
  }

  const positionIndex = rows[rowIdx].elements.length;
  const rowCard = createRowCard(card, target, positionIndex);
  const newElements = [...rows[rowIdx].elements, rowCard];
  const newRows = rows.map((r, i) =>
    i === rowIdx ? { ...r, elements: newElements } : r
  );

  const updatedCreatureArea = recalculateCreatureRows({ rows: newRows, totalElementCount: 0 });

  return {
    ...state,
    creatureArea: updatedCreatureArea,
  };
}

/**
 * Moves a card from one zone to another atomically.
 * For battlefield destinations, uses RowTarget-based placement.
 *
 * Preconditions:
 * - cardId exists in the `from` zone
 * - from !== to (unless moving within battlefield to a different row)
 *
 * Postconditions:
 * - Card removed from `from` zone, added to `to` zone
 * - Total card count across all zones unchanged
 */
export function moveCard(
  state: GameState,
  cardId: string,
  from: Zone,
  to: Zone,
  targetRow?: RowTarget,
  containerWidthPx?: number,
  vhToPx?: number
): GameState {
  if (from === to && to !== 'battlefield') {
    throw new Error(`Cannot move card to the same zone: ${from}`);
  }

  // Special case: battlefield-to-battlefield preserves full RowCard state
  if (from === 'battlefield' && to === 'battlefield') {
    const found = findCardOnBattlefield(state, cardId);
    if (!found) throw new Error(`Card ${cardId} not found on battlefield`);
    const rowCard = found.card;
    const { newState } = removeCardFromZone(state, 'battlefield', cardId);
    // Re-add with preserved attachments, counters, tap state
    const updatedRowCard = { ...rowCard, rowAssignment: targetRow ?? rowCard.rowAssignment };
    const row = targetRow ?? rowCard.rowAssignment;
    if (row === 'creature-1' || row === 'creature-2' || row === 'creature-3' || row === 'pw-battle-column') {
      const rows = [...newState.creatureArea.rows];
      const rowIdx = row === 'pw-battle-column' ? 0 : row === 'creature-1' ? 0 : row === 'creature-2' ? 1 : 2;
      while (rows.length <= rowIdx) rows.push({ id: `creature-${rows.length + 1}`, elements: [] });
      const newElements = [...rows[rowIdx].elements, updatedRowCard];
      const newRows = rows.map((r, i) => i === rowIdx ? { ...r, elements: newElements } : r);
      return { ...newState, creatureArea: recalculateCreatureRows({ rows: newRows, totalElementCount: 0 }) };
    }
    if (row === 'row3-lands') return { ...newState, row3: { ...newState.row3, left: [...newState.row3.left, updatedRowCard] } };
    if (row === 'row3-artifacts') return { ...newState, row3: { ...newState.row3, right: [...newState.row3.right, updatedRowCard] } };
    if (row === 'row4-lands') return { ...newState, row4: { ...newState.row4, left: [...newState.row4.left, updatedRowCard] } };
    if (row === 'row4-enchantments') return { ...newState, row4: { ...newState.row4, right: [...newState.row4.right, updatedRowCard] } };
    // Fallback
    const rows2 = [...newState.creatureArea.rows];
    if (rows2.length === 0) rows2.push({ id: 'creature-1', elements: [] });
    const newElements2 = [...rows2[0].elements, updatedRowCard];
    const newRows2 = rows2.map((r, i) => i === 0 ? { ...r, elements: newElements2 } : r);
    return { ...newState, creatureArea: recalculateCreatureRows({ rows: newRows2, totalElementCount: 0 }) };
  }

  // If moving FROM battlefield and creature has attachments, detach them first
  if (from === 'battlefield') {
    const found = findCardOnBattlefield(state, cardId);
    if (found && found.card.attachments.length > 0) {
      let s = state;
      // Equipment stays on battlefield unattached, auras go to graveyard
      for (const att of found.card.attachments) {
        const isAura = /\baura\b/i.test(att.card.typeLine);
        if (isAura) {
          // Auras go to graveyard when creature leaves
          s = { ...s, graveyard: [...s.graveyard, att.card] };
        } else {
          // Equipment stays on battlefield in its appropriate row
          const attRow: RowTarget = 'row3-artifacts';
          const attRowCard = createRowCard(att.card, attRow, 0);
          s = { ...s, row3: { ...s.row3, right: [...s.row3.right, attRowCard] } };
        }
      }
      // Clear attachments on the creature
      const clearAtt = (cards: RowCard[]) =>
        cards.map(rc => rc.instanceId === cardId ? { ...rc, attachments: [] } : rc);
      for (let i = 0; i < s.creatureArea.rows.length; i++) {
        if (s.creatureArea.rows[i].elements.some(rc => rc.instanceId === cardId)) {
          const newRows = s.creatureArea.rows.map((r, ri) =>
            ri === i ? { ...r, elements: clearAtt(r.elements) } : r);
          s = { ...s, creatureArea: { ...s.creatureArea, rows: newRows } };
          break;
        }
      }
      if (s.row3.left.some(rc => rc.instanceId === cardId))
        s = { ...s, row3: { ...s.row3, left: clearAtt(s.row3.left) } };
      if (s.row3.right.some(rc => rc.instanceId === cardId))
        s = { ...s, row3: { ...s.row3, right: clearAtt(s.row3.right) } };
      if (s.row4.left.some(rc => rc.instanceId === cardId))
        s = { ...s, row4: { ...s.row4, left: clearAtt(s.row4.left) } };
      if (s.row4.right.some(rc => rc.instanceId === cardId))
        s = { ...s, row4: { ...s.row4, right: clearAtt(s.row4.right) } };
      state = s;
    }
  }

  // Step 1: Remove card from source zone
  const { card, newState } = removeCardFromZone(state, from, cardId);

  // Token ephemerality: tokens cease to exist when leaving the battlefield
  if (card.isToken && to !== 'battlefield') {
    return newState;
  }

  // Step 2: Add card to destination zone
  if (to === 'battlefield') {
    return addToBattlefield(newState, card, targetRow, containerWidthPx, vhToPx);
  }

  if (to === 'exile') {
    const exileCard: ExileCard = { card, isFaceDown: false };
    return { ...newState, exile: [...newState.exile, exileCard] };
  }

  // For hand, graveyard, commandZone — just append the CardData
  if (to === 'library') {
    // Default: put on top of library (index 0 = top, drawn first)
    return { ...newState, library: [card, ...newState.library] };
  }

  return { ...newState, [to]: [...(newState[to] as CardData[]), card] };
}

/**
 * Finds a RowCard on the battlefield by instanceId and applies an updater function.
 * Searches creature area rows, row3, and row4.
 * Returns unchanged state if card not found.
 */
export function updateBattlefieldCard(
  state: GameState,
  cardId: string,
  updater: (card: RowCard) => RowCard
): GameState {
  // Search creature area rows
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    if (row.elements.some(rc => rc.instanceId === cardId)) {
      const newElements = row.elements.map(rc =>
        rc.instanceId === cardId ? updater(rc) : rc
      );
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: newElements } : r
      );
      return { ...state, creatureArea: { ...state.creatureArea, rows: newRows } };
    }
  }

  // Search split rows
  const splitRowIds: RowTarget[] = ['row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments'];
  for (const rowId of splitRowIds) {
    const cards = getRowCards(state, rowId);
    if (cards.some(rc => rc.instanceId === cardId)) {
      const newCards = cards.map(rc => rc.instanceId === cardId ? updater(rc) : rc);
      return setRowCards(state, rowId, newCards);
    }
  }

  return state;
}

/**
 * Toggles the tapped state of a card on the battlefield.
 * Searches all battlefield locations (creature rows, row3, row4).
 *
 * Preconditions:
 * - cardId exists on the battlefield
 *
 * Postconditions:
 * - card.isTapped toggled (true ↔ false)
 * - Tapped card renders rotated 90° clockwise
 */
export function tapCard(state: GameState, cardId: string): GameState {
  const result = updateBattlefieldCard(state, cardId, rc => ({ ...rc, isTapped: !rc.isTapped }));
  if (result === state) throw new Error(`Card ${cardId} not found on battlefield`);
  return result;
}

/**
 * Untaps ALL battlefield cards (creature rows, row3, row4) including their attachments.
 * Sets isTapped = false on every RowCard and every Attachment.
 *
 * Postconditions:
 * - No card on the battlefield has isTapped === true
 */
export function untapAll(state: GameState): GameState {
  const untapAttachments = (attachments: Attachment[]): Attachment[] =>
    attachments.map(a => ({ ...a, isTapped: false }));

  const untapRowCards = (cards: RowCard[]): RowCard[] =>
    cards.map(rc => ({
      ...rc,
      isTapped: false,
      attachments: untapAttachments(rc.attachments),
    }));

  const newCreatureRows = state.creatureArea.rows.map(row => ({
    ...row,
    elements: untapRowCards(row.elements),
  }));

  return {
    ...state,
    creatureArea: { ...state.creatureArea, rows: newCreatureRows },
    row3: {
      left: untapRowCards(state.row3.left),
      right: untapRowCards(state.row3.right),
    },
    row4: {
      left: untapRowCards(state.row4.left),
      right: untapRowCards(state.row4.right),
    },
  };
}

/**
 * Toggles the face-down state of a card on the battlefield or in exile.
 *
 * Preconditions:
 * - cardId exists in the specified zone
 * - Zone is 'battlefield' or 'exile'
 *
 * Postconditions:
 * - card.isFaceDown toggled
 * - Face-down card displays generic card back
 * - Face-up card displays imageURI
 */
export function flipCard(state: GameState, cardId: string, zone: Zone): GameState {
  if (zone === 'battlefield') {
    return toggleBattlefieldProperty(state, cardId, 'isFaceDown');
  }

  if (zone === 'exile') {
    const index = state.exile.findIndex(ec => ec.card.id === cardId);
    if (index === -1) throw new Error(`Card ${cardId} not found in exile`);

    return {
      ...state,
      exile: state.exile.map(ec =>
        ec.card.id === cardId ? { ...ec, isFaceDown: !ec.isFaceDown } : ec
      ),
    };
  }

  // For other zones, flip is a no-op
  return state;
}

/**
 * Toggles the DFC transform state of a card on the battlefield.
 * Switches between front face (imageURI) and back face (backFaceImageURI).
 *
 * Preconditions:
 * - cardId exists on the battlefield
 * - card.backFaceImageURI is non-null (card is a DFC)
 *
 * Postconditions:
 * - showingBackFace toggled
 * - Displayed image switches between imageURI and backFaceImageURI
 * - No-op if card is not a DFC (backFaceImageURI is null)
 */
export function transformDFC(state: GameState, cardId: string): GameState {
  // Find the card first to check if it's a DFC
  const found = findCardOnBattlefield(state, cardId);
  if (!found) throw new Error(`Card ${cardId} not found on battlefield`);
  if (!found.card.card.backFaceImageURI) return state;

  const rowCard = found.card;
  const willShowBack = !rowCard.showingBackFace;

  // Determine the new cardType based on which face will be showing
  const frontType = rowCard.card.cardType;
  const backType = rowCard.card.backFaceCardType ?? frontType;
  const newCardType = willShowBack ? backType : frontType;

  // Toggle showingBackFace and update cardType
  const updateCard = (cards: RowCard[]): RowCard[] =>
    cards.map(rc => rc.instanceId === cardId
      ? { ...rc, showingBackFace: willShowBack, card: { ...rc.card, cardType: newCardType } }
      : rc
    );

  // Apply the update to wherever the card is
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    if (state.creatureArea.rows[i].elements.some(rc => rc.instanceId === cardId)) {
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: updateCard(r.elements) } : r
      );
      const newState = { ...state, creatureArea: { ...state.creatureArea, rows: newRows } };
      // Move to correct row if cardType changed
      if (newCardType !== frontType || willShowBack !== rowCard.showingBackFace) {
        return moveCard(newState, cardId, 'battlefield', 'battlefield');
      }
      return newState;
    }
  }
  if (state.row3.left.some(rc => rc.instanceId === cardId)) {
    const newState = { ...state, row3: { ...state.row3, left: updateCard(state.row3.left) } };
    return moveCard(newState, cardId, 'battlefield', 'battlefield');
  }
  if (state.row3.right.some(rc => rc.instanceId === cardId)) {
    const newState = { ...state, row3: { ...state.row3, right: updateCard(state.row3.right) } };
    return moveCard(newState, cardId, 'battlefield', 'battlefield');
  }
  if (state.row4.left.some(rc => rc.instanceId === cardId)) {
    const newState = { ...state, row4: { ...state.row4, left: updateCard(state.row4.left) } };
    return moveCard(newState, cardId, 'battlefield', 'battlefield');
  }
  if (state.row4.right.some(rc => rc.instanceId === cardId)) {
    const newState = { ...state, row4: { ...state.row4, right: updateCard(state.row4.right) } };
    return moveCard(newState, cardId, 'battlefield', 'battlefield');
  }

  return state;
}

/**
 * Internal helper: toggles a boolean property on a RowCard found anywhere on the battlefield.
 */
function toggleBattlefieldProperty(
  state: GameState,
  cardId: string,
  property: 'isFaceDown' | 'showingBackFace' | 'isPhased'
): GameState {
  const toggleInCards = (cards: RowCard[]): { cards: RowCard[]; found: boolean } => {
    let found = false;
    const newCards = cards.map(rc => {
      if (rc.instanceId === cardId) {
        found = true;
        return { ...rc, [property]: !rc[property] };
      }
      return rc;
    });
    return { cards: newCards, found };
  };

  // Search creature area
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const result = toggleInCards(state.creatureArea.rows[i].elements);
    if (result.found) {
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: result.cards } : r
      );
      return { ...state, creatureArea: { ...state.creatureArea, rows: newRows } };
    }
  }

  // Search row3 left
  const r4l = toggleInCards(state.row3.left);
  if (r4l.found) return { ...state, row3: { ...state.row3, left: r4l.cards } };
  // Search row3 right
  const r4r = toggleInCards(state.row3.right);
  if (r4r.found) return { ...state, row3: { ...state.row3, right: r4r.cards } };
  // Search row4 left
  const r5l = toggleInCards(state.row4.left);
  if (r5l.found) return { ...state, row4: { ...state.row4, left: r5l.cards } };
  // Search row4 right
  const r5r = toggleInCards(state.row4.right);
  if (r5r.found) return { ...state, row4: { ...state.row4, right: r5r.cards } };

  throw new Error(`Card ${cardId} not found on battlefield`);
}

/**
 * Performs a soft reset: collects ALL cards from all zones, separates commanders
 * from mainboard, and returns them to Library/Command Zone respectively.
 * Sets gamePhase to MULLIGAN.
 *
 * Preconditions:
 * - state.deckLoaded === true (a deck has been imported)
 *
 * Postconditions:
 * - Commanders in Command Zone, all other cards in Library
 * - Hand, Battlefield (creatureArea, row3, row4), Graveyard, Exile are empty
 * - All tap/face-down/counter states cleared
 * - No page refresh occurred
 * - Total card count unchanged
 * - gamePhase set to MULLIGAN
 */
export function softReset(state: GameState): GameState {
  // Collect ALL cards from all zones (including mulligan drawn cards)
  // Filter out tokens — they cease to exist on reset
  const allCards: CardData[] = [
    ...state.hand,
    ...collectAllBattlefieldCardData(state),
    ...state.commandZone,
    ...state.graveyard,
    ...state.library,
    ...state.exile.map(ec => ec.card),
    ...(state.mulliganState?.drawnCards ?? []),
  ].filter(c => !c.isToken);

  // Separate commanders from mainboard
  const commanders = allCards.filter(c => c.isCommander);
  const mainboard = allCards.filter(c => !c.isCommander);

  return {
    gamePhase: 'MULLIGAN',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: commanders,
    graveyard: [],
    library: mainboard,
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: state.lifeTotal,
  };
}

/**
 * Determines if a game is "in progress" — meaning cards exist outside
 * Library and Command Zone (i.e., the player has started playing).
 * Returns true if any zone (hand, battlefield, graveyard, exile) has cards.
 */
export function isGameInProgress(state: GameState): boolean {
  if (state.hand.length > 0) return true;
  if (state.graveyard.length > 0) return true;
  if (state.exile.length > 0) return true;

  // Check battlefield zones
  for (const row of state.creatureArea.rows) {
    if (row.elements.length > 0) return true;
  }
  if (state.row3.left.length > 0 || state.row3.right.length > 0) return true;
  if (state.row4.left.length > 0 || state.row4.right.length > 0) return true;

  return false;
}

// ─── Token Creation ──────────────────────────────────────────────────────────

/**
 * Creates one or more tokens on the battlefield from a TokenDefinition.
 * Each token gets a unique UUID and is placed in the correct row based on cardType.
 *
 * Preconditions:
 * - quantity is between 1 and 10 (inclusive)
 * - tokenDef contains valid token data
 *
 * Postconditions:
 * - Exactly `quantity` new CardData objects added to the battlefield
 * - Each has isToken=true, isTokenCopy=false, unique id
 * - Placed in correct row based on cardType
 * - If quantity <= 0 or > 10, returns state unchanged
 */
export function createTokens(
  state: GameState,
  tokenDef: TokenDefinition,
  quantity: number
): GameState {
  if (quantity <= 0 || quantity > 10) return state;

  let currentState = state;
  for (let i = 0; i < quantity; i++) {
    const tokenCard: CardData = {
      id: crypto.randomUUID(),
      name: tokenDef.name,
      setCode: tokenDef.setCode,
      collectorNumber: tokenDef.collectorNumber,
      imageURI: tokenDef.imageURI,
      imageURILarge: tokenDef.imageURILarge,
      backFaceImageURI: null,
      backFaceCardType: null,
      typeLine: tokenDef.typeLine,
      oracleText: tokenDef.oracleText,
      isCommander: false,
      basePower: tokenDef.power,
      baseToughness: tokenDef.toughness,
      cardType: tokenDef.cardType,
      keywords: tokenDef.keywords,
      cmc: 0,
      manaCost: '',
      colorIdentity: [],
      producedMana: [],
      isToken: true,
      isTokenCopy: false,
    };
    currentState = addToBattlefield(currentState, tokenCard);
  }
  return currentState;
}
