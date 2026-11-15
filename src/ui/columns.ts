import { cardValue, isWild, rankLabel } from "../engine/cards"
import type { Card } from "../engine/cards"
import { classify, comboTypeName, describeCombo } from "../engine/combos"

export interface Column {
  key: string
  label: string
  cards: Card[]
  custom: boolean
  /** Short name shown on a hand-made pile. */
  name?: string
}

const RUNS = new Set(["straight", "straightFlush", "tube", "plate"])

const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3, J: 4 }

export function buildColumns(hand: Card[], groups: number[][], level: number): Column[] {
  const byId = new Map(hand.map((c) => [c.id, c]))
  const used = new Set<number>()
  const custom: Column[] = []
  for (const group of groups) {
    const cards = group.flatMap((id) => byId.get(id) ?? [])
    if (cards.length === 0) continue
    const combo = classify(cards, level)[0]
    const inRun = combo !== undefined && RUNS.has(combo.type)
    cards.sort((a, b) => (inRun ? b.rank - a.rank : cardValue(b, level) - cardValue(a, level)))
    cards.forEach((c) => used.add(c.id))
    custom.push({
      key: `group-${cards[0].id}`,
      label: combo ? `你组的牌：${describeCombo(combo, level)}` : "你组的牌：还不成牌型",
      name: combo ? comboTypeName(combo.type) : "自组",
      cards,
      custom: true,
    })
  }

  const piles = new Map<string, { order: number; column: Column }>()
  for (const card of hand) {
    if (used.has(card.id)) continue
    const wild = isWild(card, level)
    const key = wild ? "wild" : `rank-${card.rank}`
    let pile = piles.get(key)
    if (!pile) {
      pile = {
        order: cardValue(card, level) + (wild ? 0.5 : 0),
        column: { key, label: wild ? "逢人配" : rankLabel(card.rank), cards: [], custom: false },
      }
      piles.set(key, pile)
    }
    pile.column.cards.push(card)
  }
  const natural = [...piles.values()].sort((a, b) => b.order - a.order).map((p) => p.column)
  for (const column of natural) column.cards.sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit])
  return [...custom, ...natural]
}
