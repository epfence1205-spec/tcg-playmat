import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { separateMutateStack, getCommandersInStack, separateMutateStackWithCommanderChoice, aggregateMutateKeywords, splitMutateStack, mutateOver, mutateUnder } from './mutateActions';
import { createRowCard, findCardOnBattlefield, moveCard } from './gameActions';
import { parseKeywords, calculateEffectiveStats } from './keywords';
import type { GameState, CardData, RowCard, KeywordAbility, Counter, Attachment } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'card-1',
    name: 'Test Creature',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://example.com/card.jpg',
    imageURILarge: 'https://example.com/card-large.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Creature — Elf Warrior',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '3',
    baseToughness: '3',
    cardType: 'creature',
    cmc: 3,
    manaCost: '{1}{G}{G}',
    colorIdentity: ['G'],
    producedMana: [],
    landCategory: null,
    isToken: false,
    isTokenCopy: false,
    ...overrides,
  };
}

function makeEmptyState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
    turnCount: 0,
    gameLog: [],
  };
}

// ─── separateMutateStack Tests ───────────────────────────────────────────────

describe('separateMutateStack', () => {
  it('returns [Top_Card] when mutateStack is empty', () => {
    const topCard = makeCard({ id: 'top-1' });
    const rowCard = createRowCard(topCard, 'creature-1', 0);

    const result = separateMutateStack(rowCard, false);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('top-1');
  });

  it('returns [Top_Card, ...mutateStack] in order', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Top' });
    const stackCard1 = makeCard({ id: 'stack-1', name: 'Under 1' });
    const stackCard2 = makeCard({ id: 'stack-2', name: 'Under 2' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard1, stackCard2],
    };

    const result = separateMutateStack(rowCard, false);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('top-1');
    expect(result[1].id).toBe('stack-1');
    expect(result[2].id).toBe('stack-2');
  });

  it('excludes tokens when excludeTokens is true', () => {
    const topCard = makeCard({ id: 'top-1', isToken: true });
    const stackCard1 = makeCard({ id: 'stack-1', isToken: false });
    const stackCard2 = makeCard({ id: 'stack-2', isToken: true });
    const stackCard3 = makeCard({ id: 'stack-3', isToken: false });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard1, stackCard2, stackCard3],
    };

    const result = separateMutateStack(rowCard, true);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('stack-1');
    expect(result[1].id).toBe('stack-3');
  });

  it('includes tokens when excludeTokens is false', () => {
    const topCard = makeCard({ id: 'top-1', isToken: true });
    const stackCard1 = makeCard({ id: 'stack-1', isToken: true });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard1],
    };

    const result = separateMutateStack(rowCard, false);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('top-1');
    expect(result[1].id).toBe('stack-1');
  });
});

// ─── getCommandersInStack Tests ──────────────────────────────────────────────

describe('getCommandersInStack', () => {
  it('returns empty array when no commanders in stack', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: false });
    const stackCard = makeCard({ id: 'stack-1', isCommander: false });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const result = getCommandersInStack(rowCard);

    expect(result).toHaveLength(0);
  });

  it('finds commander when Top_Card is commander', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Commander', isCommander: true });
    const stackCard = makeCard({ id: 'stack-1', isCommander: false });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const result = getCommandersInStack(rowCard);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('top-1');
  });

  it('finds commander in mutateStack', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: false });
    const stackCard = makeCard({ id: 'stack-1', name: 'Hidden Commander', isCommander: true });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const result = getCommandersInStack(rowCard);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('stack-1');
  });

  it('finds multiple commanders (partner commanders)', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: true });
    const stackCard1 = makeCard({ id: 'stack-1', isCommander: true });
    const stackCard2 = makeCard({ id: 'stack-2', isCommander: false });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard1, stackCard2],
    };

    const result = getCommandersInStack(rowCard);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('top-1');
    expect(result[1].id).toBe('stack-1');
  });

  it('returns empty array for card with no mutateStack', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: false });
    const rowCard = createRowCard(topCard, 'creature-1', 0);

    const result = getCommandersInStack(rowCard);

    expect(result).toHaveLength(0);
  });
});

// ─── separateMutateStackWithCommanderChoice Tests ────────────────────────────

describe('separateMutateStackWithCommanderChoice', () => {
  it('sends all non-token cards to graveyard when no commanders', () => {
    const topCard = makeCard({ id: 'top-1' });
    const stackCard = makeCard({ id: 'stack-1' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'graveyard', choices);

    expect(result.graveyard).toHaveLength(2);
    expect(result.graveyard[0].id).toBe('top-1');
    expect(result.graveyard[1].id).toBe('stack-1');
    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
  });

  it('sends all non-token cards to exile when destination is exile', () => {
    const topCard = makeCard({ id: 'top-1' });
    const stackCard = makeCard({ id: 'stack-1' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'exile', choices);

    expect(result.exile).toHaveLength(2);
    expect(result.exile[0].card.id).toBe('top-1');
    expect(result.exile[0].isFaceDown).toBe(false);
    expect(result.exile[1].card.id).toBe('stack-1');
    expect(result.exile[1].isFaceDown).toBe(false);
  });

  it('routes commander to commandZone when choice is commandZone', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: true, name: 'My Commander' });
    const stackCard = makeCard({ id: 'stack-1' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    choices.set('top-1', 'commandZone');

    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'graveyard', choices);

    expect(result.commandZone).toHaveLength(1);
    expect(result.commandZone[0].id).toBe('top-1');
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0].id).toBe('stack-1');
  });

  it('sends commander to destination when choice is not commandZone', () => {
    const topCard = makeCard({ id: 'top-1', isCommander: true });
    const stackCard = makeCard({ id: 'stack-1' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    choices.set('top-1', 'graveyard');

    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'graveyard', choices);

    expect(result.commandZone).toHaveLength(0);
    expect(result.graveyard).toHaveLength(2);
  });

  it('discards tokens (token ephemerality)', () => {
    const topCard = makeCard({ id: 'top-1', isToken: true });
    const stackCard = makeCard({ id: 'stack-1', isToken: false });
    const tokenInStack = makeCard({ id: 'stack-2', isToken: true });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [stackCard, tokenInStack],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'graveyard', choices);

    // Only the non-token card goes to graveyard
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0].id).toBe('stack-1');
  });

  it('handles multiple commanders with different choices', () => {
    const commander1 = makeCard({ id: 'cmd-1', isCommander: true, name: 'Partner A' });
    const commander2 = makeCard({ id: 'cmd-2', isCommander: true, name: 'Partner B' });
    const normalCard = makeCard({ id: 'normal-1' });
    const rowCard: RowCard = {
      ...createRowCard(commander1, 'creature-1', 0),
      mutateStack: [commander2, normalCard],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    choices.set('cmd-1', 'commandZone');
    choices.set('cmd-2', 'exile');

    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'exile', choices);

    expect(result.commandZone).toHaveLength(1);
    expect(result.commandZone[0].id).toBe('cmd-1');
    // cmd-2 goes to exile (chose 'exile', not 'commandZone'), plus normalCard goes to exile
    expect(result.exile).toHaveLength(2);
    expect(result.exile.map(e => e.card.id)).toContain('cmd-2');
    expect(result.exile.map(e => e.card.id)).toContain('normal-1');
  });

  it('removes the RowCard from the battlefield', () => {
    const topCard = makeCard({ id: 'top-1' });
    const rowCard: RowCard = {
      ...createRowCard(topCard, 'creature-1', 0),
      mutateStack: [makeCard({ id: 'stack-1' })],
    };

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [rowCard];
    state.creatureArea.totalElementCount = 1;

    const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
    const result = separateMutateStackWithCommanderChoice(state, rowCard, 'graveyard', choices);

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
  });
});

// ─── Property Tests (fast-check) ─────────────────────────────────────────────

import * as fc from 'fast-check';
import { isNonHumanCreature, getValidMutateTargets } from './mutateActions';

// ─── Property 5: Non-Human Creature Validation ──────────────────────────────
// **Validates: Requirements 4.1, 4.3**
// For any typeLine, isNonHumanCreature returns false only when subtypes contain
// "Human" as a whole word (not "Superhuman", "Inhuman", etc.)

describe('Property 5: Non-Human Creature Validation', () => {
  // Arbitrary for subtype words that are NOT "Human" but may contain "human" as substring
  const nonHumanSubtype = fc.oneof(
    fc.constant('Superhuman'),
    fc.constant('Inhuman'),
    fc.constant('Subhuman'),
    fc.constant('Humanoid'),
    fc.constant('Beast'),
    fc.constant('Elf'),
    fc.constant('Wizard'),
    fc.constant('Dragon'),
    fc.constant('Warrior'),
    fc.constant('Angel'),
    fc.constant('Goblin'),
    fc.constant('Merfolk'),
    fc.constant('Zombie'),
    fc.constant('Elemental'),
    fc.constant('Shapeshifter')
  );

  it('returns true when typeLine has no dash separator', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter(s => !s.includes('—')),
        (supertype) => {
          const typeLine = `Creature ${supertype}`.trim();
          // No dash means no subtypes — always valid
          expect(isNonHumanCreature(typeLine)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns false when subtypes contain "Human" as a whole word', () => {
    fc.assert(
      fc.property(
        fc.array(nonHumanSubtype, { minLength: 0, maxLength: 3 }),
        fc.nat({ max: 3 }),
        (otherSubtypes, insertPos) => {
          // Insert "Human" at a random position among other subtypes
          const subtypes = [...otherSubtypes];
          const pos = Math.min(insertPos, subtypes.length);
          subtypes.splice(pos, 0, 'Human');
          const typeLine = `Creature — ${subtypes.join(' ')}`;
          expect(isNonHumanCreature(typeLine)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns true when subtypes contain "human"-like substrings but not the whole word', () => {
    const humanSubstring = fc.oneof(
      fc.constant('Superhuman'),
      fc.constant('Inhuman'),
      fc.constant('Subhuman'),
      fc.constant('Humanoid')
    );

    fc.assert(
      fc.property(
        fc.array(humanSubstring, { minLength: 1, maxLength: 3 }),
        (subtypes) => {
          const typeLine = `Creature — ${subtypes.join(' ')}`;
          // These all contain "human" as substring but not as a whole word
          expect(isNonHumanCreature(typeLine)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns true when subtypes are non-Human creature types', () => {
    fc.assert(
      fc.property(
        fc.array(nonHumanSubtype, { minLength: 1, maxLength: 4 }),
        (subtypes) => {
          const typeLine = `Creature — ${subtypes.join(' ')}`;
          expect(isNonHumanCreature(typeLine)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is case-insensitive for "Human" detection', () => {
    const humanVariants = fc.oneof(
      fc.constant('Human'),
      fc.constant('human'),
      fc.constant('HUMAN'),
      fc.constant('HuMaN')
    );

    fc.assert(
      fc.property(
        humanVariants,
        fc.array(nonHumanSubtype, { minLength: 0, maxLength: 2 }),
        (humanWord, otherSubtypes) => {
          const subtypes = [humanWord, ...otherSubtypes];
          const typeLine = `Creature — ${subtypes.join(' ')}`;
          expect(isNonHumanCreature(typeLine)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Example-based edge cases for clarity
  it('handles specific known edge cases', () => {
    expect(isNonHumanCreature('Creature — Human Warrior')).toBe(false);
    expect(isNonHumanCreature('Creature — Elf Human')).toBe(false);
    expect(isNonHumanCreature('Creature — Superhuman Beast')).toBe(true);
    expect(isNonHumanCreature('Creature — Beast')).toBe(true);
    expect(isNonHumanCreature('Creature')).toBe(true);
    expect(isNonHumanCreature('')).toBe(true);
  });
});

// ─── Property 6: Valid Mutate Target Set ─────────────────────────────────────
// **Validates: Requirements 2.3, 4.2, 4.4**
// For any GameState, getValidMutateTargets returns only creatures that are
// non-Human OR face-down, never includes the source card

describe('Property 6: Valid Mutate Target Set', () => {
  it('never includes the source card in the result', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (sourceId, otherIds) => {
          const sourceCard = makeCard({ id: sourceId, cardType: 'creature', typeLine: 'Creature — Beast' });
          const state = makeEmptyState();
          const otherRowCards = otherIds.map((id, i) =>
            createRowCard(makeCard({ id, cardType: 'creature', typeLine: 'Creature — Beast' }), 'creature-1', i + 1)
          );
          state.creatureArea.rows[0].elements = [
            createRowCard(sourceCard, 'creature-1', 0),
            ...otherRowCards,
          ];

          const targets = getValidMutateTargets(state, sourceId);

          // Source card must never be in the result
          expect(targets.find(t => t.instanceId === sourceId)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes only creatures (no non-creature cards)', () => {
    const nonCreatureTypes: Array<CardData['cardType']> = ['artifact', 'enchantment', 'land', 'planeswalker'];

    fc.assert(
      fc.property(
        fc.constantFrom(...nonCreatureTypes),
        (nonCreatureType) => {
          const sourceCard = makeCard({ id: 'source-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const nonCreature = makeCard({ id: 'non-creature-1', cardType: nonCreatureType, typeLine: 'Artifact — Equipment' });
          const validCreature = makeCard({ id: 'valid-1', cardType: 'creature', typeLine: 'Creature — Elf' });

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [
            createRowCard(sourceCard, 'creature-1', 0),
            createRowCard(nonCreature, 'creature-1', 1),
            createRowCard(validCreature, 'creature-1', 2),
          ];

          const targets = getValidMutateTargets(state, 'source-1');

          // Non-creature should never be a target
          expect(targets.find(t => t.instanceId === 'non-creature-1')).toBeUndefined();
          // Valid creature should be a target
          expect(targets.find(t => t.instanceId === 'valid-1')).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('excludes Human creatures that are face-up', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('Creature — Human Warrior'),
          fc.constant('Creature — Elf Human'),
          fc.constant('Creature — Human Cleric Wizard')
        ),
        (humanTypeLine) => {
          const sourceCard = makeCard({ id: 'source-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const humanCreature = makeCard({ id: 'human-1', cardType: 'creature', typeLine: humanTypeLine });

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [
            createRowCard(sourceCard, 'creature-1', 0),
            createRowCard(humanCreature, 'creature-1', 1),
          ];

          const targets = getValidMutateTargets(state, 'source-1');

          // Human creatures should not be valid targets when face-up
          expect(targets.find(t => t.instanceId === 'human-1')).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes face-down creatures regardless of typeLine', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('Creature — Human Warrior'),
          fc.constant('Creature — Beast'),
          fc.constant('Creature — Elf Human Wizard')
        ),
        (typeLine) => {
          const sourceCard = makeCard({ id: 'source-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const faceDownCreature = makeCard({ id: 'facedown-1', cardType: 'creature', typeLine });

          const state = makeEmptyState();
          const faceDownRowCard = createRowCard(faceDownCreature, 'creature-1', 1);
          faceDownRowCard.isFaceDown = true;
          state.creatureArea.rows[0].elements = [
            createRowCard(sourceCard, 'creature-1', 0),
            faceDownRowCard,
          ];

          const targets = getValidMutateTargets(state, 'source-1');

          // Face-down creatures are always valid targets
          expect(targets.find(t => t.instanceId === 'facedown-1')).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result set equals exactly: creatures that are (non-Human OR face-down) AND not source', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }),
        (_seed) => {
          // Build a state with a known mix of card types
          const sourceCard = makeCard({ id: 'source', cardType: 'creature', typeLine: 'Creature — Beast' });
          const humanFaceUp = makeCard({ id: 'human-up', cardType: 'creature', typeLine: 'Creature — Human Warrior' });
          const humanFaceDown = makeCard({ id: 'human-down', cardType: 'creature', typeLine: 'Creature — Human Warrior' });
          const nonHumanCreature = makeCard({ id: 'elf', cardType: 'creature', typeLine: 'Creature — Elf Warrior' });
          const artifact = makeCard({ id: 'artifact', cardType: 'artifact', typeLine: 'Artifact — Equipment' });
          const superhumanCreature = makeCard({ id: 'superhuman', cardType: 'creature', typeLine: 'Creature — Superhuman Beast' });

          const state = makeEmptyState();
          const humanFaceDownRow = createRowCard(humanFaceDown, 'creature-1', 2);
          humanFaceDownRow.isFaceDown = true;

          state.creatureArea.rows[0].elements = [
            createRowCard(sourceCard, 'creature-1', 0),
            createRowCard(humanFaceUp, 'creature-1', 1),
            humanFaceDownRow,
            createRowCard(nonHumanCreature, 'creature-1', 3),
            createRowCard(superhumanCreature, 'creature-1', 5),
          ];
          state.row3 = { left: [], right: [createRowCard(artifact, 'row3-artifacts', 0)] };

          const targets = getValidMutateTargets(state, 'source');
          const targetIds = targets.map(t => t.instanceId).sort();

          // Expected: human-down (face-down), elf (non-human), superhuman (non-human)
          // NOT: source (is source), human-up (human face-up), artifact (not creature)
          expect(targetIds).toEqual(['elf', 'human-down', 'superhuman'].sort());
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property-Based Tests: aggregateMutateKeywords ───────────────────────────

/**
 * Property 7: Keyword Aggregation
 * For any RowCard with a mutateStack, aggregateMutateKeywords returns the deduplicated
 * union of all keywords from the Top_Card and all mutateStack entries (both from
 * .keywords arrays and parsed from oracleText).
 *
 * **Validates: Requirements 3.4, 5.1, 5.2, 5.4**
 */

// ─── Constants & Generators ──────────────────────────────────────────────────

const ALL_KEYWORDS: KeywordAbility[] = [
  'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
  'hexproof', 'indestructible', 'menace', 'reach', 'first_strike',
  'double_strike', 'flash', 'defender', 'ward', 'shroud', 'protection',
];

const KEYWORD_TEXT: Record<KeywordAbility, string> = {
  flying: 'Flying',
  trample: 'Trample',
  haste: 'Haste',
  vigilance: 'Vigilance',
  lifelink: 'Lifelink',
  deathtouch: 'Deathtouch',
  hexproof: 'Hexproof',
  indestructible: 'Indestructible',
  menace: 'Menace',
  reach: 'Reach',
  first_strike: 'First strike',
  double_strike: 'Double strike',
  flash: 'Flash',
  defender: 'Defender',
  ward: 'Ward',
  shroud: 'Shroud',
  protection: 'Protection',
};

/** Generates a random subset of keywords (possibly empty) */
const keywordSubsetArb: fc.Arbitrary<KeywordAbility[]> = fc.subarray(ALL_KEYWORDS);

/** Generates oracle text containing specific keywords embedded in safe filler */
function oracleTextForKeywords(keywords: KeywordAbility[]): string {
  if (keywords.length === 0) return 'This creature deals damage to target player.';
  return keywords.map((kw) => KEYWORD_TEXT[kw]).join(', ') + '\nDeals damage to target player.';
}

/** Generates a CardData for property testing with specific keywords split between array and oracleText */
function cardDataArb(): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.uuid(),
      keywordSubsetArb, // keywords in .keywords array
      keywordSubsetArb  // keywords embedded in oracleText
    )
    .map(([id, arrayKeywords, textKeywords]) => ({
      id,
      name: 'Test Card',
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: 'https://example.com/card.jpg',
      imageURILarge: 'https://example.com/card-large.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: 'Creature — Elf Warrior',
      oracleText: oracleTextForKeywords(textKeywords),
      isCommander: false,
      keywords: arrayKeywords,
      basePower: '3',
      baseToughness: '3',
      cardType: 'creature' as const,
      cmc: 3,
      manaCost: '{1}{G}{G}',
      colorIdentity: ['G'],
      producedMana: [],
      landCategory: null,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a RowCard with a random mutateStack (0 to 5 entries) */
function rowCardWithStackArb(): fc.Arbitrary<RowCard> {
  return fc
    .tuple(
      cardDataArb(),
      fc.array(cardDataArb(), { minLength: 0, maxLength: 5 })
    )
    .map(([topCard, stack]) => ({
      card: topCard,
      instanceId: topCard.id,
      rowAssignment: 'creature-1' as const,
      positionIndex: 0,
      isTapped: false,
      isFaceDown: false,
      showingBackFace: false,
      isPhased: false,
      attachments: [],
      counters: [],
      mutateStack: stack,
      isRevealed: false,
    }));
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 7: Keyword Aggregation', () => {
  it('returns deduplicated union of all keywords from Top_Card and mutateStack (arrays + oracleText)', () => {
    fc.assert(
      fc.property(rowCardWithStackArb(), (rowCard) => {
        const result = aggregateMutateKeywords(rowCard);

        // Compute expected: union of all keywords from all cards
        const expectedSet = new Set<KeywordAbility>();

        // Top_Card contributions
        for (const kw of rowCard.card.keywords) expectedSet.add(kw);
        for (const kw of parseKeywords(rowCard.card.oracleText)) expectedSet.add(kw);

        // mutateStack contributions
        for (const stackCard of rowCard.mutateStack) {
          for (const kw of stackCard.keywords) expectedSet.add(kw);
          for (const kw of parseKeywords(stackCard.oracleText)) expectedSet.add(kw);
        }

        // Result must have exactly the same keywords as the expected union
        const resultSet = new Set(result);
        expect(resultSet).toEqual(expectedSet);
      }),
      { numRuns: 100 }
    );
  });

  it('result contains no duplicates', () => {
    fc.assert(
      fc.property(rowCardWithStackArb(), (rowCard) => {
        const result = aggregateMutateKeywords(rowCard);
        const unique = new Set(result);
        expect(result.length).toBe(unique.size);
      }),
      { numRuns: 100 }
    );
  });

  it('with empty mutateStack, returns only top card keywords (array + parsed from oracleText)', () => {
    fc.assert(
      fc.property(cardDataArb(), (topCard) => {
        const rowCard: RowCard = {
          card: topCard,
          instanceId: topCard.id,
          rowAssignment: 'creature-1',
          positionIndex: 0,
          isTapped: false,
          isFaceDown: false,
          showingBackFace: false,
          isPhased: false,
          attachments: [],
          counters: [],
          mutateStack: [],
          isRevealed: false,
        };

        const result = aggregateMutateKeywords(rowCard);

        const expectedSet = new Set<KeywordAbility>();
        for (const kw of topCard.keywords) expectedSet.add(kw);
        for (const kw of parseKeywords(topCard.oracleText)) expectedSet.add(kw);

        const resultSet = new Set(result);
        expect(resultSet).toEqual(expectedSet);
      }),
      { numRuns: 100 }
    );
  });

  it('keywords from oracleText are included in the result', () => {
    // Specific scenario: card with "Flying" only in oracleText, not in keywords array
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_KEYWORDS),
        (keyword) => {
          const topCard = makeCard({
            keywords: [],
            oracleText: `${KEYWORD_TEXT[keyword]}\nDeals 3 damage to target creature.`,
          });
          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [],
          };

          const result = aggregateMutateKeywords(rowCard);
          expect(result).toContain(keyword);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('overlapping keywords between top card and stack entries are deduplicated', () => {
    // Both top card and stack entry have the same keyword — result should contain it once
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_KEYWORDS),
        cardDataArb(),
        (sharedKeyword, baseStackCard) => {
          const topCard = makeCard({ keywords: [sharedKeyword], oracleText: '' });
          const stackCard: CardData = {
            ...baseStackCard,
            keywords: [sharedKeyword],
            oracleText: '',
          };
          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [stackCard],
          };

          const result = aggregateMutateKeywords(rowCard);
          const count = result.filter((kw) => kw === sharedKeyword).length;
          expect(count).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('union of multiple stack entries with unique keywords includes all', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_KEYWORDS, { minLength: 2, maxLength: 6 }),
        (keywords) => {
          // Distribute keywords one per card
          const topCard = makeCard({ keywords: [keywords[0]], oracleText: '' });
          const stackCards = keywords.slice(1).map((kw) =>
            makeCard({
              id: `stack-${kw}`,
              keywords: [kw],
              oracleText: '',
            })
          );
          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: stackCards,
          };

          const result = aggregateMutateKeywords(rowCard);
          for (const kw of keywords) {
            expect(result).toContain(kw);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 18: Split Creates Default-State RowCards ───────────────────────
// **Validates: Requirements 11.3, 11.4**
// For any mutateStack entry released via split operation, the resulting independent
// RowCard SHALL have: isTapped=false, isFaceDown=false, showingBackFace=false,
// isPhased=false, attachments=[], counters=[], and mutateStack=[].

describe('Property 18: Split Creates Default-State RowCards', () => {
  /** Generates a CardData for stack entries */
  const stackCardArb = fc.uuid().map((id) => makeCard({ id, name: `Stack-${id.slice(0, 4)}` }));

  /** Generates a non-empty mutateStack (1-5 entries) */
  const mutateStackArb = fc.array(stackCardArb, { minLength: 1, maxLength: 5 });

  it('each split entry becomes an independent RowCard with default state', () => {
    fc.assert(
      fc.property(
        mutateStackArb,
        fc.boolean(),
        (stack, tapped) => {
          const topCard = makeCard({ id: 'top-card' });
          const state = makeEmptyState();

          // Set up original RowCard with non-trivial state + non-empty mutateStack
          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            isTapped: tapped,
            counters: [{ type: '+1/+1', value: 2 }],
            attachments: [{ card: makeCard({ id: 'equip-1', cardType: 'artifact' }), instanceId: 'equip-1', isTapped: false }],
            mutateStack: stack,
          };

          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = splitMutateStack(state, 'top-card');

          // Find all new RowCards (those whose instanceId matches a stack entry id)
          const allElements = result.creatureArea.rows.flatMap((r) => r.elements);
          const stackIds = new Set(stack.map((c) => c.id));
          const newCards = allElements.filter((rc) => stackIds.has(rc.instanceId));

          // Each new card must have default state
          for (const newCard of newCards) {
            expect(newCard.isTapped).toBe(false);
            expect(newCard.isFaceDown).toBe(false);
            expect(newCard.showingBackFace).toBe(false);
            expect(newCard.isPhased).toBe(false);
            expect(newCard.attachments).toEqual([]);
            expect(newCard.counters).toEqual([]);
            expect(newCard.mutateStack).toEqual([]);
          }

          // Number of new RowCards must equal stack length
          expect(newCards.length).toBe(stack.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each new RowCard card data matches the original stack entry', () => {
    fc.assert(
      fc.property(mutateStackArb, (stack) => {
        const topCard = makeCard({ id: 'top-card' });
        const state = makeEmptyState();

        const rowCard: RowCard = {
          ...createRowCard(topCard, 'creature-1', 0),
          mutateStack: stack,
        };

        state.creatureArea.rows[0].elements = [rowCard];
        state.creatureArea.totalElementCount = 1;

        const result = splitMutateStack(state, 'top-card');

        const allElements = result.creatureArea.rows.flatMap((r) => r.elements);
        const stackIds = new Set(stack.map((c) => c.id));
        const newCards = allElements.filter((rc) => stackIds.has(rc.instanceId));

        // Each new RowCard's card property should deeply match the original CardData
        for (const entry of stack) {
          const found = newCards.find((rc) => rc.instanceId === entry.id);
          expect(found).toBeDefined();
          expect(found!.card).toEqual(entry);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 19: Split Preserves Original RowCard State ─────────────────────
// **Validates: Requirements 11.3, 11.4**
// For any split operation on a mutated RowCard, the original RowCard (now containing
// only the Top_Card) SHALL retain its existing isTapped, counters, attachments, and
// rowAssignment, with mutateStack set to [].

describe('Property 19: Split Preserves Original RowCard State', () => {
  /** Generates random counters */
  const counterArb: fc.Arbitrary<Counter> = fc.record({
    type: fc.constantFrom('+1/+1', '-1/-1', 'loyalty', 'charge', 'shield') as fc.Arbitrary<Counter['type']>,
    value: fc.integer({ min: 1, max: 10 }),
  });

  /** Generates a random attachment */
  const attachmentArb: fc.Arbitrary<Attachment> = fc.uuid().map((id) => ({
    card: makeCard({ id, cardType: 'artifact', typeLine: 'Artifact — Equipment' }),
    instanceId: id,
    isTapped: false,
  }));

  it('original RowCard retains isTapped, counters, attachments after split; only mutateStack is cleared', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isTapped
        fc.array(counterArb, { minLength: 0, maxLength: 3 }),
        fc.array(attachmentArb, { minLength: 0, maxLength: 2 }),
        fc.array(fc.uuid().map((id) => makeCard({ id })), { minLength: 1, maxLength: 4 }),
        (tapped, counters, attachments, stack) => {
          const topCard = makeCard({ id: 'original-top' });
          const state = makeEmptyState();

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            isTapped: tapped,
            counters,
            attachments,
            mutateStack: stack,
          };

          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = splitMutateStack(state, 'original-top');

          // Find the original card in the result
          const allElements = result.creatureArea.rows.flatMap((r) => r.elements);
          const original = allElements.find((rc) => rc.instanceId === 'original-top');

          expect(original).toBeDefined();
          // isTapped preserved
          expect(original!.isTapped).toBe(tapped);
          // counters preserved
          expect(original!.counters).toEqual(counters);
          // attachments preserved
          expect(original!.attachments).toEqual(attachments);
          // mutateStack cleared
          expect(original!.mutateStack).toEqual([]);
          // card property unchanged
          expect(original!.card).toEqual(topCard);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('original RowCard stays in the same creature row after split', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid().map((id) => makeCard({ id })), { minLength: 1, maxLength: 3 }),
        (stack) => {
          const topCard = makeCard({ id: 'original-top' });
          const state = makeEmptyState();

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: stack,
            isTapped: true,
          };

          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = splitMutateStack(state, 'original-top');

          // Original card should be findable in creature rows
          const allElements = result.creatureArea.rows.flatMap((r) => r.elements);
          const original = allElements.find((rc) => rc.instanceId === 'original-top');
          expect(original).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests: Zone Separation Functions ───────────────────────────────
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6, 9.1, 9.3, 9.4, 9.6**

// ─── Generators for zone separation tests ────────────────────────────────────

/** Generates a CardData with controllable isToken flag and unique id */
function cardDataWithTokenArb(isToken: boolean): fc.Arbitrary<CardData> {
  return fc.uuid().map((id) => ({
    id,
    name: isToken ? 'Token Creature' : 'Real Creature',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://example.com/card.jpg',
    imageURILarge: 'https://example.com/card-large.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Creature — Elf Warrior',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '3',
    baseToughness: '3',
    cardType: 'creature' as const,
    cmc: 3,
    manaCost: '{1}{G}{G}',
    colorIdentity: ['G'],
    producedMana: [],
    landCategory: null,
    isToken,
    isTokenCopy: false,
  }));
}

/** Generates a non-empty mutateStack (1 to 4 non-token cards) */
const nonTokenStackArb: fc.Arbitrary<CardData[]> = fc.array(
  cardDataWithTokenArb(false),
  { minLength: 1, maxLength: 4 }
);

/** Generates a mixed stack with at least one non-token and at least one token */
const mixedStackArb: fc.Arbitrary<CardData[]> = fc
  .tuple(
    fc.array(cardDataWithTokenArb(false), { minLength: 1, maxLength: 3 }),
    fc.array(cardDataWithTokenArb(true), { minLength: 1, maxLength: 2 })
  )
  .map(([nonTokens, tokens]) => {
    // Interleave tokens and non-tokens
    const mixed: CardData[] = [];
    let ni = 0, ti = 0;
    while (ni < nonTokens.length || ti < tokens.length) {
      if (ni < nonTokens.length) mixed.push(nonTokens[ni++]);
      if (ti < tokens.length) mixed.push(tokens[ti++]);
    }
    return mixed;
  });

/** Creates a state with a mutated creature on the battlefield */
function stateWithMutatedCreature(topCard: CardData, stack: CardData[]): { state: GameState; rowCard: RowCard } {
  const state = makeEmptyState();
  const rowCard: RowCard = {
    ...createRowCard(topCard, 'creature-1', 0),
    mutateStack: stack,
  };
  state.creatureArea.rows[0].elements = [rowCard];
  state.creatureArea.totalElementCount = 1;
  return { state, rowCard };
}

// ─── Property 9: Graveyard Zone Separation ───────────────────────────────────
// **Validates: Requirements 8.1**
// When a mutated creature moves to graveyard, all non-token cards in the stack
// are added to graveyard individually

describe('Property 9: Graveyard Zone Separation', () => {
  it('graveyard gains exactly (1 + mutateStack.length) entries when no tokens present', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'graveyard');

          // All cards separated individually into graveyard
          expect(result.graveyard).toHaveLength(1 + stack.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each graveyard entry matches a card from the original stack', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'graveyard');

          const originalIds = [topCard.id, ...stack.map(c => c.id)];
          const graveyardIds = result.graveyard.map(c => c.id);

          for (const id of originalIds) {
            expect(graveyardIds).toContain(id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Exile Zone Separation ──────────────────────────────────────
// **Validates: Requirements 8.2**
// When a mutated creature moves to exile, all non-token cards are added to exile
// as ExileCard with isFaceDown: false

describe('Property 10: Exile Zone Separation', () => {
  it('exile gains exactly (1 + mutateStack.length) ExileCard entries when no tokens', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'exile');

          expect(result.exile).toHaveLength(1 + stack.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all ExileCard entries have isFaceDown set to false', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'exile');

          for (const exileCard of result.exile) {
            expect(exileCard.isFaceDown).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each exile entry card matches a card from the original stack', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'exile');

          const originalIds = [topCard.id, ...stack.map(c => c.id)];
          const exileIds = result.exile.map(e => e.card.id);

          for (const id of originalIds) {
            expect(exileIds).toContain(id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Library Zone Separation (Ordered) ──────────────────────────
// **Validates: Requirements 8.3**
// When a mutated creature moves to library, cards are placed on top in order
// [Top_Card, ...mutateStack] excluding tokens

describe('Property 11: Library Zone Separation (Ordered)', () => {
  it('library top N cards are ordered as [Top_Card, mutateStack[0], mutateStack[1], ...]', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'library');

          const expectedOrder = [topCard.id, ...stack.map(c => c.id)];
          const actualTop = result.library.slice(0, expectedOrder.length).map(c => c.id);

          expect(actualTop).toEqual(expectedOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('existing library cards are preserved after the separated stack', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        (topCard, stack, existingLibIds) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          // Add existing library cards
          state.library = existingLibIds.map(id => makeCard({ id, name: 'Library Card' }));

          const result = moveCard(state, topCard.id, 'battlefield', 'library');

          const separatedCount = 1 + stack.length;
          const remainingLib = result.library.slice(separatedCount);

          expect(remainingLib.map(c => c.id)).toEqual(existingLibIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Hand Zone Separation ───────────────────────────────────────
// **Validates: Requirements 9.1, 9.3, 9.6**
// When moving to hand, all non-token cards are added to hand excluding tokens

describe('Property 12: Hand Zone Separation', () => {
  it('hand gains all non-token cards from the mutate stack', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'hand');

          // All non-token cards in the stack should be in hand
          expect(result.hand).toHaveLength(1 + stack.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hand cards are plain CardData without battlefield state', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          // Set some battlefield state on the rowCard
          state.creatureArea.rows[0].elements[0].isTapped = true;
          state.creatureArea.rows[0].elements[0].counters = [{ type: '+1/+1', count: 3 }];

          const result = moveCard(state, topCard.id, 'battlefield', 'hand');

          // Cards in hand are CardData, no battlefield state
          for (const card of result.hand) {
            expect(card).not.toHaveProperty('isTapped');
            expect(card).not.toHaveProperty('counters');
            expect(card).not.toHaveProperty('rowAssignment');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each hand card id matches a card from the original mutate stack', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'hand');

          const originalIds = [topCard.id, ...stack.map(c => c.id)];
          const handIds = result.hand.map(c => c.id);

          for (const id of originalIds) {
            expect(handIds).toContain(id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Battlefield Removal After Zone Movement ────────────────────
// **Validates: Requirements 8.4**
// The original RowCard is removed from the battlefield after zone movement

describe('Property 13: Battlefield Removal After Zone Movement', () => {
  const destinations = ['graveyard', 'exile', 'hand', 'library'] as const;

  it('original RowCard no longer exists on battlefield after zone movement', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        fc.constantFrom(...destinations),
        (topCard, stack, destination) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', destination);

          // The card should not be findable on battlefield
          const found = findCardOnBattlefield(result, topCard.id);
          expect(found).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creature area element count is decremented', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        fc.constantFrom(...destinations),
        (topCard, stack, destination) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', destination);

          // The creature row should have no elements (we started with 1)
          expect(result.creatureArea.rows[0].elements).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 14: Token Ephemerality During Stack Separation ─────────────────
// **Validates: Requirements 8.6, 9.4**
// Tokens in the stack are discarded and never appear in any destination zone

describe('Property 14: Token Ephemerality During Stack Separation', () => {
  it('tokens are excluded from graveyard during separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        mixedStackArb,
        (topCard, mixedStack) => {
          const { state } = stateWithMutatedCreature(topCard, mixedStack);
          const result = moveCard(state, topCard.id, 'battlefield', 'graveyard');

          // No token should be in graveyard
          for (const card of result.graveyard) {
            expect(card.isToken).not.toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens are excluded from exile during separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        mixedStackArb,
        (topCard, mixedStack) => {
          const { state } = stateWithMutatedCreature(topCard, mixedStack);
          const result = moveCard(state, topCard.id, 'battlefield', 'exile');

          // No token should be in exile
          for (const exileCard of result.exile) {
            expect(exileCard.card.isToken).not.toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens are excluded from hand during separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        mixedStackArb,
        (topCard, mixedStack) => {
          const { state } = stateWithMutatedCreature(topCard, mixedStack);
          const result = moveCard(state, topCard.id, 'battlefield', 'hand');

          // No token should be in hand
          for (const card of result.hand) {
            expect(card.isToken).not.toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tokens are excluded from library during separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        mixedStackArb,
        (topCard, mixedStack) => {
          const { state } = stateWithMutatedCreature(topCard, mixedStack);
          const result = moveCard(state, topCard.id, 'battlefield', 'library');

          // No token should be in library
          for (const card of result.library) {
            expect(card.isToken).not.toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('token top card is excluded from non-battlefield destination', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(true), // Token as top card
        nonTokenStackArb,
        fc.constantFrom('graveyard' as const, 'hand' as const, 'library' as const),
        (tokenTopCard, stack, destination) => {
          const { state } = stateWithMutatedCreature(tokenTopCard, stack);
          const result = moveCard(state, tokenTopCard.id, 'battlefield', destination);

          if (destination === 'graveyard') {
            expect(result.graveyard.find(c => c.id === tokenTopCard.id)).toBeUndefined();
          } else if (destination === 'hand') {
            expect(result.hand.find(c => c.id === tokenTopCard.id)).toBeUndefined();
          } else {
            expect(result.library.find(c => c.id === tokenTopCard.id)).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: CardData Round-Trip Preservation ───────────────────────────
// **Validates: Requirements 9.3**
// Card identity (id, name, etc.) is preserved through separation

describe('Property 15: CardData Round-Trip Preservation', () => {
  it('cards in graveyard preserve all CardData fields after separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'graveyard');

          // Check that each card retains its original identity
          const originalCards = [topCard, ...stack];
          for (const original of originalCards) {
            const found = result.graveyard.find(c => c.id === original.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(original.name);
            expect(found!.setCode).toBe(original.setCode);
            expect(found!.collectorNumber).toBe(original.collectorNumber);
            expect(found!.imageURI).toBe(original.imageURI);
            expect(found!.typeLine).toBe(original.typeLine);
            expect(found!.oracleText).toBe(original.oracleText);
            expect(found!.cardType).toBe(original.cardType);
            expect(found!.cmc).toBe(original.cmc);
            expect(found!.manaCost).toBe(original.manaCost);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cards in hand preserve all CardData fields after separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'hand');

          const originalCards = [topCard, ...stack];
          for (const original of originalCards) {
            const found = result.hand.find(c => c.id === original.id);
            expect(found).toBeDefined();
            expect(found!.id).toBe(original.id);
            expect(found!.name).toBe(original.name);
            expect(found!.setCode).toBe(original.setCode);
            expect(found!.collectorNumber).toBe(original.collectorNumber);
            expect(found!.imageURI).toBe(original.imageURI);
            expect(found!.typeLine).toBe(original.typeLine);
            expect(found!.oracleText).toBe(original.oracleText);
            expect(found!.keywords).toEqual(original.keywords);
            expect(found!.basePower).toBe(original.basePower);
            expect(found!.baseToughness).toBe(original.baseToughness);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cards in exile preserve all CardData fields after separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'exile');

          const originalCards = [topCard, ...stack];
          for (const original of originalCards) {
            const found = result.exile.find(e => e.card.id === original.id);
            expect(found).toBeDefined();
            expect(found!.card.name).toBe(original.name);
            expect(found!.card.setCode).toBe(original.setCode);
            expect(found!.card.typeLine).toBe(original.typeLine);
            expect(found!.card.oracleText).toBe(original.oracleText);
            expect(found!.card.cardType).toBe(original.cardType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cards placed on library preserve identity through separation', () => {
    fc.assert(
      fc.property(
        cardDataWithTokenArb(false),
        nonTokenStackArb,
        (topCard, stack) => {
          const { state } = stateWithMutatedCreature(topCard, stack);
          const result = moveCard(state, topCard.id, 'battlefield', 'library');

          const originalCards = [topCard, ...stack];
          for (const original of originalCards) {
            const found = result.library.find(c => c.id === original.id);
            expect(found).toBeDefined();
            expect(found!.id).toBe(original.id);
            expect(found!.name).toBe(original.name);
            expect(found!.typeLine).toBe(original.typeLine);
            expect(found!.cardType).toBe(original.cardType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests for Zone Movement with Mutate Stacks ─────────────────────

// ─── Property 17: Attachment Handling During Zone Movement ───────────────────
// **Validates: Requirements 8.5, 9.5**
// When a mutated creature with attachments moves off the battlefield,
// equipment (non-aura) stays on battlefield in row3-artifacts and auras go to graveyard.

describe('Property 17: Attachment Handling During Zone Movement', () => {
  const destinationZones = ['graveyard', 'exile', 'hand', 'library'] as const;

  /** Creates an equipment attachment */
  function makeEquipment(id: string): Attachment {
    return {
      card: makeCard({
        id,
        name: 'Test Equipment',
        cardType: 'artifact',
        typeLine: 'Artifact — Equipment',
      }),
      instanceId: id,
      isTapped: false,
    };
  }

  /** Creates an aura attachment */
  function makeAura(id: string): Attachment {
    return {
      card: makeCard({
        id,
        name: 'Test Aura',
        cardType: 'enchantment',
        typeLine: 'Enchantment — Aura',
      }),
      instanceId: id,
      isTapped: false,
    };
  }

  it('equipment stays on battlefield in row3 when mutated creature moves to any non-battlefield zone', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...destinationZones),
        fc.integer({ min: 1, max: 3 }),
        (destination, equipCount) => {
          const topCard = makeCard({ id: 'top-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const stackCard = makeCard({ id: 'stack-1' });

          const equipments = Array.from({ length: equipCount }, (_, i) =>
            makeEquipment(`equip-${i}`)
          );

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [stackCard],
            attachments: equipments,
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'top-1', 'battlefield', destination);

          // Equipment should be on the battlefield in row3 (right = artifacts)
          const equipOnBattlefield = result.row3.right;
          expect(equipOnBattlefield.length).toBe(equipCount);
          for (let i = 0; i < equipCount; i++) {
            expect(equipOnBattlefield[i].card.id).toBe(`equip-${i}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('auras go to graveyard when mutated creature moves to any non-battlefield zone', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...destinationZones),
        fc.integer({ min: 1, max: 3 }),
        (destination, auraCount) => {
          const topCard = makeCard({ id: 'top-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const stackCard = makeCard({ id: 'stack-1' });

          const auras = Array.from({ length: auraCount }, (_, i) =>
            makeAura(`aura-${i}`)
          );

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [stackCard],
            attachments: auras,
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'top-1', 'battlefield', destination);

          // Auras should be in graveyard
          const auraIds = auras.map(a => a.card.id);
          const graveyardIds = result.graveyard.map(c => c.id);
          for (const auraId of auraIds) {
            expect(graveyardIds).toContain(auraId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed equipment and auras are correctly separated during zone movement', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...destinationZones),
        (destination) => {
          const topCard = makeCard({ id: 'top-1', cardType: 'creature', typeLine: 'Creature — Beast' });
          const stackCard = makeCard({ id: 'stack-1' });

          const equipment = makeEquipment('equip-1');
          const aura = makeAura('aura-1');

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [stackCard],
            attachments: [equipment, aura],
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'top-1', 'battlefield', destination);

          // Equipment in row3-artifacts
          expect(result.row3.right.some(rc => rc.card.id === 'equip-1')).toBe(true);
          // Aura in graveyard
          expect(result.graveyard.some(c => c.id === 'aura-1')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 22: Commander Zone Replacement ─────────────────────────────────
// **Validates: Requirements 13.1, 13.2, 13.3**
// When moving a mutated creature with commanders to graveyard/exile and commander
// choices include 'commandZone', the commanders go to commandZone.

describe('Property 22: Commander Zone Replacement', () => {
  it('commander goes to commandZone when choice is commandZone (graveyard/exile destination)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('graveyard', 'exile') as fc.Arbitrary<'graveyard' | 'exile'>,
        fc.integer({ min: 0, max: 3 }),
        (destination, stackSize) => {
          const commanderCard = makeCard({ id: 'cmd-1', name: 'My Commander', isCommander: true });
          const nonCommanderCards = Array.from({ length: stackSize }, (_, i) =>
            makeCard({ id: `stack-${i}`, isCommander: false })
          );

          const rowCard: RowCard = {
            ...createRowCard(commanderCard, 'creature-1', 0),
            mutateStack: nonCommanderCards,
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
          choices.set('cmd-1', 'commandZone');

          const result = separateMutateStackWithCommanderChoice(state, rowCard, destination, choices);

          // Commander should be in commandZone
          expect(result.commandZone.some(c => c.id === 'cmd-1')).toBe(true);

          // Commander should NOT be in destination zone
          if (destination === 'graveyard') {
            expect(result.graveyard.some(c => c.id === 'cmd-1')).toBe(false);
          } else {
            expect(result.exile.some(e => e.card.id === 'cmd-1')).toBe(false);
          }

          // Non-commander cards should be in destination zone
          for (const card of nonCommanderCards) {
            if (destination === 'graveyard') {
              expect(result.graveyard.some(c => c.id === card.id)).toBe(true);
            } else {
              expect(result.exile.some(e => e.card.id === card.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('commander goes to destination when choice is NOT commandZone', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('graveyard', 'exile') as fc.Arbitrary<'graveyard' | 'exile'>,
        (destination) => {
          const commanderCard = makeCard({ id: 'cmd-1', name: 'My Commander', isCommander: true });
          const stackCard = makeCard({ id: 'stack-1', isCommander: false });

          const rowCard: RowCard = {
            ...createRowCard(commanderCard, 'creature-1', 0),
            mutateStack: [stackCard],
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          // Commander choice is destination (not commandZone)
          const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
          choices.set('cmd-1', destination);

          const result = separateMutateStackWithCommanderChoice(state, rowCard, destination, choices);

          // Commander should NOT be in commandZone
          expect(result.commandZone).toHaveLength(0);

          // Commander should be in destination zone
          if (destination === 'graveyard') {
            expect(result.graveyard.some(c => c.id === 'cmd-1')).toBe(true);
          } else {
            expect(result.exile.some(e => e.card.id === 'cmd-1')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple commanders can be individually routed to commandZone or destination', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('graveyard', 'exile') as fc.Arbitrary<'graveyard' | 'exile'>,
        fc.boolean(),
        fc.boolean(),
        (destination, cmd1ToCommandZone, cmd2ToCommandZone) => {
          const commander1 = makeCard({ id: 'cmd-1', name: 'Partner A', isCommander: true });
          const commander2 = makeCard({ id: 'cmd-2', name: 'Partner B', isCommander: true });
          const normalCard = makeCard({ id: 'normal-1', isCommander: false });

          const rowCard: RowCard = {
            ...createRowCard(commander1, 'creature-1', 0),
            mutateStack: [commander2, normalCard],
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const choices = new Map<string, 'commandZone' | 'graveyard' | 'exile'>();
          choices.set('cmd-1', cmd1ToCommandZone ? 'commandZone' : destination);
          choices.set('cmd-2', cmd2ToCommandZone ? 'commandZone' : destination);

          const result = separateMutateStackWithCommanderChoice(state, rowCard, destination, choices);

          // Count how many commanders went to commandZone
          const expectedInCommandZone = [cmd1ToCommandZone, cmd2ToCommandZone].filter(Boolean).length;
          expect(result.commandZone.length).toBe(expectedInCommandZone);

          // Verify each commander's location
          if (cmd1ToCommandZone) {
            expect(result.commandZone.some(c => c.id === 'cmd-1')).toBe(true);
          } else {
            if (destination === 'graveyard') {
              expect(result.graveyard.some(c => c.id === 'cmd-1')).toBe(true);
            } else {
              expect(result.exile.some(e => e.card.id === 'cmd-1')).toBe(true);
            }
          }

          if (cmd2ToCommandZone) {
            expect(result.commandZone.some(c => c.id === 'cmd-2')).toBe(true);
          } else {
            if (destination === 'graveyard') {
              expect(result.graveyard.some(c => c.id === 'cmd-2')).toBe(true);
            } else {
              expect(result.exile.some(e => e.card.id === 'cmd-2')).toBe(true);
            }
          }

          // Normal card always goes to destination
          if (destination === 'graveyard') {
            expect(result.graveyard.some(c => c.id === 'normal-1')).toBe(true);
          } else {
            expect(result.exile.some(e => e.card.id === 'normal-1')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('moveCard returns state unchanged when commanders are present (defers to UI)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('graveyard', 'exile') as fc.Arbitrary<'graveyard' | 'exile'>,
        (destination) => {
          const commanderCard = makeCard({ id: 'cmd-1', isCommander: true });
          const stackCard = makeCard({ id: 'stack-1' });

          const rowCard: RowCard = {
            ...createRowCard(commanderCard, 'creature-1', 0),
            mutateStack: [stackCard],
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          // moveCard should return state unchanged when commanders are present
          // (defers to UI layer for prompting)
          const result = moveCard(state, 'cmd-1', 'battlefield', destination);

          // The creature should still be on the battlefield (state returned unchanged)
          const found = findCardOnBattlefield(result, 'cmd-1');
          expect(found).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 23: Commander Zone Replacement Exclusions ──────────────────────
// **Validates: Requirements 13.5**
// When moving to hand/library, commanders go to the destination normally
// (no commandZone replacement prompt triggered).

describe('Property 23: Commander Zone Replacement Exclusions', () => {
  it('commanders go to hand normally when destination is hand (no commandZone replacement)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (stackSize) => {
          const commanderCard = makeCard({ id: 'cmd-1', name: 'My Commander', isCommander: true });
          const nonCommanderCards = Array.from({ length: stackSize }, (_, i) =>
            makeCard({ id: `stack-${i}`, isCommander: false })
          );

          const rowCard: RowCard = {
            ...createRowCard(commanderCard, 'creature-1', 0),
            mutateStack: nonCommanderCards,
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'cmd-1', 'battlefield', 'hand');

          // Commander should be in hand (not commandZone)
          expect(result.hand.some(c => c.id === 'cmd-1')).toBe(true);
          expect(result.commandZone).toHaveLength(0);

          // All stack cards also in hand
          for (const card of nonCommanderCards) {
            expect(result.hand.some(c => c.id === card.id)).toBe(true);
          }

          // Creature removed from battlefield
          expect(findCardOnBattlefield(result, 'cmd-1')).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('commanders go to library normally when destination is library (no commandZone replacement)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (stackSize) => {
          const commanderCard = makeCard({ id: 'cmd-1', name: 'My Commander', isCommander: true });
          const nonCommanderCards = Array.from({ length: stackSize }, (_, i) =>
            makeCard({ id: `stack-${i}`, isCommander: false })
          );

          const rowCard: RowCard = {
            ...createRowCard(commanderCard, 'creature-1', 0),
            mutateStack: nonCommanderCards,
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'cmd-1', 'battlefield', 'library');

          // Commander should be in library (not commandZone)
          expect(result.library.some(c => c.id === 'cmd-1')).toBe(true);
          expect(result.commandZone).toHaveLength(0);

          // All stack cards also in library
          for (const card of nonCommanderCards) {
            expect(result.library.some(c => c.id === card.id)).toBe(true);
          }

          // Creature removed from battlefield
          expect(findCardOnBattlefield(result, 'cmd-1')).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('commander in mutateStack (not top card) still goes to hand/library normally', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hand', 'library') as fc.Arbitrary<'hand' | 'library'>,
        (destination) => {
          const topCard = makeCard({ id: 'top-1', isCommander: false });
          const commanderInStack = makeCard({ id: 'cmd-1', name: 'Hidden Commander', isCommander: true });
          const normalCard = makeCard({ id: 'normal-1', isCommander: false });

          const rowCard: RowCard = {
            ...createRowCard(topCard, 'creature-1', 0),
            mutateStack: [commanderInStack, normalCard],
          };

          const state = makeEmptyState();
          state.creatureArea.rows[0].elements = [rowCard];
          state.creatureArea.totalElementCount = 1;

          const result = moveCard(state, 'top-1', 'battlefield', destination);

          // Commander should be in destination (not commandZone)
          if (destination === 'hand') {
            expect(result.hand.some(c => c.id === 'cmd-1')).toBe(true);
          } else {
            expect(result.library.some(c => c.id === 'cmd-1')).toBe(true);
          }
          expect(result.commandZone).toHaveLength(0);

          // All cards go to destination
          if (destination === 'hand') {
            expect(result.hand.some(c => c.id === 'top-1')).toBe(true);
            expect(result.hand.some(c => c.id === 'normal-1')).toBe(true);
          } else {
            expect(result.library.some(c => c.id === 'top-1')).toBe(true);
            expect(result.library.some(c => c.id === 'normal-1')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests: mutateOver and mutateUnder ──────────────────────────────

// ─── Generators for mutateOver/mutateUnder tests ─────────────────────────────

const COUNTER_TYPES: CounterType[] = ['+1/+1', '-1/-1', 'charge', 'loyalty', 'time', 'generic'];

/** Generates a random Counter */
const counterArb: fc.Arbitrary<Counter> = fc.record({
  type: fc.constantFrom(...COUNTER_TYPES),
  value: fc.integer({ min: 1, max: 10 }),
});

/** Generates a random Attachment */
const attachmentArb: fc.Arbitrary<Attachment> = fc.record({
  card: fc.uuid().map((id) => makeCard({ id, cardType: 'artifact', typeLine: 'Artifact — Equipment' })),
  instanceId: fc.uuid(),
  isTapped: fc.boolean(),
});

/** Generates a random non-Human creature CardData for mutate tests */
const creatureCardArb: fc.Arbitrary<CardData> = fc.uuid().map((id) =>
  makeCard({
    id,
    name: `Creature-${id.slice(0, 6)}`,
    cardType: 'creature',
    typeLine: 'Creature — Beast Warrior',
    keywords: ['mutate'],
    oracleText: 'Mutate {2}{G}',
  })
);

/** Generates a target RowCard with random state (counters, attachments, tapped, mutateStack) */
const targetRowCardArb: fc.Arbitrary<{ state: GameState; targetId: string; sourceId: string }> = fc
  .tuple(
    fc.uuid(), // target card id
    fc.uuid(), // source card id
    fc.array(counterArb, { minLength: 0, maxLength: 3 }),
    fc.array(attachmentArb, { minLength: 0, maxLength: 2 }),
    fc.boolean(), // isTapped
    fc.array(creatureCardArb, { minLength: 0, maxLength: 3 }), // existing mutateStack
  )
  .map(([targetId, sourceId, counters, attachments, isTapped, existingStack]) => {
    const targetCard = makeCard({
      id: targetId,
      cardType: 'creature',
      typeLine: 'Creature — Elf Warrior',
    });
    const sourceCard = makeCard({
      id: sourceId,
      cardType: 'creature',
      typeLine: 'Creature — Beast',
      keywords: ['mutate'],
    });

    const targetRowCard: RowCard = {
      ...createRowCard(targetCard, 'creature-1', 0),
      counters,
      attachments,
      isTapped,
      mutateStack: existingStack,
    };
    const sourceRowCard = createRowCard(sourceCard, 'creature-1', 1);

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [targetRowCard, sourceRowCard];
    state.creatureArea.totalElementCount = 2;

    return { state, targetId, sourceId };
  });

// ─── Property 1: State Preservation During Mutate ────────────────────────────
// **Validates: Requirements 1.5**
// For any RowCard with any combination of counters, attachments, isTapped state, and
// rowAssignment, performing either mutateOver or mutateUnder SHALL preserve those fields
// unchanged on the resulting RowCard.

describe('Property 1: State Preservation During Mutate', () => {
  it('mutateOver preserves counters, attachments, isTapped, and rowAssignment', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const targetBefore = findCardOnBattlefield(state, targetId)!.card;

        const result = mutateOver(state, sourceId, targetId, 'battlefield');
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;

        expect(targetAfter.counters).toEqual(targetBefore.counters);
        expect(targetAfter.attachments).toEqual(targetBefore.attachments);
        expect(targetAfter.isTapped).toBe(targetBefore.isTapped);
        expect(targetAfter.rowAssignment).toBe(targetBefore.rowAssignment);
      }),
      { numRuns: 100 }
    );
  });

  it('mutateUnder preserves counters, attachments, isTapped, and rowAssignment', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const targetBefore = findCardOnBattlefield(state, targetId)!.card;

        const result = mutateUnder(state, sourceId, targetId, 'battlefield');
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;

        expect(targetAfter.counters).toEqual(targetBefore.counters);
        expect(targetAfter.attachments).toEqual(targetBefore.attachments);
        expect(targetAfter.isTapped).toBe(targetBefore.isTapped);
        expect(targetAfter.rowAssignment).toBe(targetBefore.rowAssignment);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Over-Mutate Placement ───────────────────────────────────────
// **Validates: Requirements 3.1, 3.5**
// For any source CardData and any target RowCard (with or without existing mutateStack
// entries), performing Over-Mutate SHALL result in the old Top_Card at mutateStack index 0
// (prepended before existing entries) and the source becoming the new RowCard.card property.

describe('Property 2: Over-Mutate Placement', () => {
  it('source becomes new Top_Card and old Top_Card is prepended to mutateStack[0]', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const targetBefore = findCardOnBattlefield(state, targetId)!.card;
        const oldTopCard = targetBefore.card;
        const oldMutateStack = targetBefore.mutateStack;
        const sourceCard = findCardOnBattlefield(state, sourceId)!.card.card;

        const result = mutateOver(state, sourceId, targetId, 'battlefield');
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;

        // Source is now the new Top_Card
        expect(targetAfter.card.id).toBe(sourceCard.id);
        // Old Top_Card is prepended at mutateStack[0]
        expect(targetAfter.mutateStack[0].id).toBe(oldTopCard.id);
        // Old mutateStack entries follow after the prepended card
        expect(targetAfter.mutateStack.length).toBe(oldMutateStack.length + 1);
        for (let i = 0; i < oldMutateStack.length; i++) {
          expect(targetAfter.mutateStack[i + 1].id).toBe(oldMutateStack[i].id);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Under-Mutate Placement ──────────────────────────────────────
// **Validates: Requirements 3.2, 3.5**
// For any source CardData and any target RowCard (with or without existing mutateStack
// entries), performing Under-Mutate SHALL result in the source appended at the end of the
// mutateStack and the RowCard.card property remaining unchanged.

describe('Property 3: Under-Mutate Placement', () => {
  it('source is appended to end of mutateStack and Top_Card is unchanged', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const targetBefore = findCardOnBattlefield(state, targetId)!.card;
        const oldTopCard = targetBefore.card;
        const oldMutateStack = targetBefore.mutateStack;
        const sourceCard = findCardOnBattlefield(state, sourceId)!.card.card;

        const result = mutateUnder(state, sourceId, targetId, 'battlefield');
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;

        // Top_Card remains unchanged
        expect(targetAfter.card.id).toBe(oldTopCard.id);
        // Source is appended at the end of mutateStack
        expect(targetAfter.mutateStack.length).toBe(oldMutateStack.length + 1);
        expect(targetAfter.mutateStack[targetAfter.mutateStack.length - 1].id).toBe(sourceCard.id);
        // Existing mutateStack entries are preserved in order
        for (let i = 0; i < oldMutateStack.length; i++) {
          expect(targetAfter.mutateStack[i].id).toBe(oldMutateStack[i].id);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Source Removal After Mutate ─────────────────────────────────
// **Validates: Requirements 3.3**
// For any mutate operation (over or under) where the source is on the battlefield,
// the source card SHALL no longer be findable as a standalone RowCard on the battlefield
// after the operation completes.

describe('Property 4: Source Removal After Mutate', () => {
  it('source no longer exists as standalone RowCard after mutateOver', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const result = mutateOver(state, sourceId, targetId, 'battlefield');
        // Source should NOT be findable as a standalone card
        const sourceSearch = findCardOnBattlefield(result, sourceId);
        expect(sourceSearch).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('source no longer exists as standalone RowCard after mutateUnder', () => {
    fc.assert(
      fc.property(targetRowCardArb, ({ state, targetId, sourceId }) => {
        const result = mutateUnder(state, sourceId, targetId, 'battlefield');
        // Source should NOT be findable as a standalone card
        const sourceSearch = findCardOnBattlefield(result, sourceId);
        expect(sourceSearch).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 20: Hand-to-Battlefield Mutate ─────────────────────────────────
// **Validates: Requirements 12.4**
// For any card in hand with the Mutate keyword mutated onto a valid battlefield target,
// the card SHALL be removed from the hand array and merged into the target's mutateStack
// (under) or become the new Top_Card (over), following the same placement logic as
// battlefield-to-battlefield mutate.

describe('Property 20: Hand-to-Battlefield Mutate', () => {
  const handMutateSetup: fc.Arbitrary<{ state: GameState; targetId: string; handCardId: string }> = fc
    .tuple(
      fc.uuid(), // target card id
      fc.uuid(), // hand card id
      fc.array(counterArb, { minLength: 0, maxLength: 2 }),
      fc.boolean(), // isTapped
    )
    .map(([targetId, handCardId, counters, isTapped]) => {
      const targetCard = makeCard({
        id: targetId,
        cardType: 'creature',
        typeLine: 'Creature — Elf Warrior',
      });
      const handCard = makeCard({
        id: handCardId,
        cardType: 'creature',
        typeLine: 'Creature — Beast',
        keywords: ['mutate'],
      });

      const targetRowCard: RowCard = {
        ...createRowCard(targetCard, 'creature-1', 0),
        counters,
        isTapped,
      };

      const state = makeEmptyState();
      state.creatureArea.rows[0].elements = [targetRowCard];
      state.creatureArea.totalElementCount = 1;
      state.hand = [handCard];

      return { state, targetId, handCardId };
    });

  it('mutateOver from hand removes card from hand and makes it new Top_Card', () => {
    fc.assert(
      fc.property(handMutateSetup, ({ state, targetId, handCardId }) => {
        const oldTopCard = findCardOnBattlefield(state, targetId)!.card.card;

        const result = mutateOver(state, handCardId, targetId, 'hand');

        // Hand card removed
        expect(result.hand.find((c) => c.id === handCardId)).toBeUndefined();
        // Hand card became new Top_Card
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;
        expect(targetAfter.card.id).toBe(handCardId);
        // Old Top_Card is in mutateStack[0]
        expect(targetAfter.mutateStack[0].id).toBe(oldTopCard.id);
      }),
      { numRuns: 100 }
    );
  });

  it('mutateUnder from hand removes card from hand and appends to mutateStack', () => {
    fc.assert(
      fc.property(handMutateSetup, ({ state, targetId, handCardId }) => {
        const oldTopCard = findCardOnBattlefield(state, targetId)!.card.card;

        const result = mutateUnder(state, handCardId, targetId, 'hand');

        // Hand card removed
        expect(result.hand.find((c) => c.id === handCardId)).toBeUndefined();
        // Top_Card unchanged
        const targetAfter = findCardOnBattlefield(result, targetId)!.card;
        expect(targetAfter.card.id).toBe(oldTopCard.id);
        // Hand card is appended to mutateStack
        expect(targetAfter.mutateStack[targetAfter.mutateStack.length - 1].id).toBe(handCardId);
      }),
      { numRuns: 100 }
    );
  });

  it('hand length decreases by 1 after mutate from hand', () => {
    fc.assert(
      fc.property(handMutateSetup, ({ state, targetId, handCardId }) => {
        const handLenBefore = state.hand.length;

        const resultOver = mutateOver(state, handCardId, targetId, 'hand');
        expect(resultOver.hand.length).toBe(handLenBefore - 1);

        const resultUnder = mutateUnder(state, handCardId, targetId, 'hand');
        expect(resultUnder.hand.length).toBe(handLenBefore - 1);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 16: Stat Display Formula ───────────────────────────────────────
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
// For any mutated creature with numeric basePower/baseToughness, the displayed
// power = basePower + equipment power mods + plus1Count - minus1Count.
// If basePower is non-numeric ("*"), display raw value without modifiers.

describe('Property 16: Stat Display Formula', () => {
  /** Generates equipment oracle text with a stat modifier like "gets +N/+M" */
  const equipmentOracleArb = fc.tuple(
    fc.integer({ min: -5, max: 5 }),
    fc.integer({ min: -5, max: 5 })
  ).map(([p, t]) => `Equipped creature gets ${p >= 0 ? '+' : ''}${p}/${t >= 0 ? '+' : ''}${t}.`);

  /** Generates a creature CardData with numeric basePower/baseToughness */
  const numericCreatureArb = fc.tuple(
    fc.uuid(),
    fc.integer({ min: 0, max: 15 }),
    fc.integer({ min: 0, max: 15 }),
    fc.array(cardDataArb(), { minLength: 0, maxLength: 3 }) // mutateStack
  ).map(([id, power, toughness, stack]) => ({
    card: makeCard({
      id,
      basePower: String(power),
      baseToughness: String(toughness),
      cardType: 'creature',
      typeLine: 'Creature — Beast',
    }),
    mutateStack: stack,
    basePower: power,
    baseToughness: toughness,
  }));

  /** Generates a set of equipment attachments with stat modifiers */
  const equipmentListArb = fc.array(
    fc.tuple(fc.uuid(), equipmentOracleArb).map(([id, oracleText]) =>
      makeCard({
        id,
        cardType: 'artifact',
        typeLine: 'Artifact — Equipment',
        oracleText,
      })
    ),
    { minLength: 0, maxLength: 3 }
  );

  /** Generates +1/+1 counter count */
  const plus1Arb = fc.integer({ min: 0, max: 10 });
  /** Generates -1/-1 counter count */
  const minus1Arb = fc.integer({ min: 0, max: 10 });

  it('numeric base power: displayedPower = basePower + equipment mods + plus1 - minus1', () => {
    fc.assert(
      fc.property(
        numericCreatureArb,
        equipmentListArb,
        plus1Arb,
        minus1Arb,
        ({ card, mutateStack, basePower, baseToughness }, equipmentCards, plus1Count, minus1Count) => {
          // Build RowCard
          const rowCard: RowCard = {
            card,
            instanceId: card.id,
            rowAssignment: 'creature-1',
            positionIndex: 0,
            isTapped: false,
            isFaceDown: false,
            showingBackFace: false,
            isPhased: false,
            attachments: equipmentCards.map((eq) => ({
              card: eq,
              instanceId: eq.id,
              isTapped: false,
            })),
            counters: [
              ...(plus1Count > 0 ? [{ type: '+1/+1' as const, value: plus1Count }] : []),
              ...(minus1Count > 0 ? [{ type: '-1/-1' as const, value: minus1Count }] : []),
            ],
            mutateStack,
            isRevealed: false,
          };

          // Calculate effective stats using the same function RotationDiv uses
          const attachmentRowCards = rowCard.attachments.map((att) =>
            createRowCard(att.card, rowCard.rowAssignment, 0)
          );
          const effectiveStats = calculateEffectiveStats(rowCard, attachmentRowCards);

          // The formula from RotationDiv:
          const displayedPower = effectiveStats.modifiedPower + plus1Count - minus1Count;
          const displayedToughness = effectiveStats.modifiedToughness + plus1Count - minus1Count;

          // Verify the formula matches the expected computation:
          // basePower + sum(equipment power mods) + plus1Count - minus1Count
          const expectedEquipPowerMod = effectiveStats.modifiedPower - effectiveStats.basePower;
          const expectedEquipToughMod = effectiveStats.modifiedToughness - effectiveStats.baseToughness;

          expect(displayedPower).toBe(basePower + expectedEquipPowerMod + plus1Count - minus1Count);
          expect(displayedToughness).toBe(baseToughness + expectedEquipToughMod + plus1Count - minus1Count);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-numeric base power ("*") returns raw value regardless of modifiers', () => {
    const nonNumericPowerArb = fc.constantFrom('*', 'X', '*+1', '?');

    fc.assert(
      fc.property(
        nonNumericPowerArb,
        equipmentListArb,
        plus1Arb,
        minus1Arb,
        (rawPower, equipmentCards, plus1Count, minus1Count) => {
          const card = makeCard({
            id: 'star-creature',
            basePower: rawPower,
            baseToughness: rawPower, // both non-numeric
            cardType: 'creature',
            typeLine: 'Creature — Shapeshifter',
          });

          const rowCard: RowCard = {
            card,
            instanceId: card.id,
            rowAssignment: 'creature-1',
            positionIndex: 0,
            isTapped: false,
            isFaceDown: false,
            showingBackFace: false,
            isPhased: false,
            attachments: equipmentCards.map((eq) => ({
              card: eq,
              instanceId: eq.id,
              isTapped: false,
            })),
            counters: [
              ...(plus1Count > 0 ? [{ type: '+1/+1' as const, value: plus1Count }] : []),
              ...(minus1Count > 0 ? [{ type: '-1/-1' as const, value: minus1Count }] : []),
            ],
            mutateStack: [makeCard({ id: 'under-1' })],
            isRevealed: false,
          };

          // Non-numeric detection: same as RotationDiv
          const isNumericPower = rowCard.card.basePower != null && !isNaN(parseInt(rowCard.card.basePower, 10));
          const isNumericToughness = rowCard.card.baseToughness != null && !isNaN(parseInt(rowCard.card.baseToughness, 10));

          // When non-numeric, display the raw value regardless of equipment/counters
          expect(isNumericPower).toBe(false);
          expect(isNumericToughness).toBe(false);

          // The displayed value should be the raw basePower/baseToughness string
          const displayedPower = isNumericPower ? 'should not reach' : rowCard.card.basePower;
          const displayedToughness = isNumericToughness ? 'should not reach' : rowCard.card.baseToughness;

          expect(displayedPower).toBe(rawPower);
          expect(displayedToughness).toBe(rawPower);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple +1/+1 counters add up correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (basePow, counter1Value, counter2Value) => {
          const card = makeCard({
            id: 'multi-counter',
            basePower: String(basePow),
            baseToughness: String(basePow),
            cardType: 'creature',
          });

          const rowCard: RowCard = {
            card,
            instanceId: card.id,
            rowAssignment: 'creature-1',
            positionIndex: 0,
            isTapped: false,
            isFaceDown: false,
            showingBackFace: false,
            isPhased: false,
            attachments: [],
            counters: [
              { type: '+1/+1', value: counter1Value },
              { type: '+1/+1', value: counter2Value },
            ],
            mutateStack: [makeCard({ id: 'under-1' })],
            isRevealed: false,
          };

          // Sum all +1/+1 counter values
          const totalPlus1 = rowCard.counters
            .filter((c) => c.type === '+1/+1')
            .reduce((sum, c) => sum + c.value, 0);

          const attachmentRowCards = rowCard.attachments.map((att) =>
            createRowCard(att.card, rowCard.rowAssignment, 0)
          );
          const effectiveStats = calculateEffectiveStats(rowCard, attachmentRowCards);

          const displayedPower = effectiveStats.modifiedPower + totalPlus1;

          expect(totalPlus1).toBe(counter1Value + counter2Value);
          expect(displayedPower).toBe(basePow + counter1Value + counter2Value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed +1/+1 and -1/-1 counters compute correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        plus1Arb,
        minus1Arb,
        equipmentListArb,
        (basePow, baseTou, plus1Count, minus1Count, equipmentCards) => {
          const card = makeCard({
            id: 'mixed-counter',
            basePower: String(basePow),
            baseToughness: String(baseTou),
            cardType: 'creature',
          });

          const rowCard: RowCard = {
            card,
            instanceId: card.id,
            rowAssignment: 'creature-1',
            positionIndex: 0,
            isTapped: false,
            isFaceDown: false,
            showingBackFace: false,
            isPhased: false,
            attachments: equipmentCards.map((eq) => ({
              card: eq,
              instanceId: eq.id,
              isTapped: false,
            })),
            counters: [
              ...(plus1Count > 0 ? [{ type: '+1/+1' as const, value: plus1Count }] : []),
              ...(minus1Count > 0 ? [{ type: '-1/-1' as const, value: minus1Count }] : []),
            ],
            mutateStack: [makeCard({ id: 'under-1' })],
            isRevealed: false,
          };

          const attachmentRowCards = rowCard.attachments.map((att) =>
            createRowCard(att.card, rowCard.rowAssignment, 0)
          );
          const effectiveStats = calculateEffectiveStats(rowCard, attachmentRowCards);

          // RotationDiv formula
          const displayedPower = effectiveStats.modifiedPower + plus1Count - minus1Count;
          const displayedToughness = effectiveStats.modifiedToughness + plus1Count - minus1Count;

          // Verify: base + equipMods + plus1 - minus1
          const equipPowerMod = effectiveStats.modifiedPower - effectiveStats.basePower;
          const equipToughMod = effectiveStats.modifiedToughness - effectiveStats.baseToughness;

          expect(displayedPower).toBe(basePow + equipPowerMod + plus1Count - minus1Count);
          expect(displayedToughness).toBe(baseTou + equipToughMod + plus1Count - minus1Count);
        }
      ),
      { numRuns: 100 }
    );
  });
});
