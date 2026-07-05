import { describe, it, expect } from 'vitest';
import {
  classifyLine,
  extractStatBonus,
  computeEquipmentBonus,
  computeGrantedKeywords,
  classifyOracleText,
} from './oracleClassifier';

// ─── Real Equipment Oracle Texts ─────────────────────────────────────────────

const BONESPLITTER = 'Equipped creature gets +2/+0.\nEquip {1}';
const SWORD_OF_FIRE_AND_ICE = 'Equipped creature gets +2/+2 and has protection from red and from blue.\nWhenever equipped creature deals combat damage to a player, Sword of Fire and Ice deals 2 damage to any target and you draw a card.\nEquip {2}';
const SHADOWSPEAR = 'Equipped creature gets +1/+1 and has trample and lifelink.\n{1}: Permanents your opponents control lose hexproof and indestructible until end of turn.\nEquip {2}';
const CRANIAL_PLATING = 'Equipped creature gets +1/+0 for each artifact you control.\n{B}{B}: Attach Cranial Plating to target creature you control.\nEquip {1}';
const CONQUERORS_FLAIL = "Equipped creature gets +1/+1 for each color among permanents you control.\nAs long as Conqueror's Flail is equipped, your opponents can't cast spells during your turn.\nEquip {2}";
const HELM_OF_THE_HOST = "At the beginning of combat on your turn, create a token that's a copy of equipped creature, except the token isn't legendary. That token gains haste.\nEquip {5}";
const LOXODON_WARHAMMER = 'Equipped creature gets +3/+0 and has trample and lifelink.\nEquip {3}';
const UMEZAWAS_JITTE = 'Whenever equipped creature deals combat damage, put two charge counters on Umezawa\'s Jitte.\nRemove a charge counter from Umezawa\'s Jitte: Choose one —\n• Equipped creature gets +2/+2 until end of turn.\n• Target creature gets -1/-1 until end of turn.\n• You gain 2 life.';
const SKULLCLAMP = 'Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}';
const BLACKBLADE_REFORGED = 'Equipped creature gets +1/+1 for each land you control.\nEquip legendary creature {3}\nEquip {7}';
const EMBERCLEAVE = 'Flash\nThis spell costs {1} less to cast for each attacking creature you control.\nWhen Embercleave enters the battlefield, attach it to target creature you control.\nEquipped creature gets +1/+1 and has trample and double strike.\nEquip {3}';
const COLOSSUS_HAMMER = 'Equipped creature gets +10/+10 and loses flying.\nEquip {8}';
const SWIFTFOOT_BOOTS = 'Equipped creature has hexproof and haste.\nEquip {1}';
const LIGHTNING_GREAVES = 'Equipped creature has shroud and haste.\nEquip {0}';
const RANCOR = 'Enchanted creature gets +2/+0 and has trample.\nWhen Rancor is put into a graveyard from the battlefield, return Rancor to its owner\'s hand.';

// ─── classifyLine Tests ──────────────────────────────────────────────────────

describe('classifyLine', () => {
  it('classifies static bonus lines', () => {
    expect(classifyLine('Equipped creature gets +2/+0.')).toBe('STATIC_BONUS');
    expect(classifyLine('Equipped creature gets +1/+1 and has trample and lifelink.')).toBe('STATIC_BONUS');
    expect(classifyLine('Enchanted creature gets +2/+0 and has trample.')).toBe('STATIC_BONUS');
    expect(classifyLine('Equipped creature gets +10/+10 and loses flying.')).toBe('STATIC_BONUS');
    expect(classifyLine('Equipped creature gets +1/-1.')).toBe('STATIC_BONUS');
  });

  it('classifies static keyword lines', () => {
    expect(classifyLine('Equipped creature has hexproof and haste.')).toBe('STATIC_KEYWORD');
    expect(classifyLine('Equipped creature has shroud and haste.')).toBe('STATIC_KEYWORD');
    expect(classifyLine('Enchanted creature gains flying.')).toBe('STATIC_KEYWORD');
  });

  it('classifies variable bonus lines', () => {
    expect(classifyLine('Equipped creature gets +1/+0 for each artifact you control.')).toBe('VARIABLE_BONUS');
    expect(classifyLine('Equipped creature gets +1/+1 for each color among permanents you control.')).toBe('VARIABLE_BONUS');
    expect(classifyLine('Equipped creature gets +1/+1 for each land you control.')).toBe('VARIABLE_BONUS');
  });

  it('classifies triggered ability lines', () => {
    expect(classifyLine('Whenever equipped creature deals combat damage to a player, Sword of Fire and Ice deals 2 damage to any target and you draw a card.')).toBe('TRIGGERED');
    expect(classifyLine('Whenever equipped creature deals combat damage, put two charge counters on Umezawa\'s Jitte.')).toBe('TRIGGERED');
    expect(classifyLine('Whenever equipped creature dies, draw two cards.')).toBe('TRIGGERED');
    expect(classifyLine("At the beginning of combat on your turn, create a token that's a copy of equipped creature, except the token isn't legendary. That token gains haste.")).toBe('TRIGGERED');
  });

  it('classifies activated ability lines', () => {
    expect(classifyLine('{1}: Permanents your opponents control lose hexproof and indestructible until end of turn.')).toBe('ACTIVATED');
    expect(classifyLine('{B}{B}: Attach Cranial Plating to target creature you control.')).toBe('ACTIVATED');
  });

  it('classifies token effect lines', () => {
    expect(classifyLine('That token gains haste.')).toBe('TOKEN_EFFECT');
  });

  it('classifies "until end of turn" as triggered/temporary', () => {
    expect(classifyLine('• Equipped creature gets +2/+2 until end of turn.')).toBe('TRIGGERED');
  });

  it('classifies equip cost lines as OTHER', () => {
    expect(classifyLine('Equip {1}')).toBe('OTHER');
    expect(classifyLine('Equip {5}')).toBe('OTHER');
    expect(classifyLine('Equip legendary creature {3}')).toBe('OTHER');
  });
});

// ─── extractStatBonus Tests ──────────────────────────────────────────────────

describe('extractStatBonus', () => {
  it('extracts positive bonuses', () => {
    expect(extractStatBonus('Equipped creature gets +2/+0.')).toEqual({ power: 2, toughness: 0 });
    expect(extractStatBonus('Equipped creature gets +2/+2 and has protection from red.')).toEqual({ power: 2, toughness: 2 });
    expect(extractStatBonus('Equipped creature gets +10/+10 and loses flying.')).toEqual({ power: 10, toughness: 10 });
  });

  it('extracts negative bonuses', () => {
    expect(extractStatBonus('Equipped creature gets +1/-1.')).toEqual({ power: 1, toughness: -1 });
  });

  it('returns null for non-stat lines', () => {
    expect(extractStatBonus('Equipped creature has hexproof and haste.')).toBeNull();
    expect(extractStatBonus('Equip {1}')).toBeNull();
  });
});

// ─── computeEquipmentBonus Tests (Full Oracle Texts) ─────────────────────────

describe('computeEquipmentBonus', () => {
  it('Bonesplitter: static +2/+0', () => {
    expect(computeEquipmentBonus(BONESPLITTER)).toEqual({ power: 2, toughness: 0 });
  });

  it('Sword of Fire and Ice: static +2/+2 (ignores triggered ability)', () => {
    expect(computeEquipmentBonus(SWORD_OF_FIRE_AND_ICE)).toEqual({ power: 2, toughness: 2 });
  });

  it('Shadowspear: static +1/+1 (ignores activated ability)', () => {
    expect(computeEquipmentBonus(SHADOWSPEAR)).toEqual({ power: 1, toughness: 1 });
  });

  it('Cranial Plating: 0/0 (variable — for each artifact)', () => {
    expect(computeEquipmentBonus(CRANIAL_PLATING)).toEqual({ power: 0, toughness: 0 });
  });

  it("Conqueror's Flail: 0/0 (variable — for each color)", () => {
    expect(computeEquipmentBonus(CONQUERORS_FLAIL)).toEqual({ power: 0, toughness: 0 });
  });

  it('Helm of the Host: 0/0 (triggered + token effect, no stats)', () => {
    expect(computeEquipmentBonus(HELM_OF_THE_HOST)).toEqual({ power: 0, toughness: 0 });
  });

  it('Loxodon Warhammer: static +3/+0', () => {
    expect(computeEquipmentBonus(LOXODON_WARHAMMER)).toEqual({ power: 3, toughness: 0 });
  });

  it("Umezawa's Jitte: 0/0 (all triggered/activated, +2/+2 is until end of turn)", () => {
    expect(computeEquipmentBonus(UMEZAWAS_JITTE)).toEqual({ power: 0, toughness: 0 });
  });

  it('Skullclamp: static +1/-1', () => {
    expect(computeEquipmentBonus(SKULLCLAMP)).toEqual({ power: 1, toughness: -1 });
  });

  it('Blackblade Reforged: 0/0 (variable — for each land)', () => {
    expect(computeEquipmentBonus(BLACKBLADE_REFORGED)).toEqual({ power: 0, toughness: 0 });
  });

  it('Embercleave: static +1/+1 (ignores triggered ETB, flash, cost reduction)', () => {
    expect(computeEquipmentBonus(EMBERCLEAVE)).toEqual({ power: 1, toughness: 1 });
  });

  it('Colossus Hammer: static +10/+10', () => {
    expect(computeEquipmentBonus(COLOSSUS_HAMMER)).toEqual({ power: 10, toughness: 10 });
  });

  it('Swiftfoot Boots: 0/0 (keyword only, no stats)', () => {
    expect(computeEquipmentBonus(SWIFTFOOT_BOOTS)).toEqual({ power: 0, toughness: 0 });
  });

  it('Lightning Greaves: 0/0 (keyword only, no stats)', () => {
    expect(computeEquipmentBonus(LIGHTNING_GREAVES)).toEqual({ power: 0, toughness: 0 });
  });

  it('Rancor: static +2/+0', () => {
    expect(computeEquipmentBonus(RANCOR)).toEqual({ power: 2, toughness: 0 });
  });
});

// ─── computeGrantedKeywords Tests ────────────────────────────────────────────

describe('computeGrantedKeywords', () => {
  it('Shadowspear: grants trample and lifelink', () => {
    const kws = computeGrantedKeywords(SHADOWSPEAR);
    expect(kws).toContain('trample');
    expect(kws).toContain('lifelink');
  });

  it('Swiftfoot Boots: grants hexproof and haste', () => {
    const kws = computeGrantedKeywords(SWIFTFOOT_BOOTS);
    expect(kws).toContain('hexproof');
    expect(kws).toContain('haste');
  });

  it('Lightning Greaves: grants shroud and haste', () => {
    const kws = computeGrantedKeywords(LIGHTNING_GREAVES);
    expect(kws).toContain('shroud');
    expect(kws).toContain('haste');
  });

  it('Helm of the Host: does NOT grant haste (token effect, not equipped creature)', () => {
    const kws = computeGrantedKeywords(HELM_OF_THE_HOST);
    expect(kws).not.toContain('haste');
  });

  it('Embercleave: grants trample and double strike', () => {
    const kws = computeGrantedKeywords(EMBERCLEAVE);
    expect(kws).toContain('trample');
    expect(kws).toContain('double strike');
  });

  it('Loxodon Warhammer: grants trample and lifelink', () => {
    const kws = computeGrantedKeywords(LOXODON_WARHAMMER);
    expect(kws).toContain('trample');
    expect(kws).toContain('lifelink');
  });

  it('Rancor: grants trample', () => {
    const kws = computeGrantedKeywords(RANCOR);
    expect(kws).toContain('trample');
  });

  it('Bonesplitter: grants no keywords', () => {
    expect(computeGrantedKeywords(BONESPLITTER)).toEqual([]);
  });
});

// ─── classifyOracleText Integration Tests ────────────────────────────────────

describe('classifyOracleText', () => {
  it('Helm of the Host: first line TRIGGERED, second line OTHER (equip)', () => {
    const result = classifyOracleText(HELM_OF_THE_HOST);
    expect(result[0].type).toBe('TRIGGERED');
    expect(result[1].type).toBe('OTHER');
  });

  it('Sword of Fire and Ice: STATIC_BONUS, TRIGGERED, OTHER', () => {
    const result = classifyOracleText(SWORD_OF_FIRE_AND_ICE);
    expect(result[0].type).toBe('STATIC_BONUS');
    expect(result[1].type).toBe('TRIGGERED');
    expect(result[2].type).toBe('OTHER');
  });

  it('Shadowspear: STATIC_BONUS, ACTIVATED, OTHER', () => {
    const result = classifyOracleText(SHADOWSPEAR);
    expect(result[0].type).toBe('STATIC_BONUS');
    expect(result[1].type).toBe('ACTIVATED');
    expect(result[2].type).toBe('OTHER');
  });
});
