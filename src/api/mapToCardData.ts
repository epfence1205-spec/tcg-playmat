import type { CardData, CardType } from '../types';
import type { ScryfallCard } from './scryfallResolver';
import { parseKeywords } from '../keywords';

/**
 * Derives a CardType from the full type line string.
 * Checks in priority order to handle multi-type cards correctly
 * (e.g., "Artifact Creature" → creature).
 */
export function deriveCardType(typeLine: string): CardType {
  const lower = typeLine.toLowerCase();
  if (lower.includes('creature')) return 'creature';
  if (lower.includes('planeswalker')) return 'planeswalker';
  if (lower.includes('battle')) return 'battle';
  if (lower.includes('land')) return 'land';
  if (lower.includes('artifact')) return 'artifact';
  if (lower.includes('enchantment')) return 'enchantment';
  if (lower.includes('instant')) return 'instant';
  if (lower.includes('sorcery')) return 'sorcery';
  return 'other';
}

/**
 * Maps a Scryfall API card object to our internal CardData interface.
 *
 * Handles both normal cards (with top-level image_uris) and double-faced cards
 * (DFCs) where images are nested under card_faces.
 *
 * Each call generates a unique UUID so multiple copies of the same card
 * get distinct instance IDs.
 *
 * Enriches the card with:
 * - imageURILarge: high-res image for HD Zoom Portal
 * - basePower/baseToughness: creature stats
 * - cardType: derived from typeLine for row assignment
 * - keywords: parsed from oracleText
 */
export function mapToCardData(raw: ScryfallCard, isCommander: boolean = false): CardData {
  // Resolve oracle text — for DFCs, combine both faces' oracle text
  const oracleText = raw.oracle_text
    ?? raw.card_faces?.map(f => f.oracle_text ?? '').join('\n')
    ?? '';

  // Resolve back face data for DFCs
  const backFace = raw.card_faces?.[1] ?? null;
  const backFaceTypeLine = backFace?.type_line ?? null;
  const backFaceCardType = backFaceTypeLine ? deriveCardType(backFaceTypeLine) : null;
  const backFaceName = backFace?.name ?? null;
  const backFacePower = backFace?.power ?? null;
  const backFaceToughness = backFace?.toughness ?? null;

  // For DFCs, use front face type line for cardType (not the combined "Instant // Land")
  const frontFaceTypeLine = raw.card_faces?.[0]?.type_line ?? raw.type_line;

  return {
    id: crypto.randomUUID(),
    name: raw.card_faces?.[0]?.name ?? raw.name,
    setCode: raw.set,
    collectorNumber: raw.collector_number,
    imageURI: raw.image_uris?.normal ?? raw.card_faces?.[0]?.image_uris?.normal ?? '',
    imageURILarge: raw.image_uris?.large ?? raw.card_faces?.[0]?.image_uris?.large ?? '',
    backFaceImageURI: raw.card_faces?.[1]?.image_uris?.normal ?? null,
    backFaceCardType,
    backFaceName,
    backFacePower,
    backFaceToughness,
    typeLine: raw.type_line,
    oracleText,
    isCommander,
    basePower: raw.card_faces?.[0]?.power ?? raw.power ?? null,
    baseToughness: raw.card_faces?.[0]?.toughness ?? raw.toughness ?? null,
    cardType: deriveCardType(frontFaceTypeLine),
    cmc: raw.cmc ?? 0,
    manaCost: raw.card_faces?.[0]?.mana_cost ?? raw.mana_cost ?? '',
    colorIdentity: raw.color_identity ?? [],
    producedMana: raw.produced_mana ?? [],
    keywords: parseKeywords(oracleText),
    isToken: false,
    isTokenCopy: false,
  };
}
