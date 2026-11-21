// The computer players. They see what a player at the table sees: their own hand, the 牌河, the calls and the
// 宝牌 indicators. They never read another seat's hand or the wall.
import { indicatorTiles, legalActions, seatWind } from "./game"
import type { Action, MahjongState } from "./game"
import { shanten, usefulKinds } from "./shanten"
import { EAST, countKinds, isDragon, isHonor, isTerminal } from "./tiles"
import type { Kind, Tile } from "./tiles"

/** How many tiles of each kind the seat can see: its hand, every 牌河 and call, and the 宝牌 indicators. */
export function visibleCounts(state: MahjongState, seat: number): number[] {
  const seen: Tile[] = [...state.players[seat].hand, ...indicatorTiles(state)]
  for (const player of state.players) {
    seen.push(...player.melds.flatMap((meld) => meld.tiles), ...player.river.filter((discard) => !discard.called).map((discard) => discard.tile))
  }
  return countKinds(seen)
}

export interface DiscardChoice {
  kind: Kind
  /** 向听 after the discard. */
  shanten: number
  /** 进张: the kinds that improve the hand afterwards, and how many of those tiles are not yet in sight. */
  useful: Kind[]
  left: number
}

/** How much a lone tile is worth keeping: an honour least, a middle tile most. */
const keep = (kind: Kind) => (isHonor(kind) ? 0 : isTerminal(kind) ? 1 : 2)

/** Every kind the seat could discard, best first: the lowest 向听, then the most 进张, then the tile least useful later. */
export function discardChoices(state: MahjongState, seat: number): DiscardChoice[] {
  const player = state.players[seat]
  const counts = countKinds(player.hand)
  const seen = visibleCounts(state, seat)
  const called = player.melds.length
  const choices = counts.flatMap((count, kind): DiscardChoice[] => {
    if (count === 0) return []
    counts[kind]--
    const useful = usefulKinds(counts, called)
    const choice = { kind, shanten: shanten(counts, called), useful, left: useful.reduce((sum, k) => sum + 4 - seen[k], 0) }
    counts[kind]++
    return [choice]
  })
  return choices.sort((a, b) => a.shanten - b.shanten || b.left - a.left || keep(a.kind) - keep(b.kind))
}

/** The action a computer player takes. `rng` breaks ties, so two players do not move in step. */
export function botAction(state: MahjongState, seat: number, rng: () => number): Action {
  const legal = legalActions(state, seat)
  const win = legal.find((action) => action.type === "tsumo" || action.type === "ron")
  if (win) return win
  const player = state.players[seat]
  if (state.phase === "call") {
    const kind = state.pending?.tile.kind ?? -1
    const valued = isDragon(kind) || kind === seatWind(state, seat) || kind === EAST + state.round
    const pon = legal.find((action) => action.type === "pon")
    return pon && valued ? pon : { type: "pass" }
  }
  const choices = discardChoices(state, seat)
  const allowed = (riichi: boolean) => (choice: DiscardChoice) =>
    legal.some((action) => action.type === "discard" && (action.riichi === true) === riichi && tileOf(player.hand, action.tile)?.kind === choice.kind)
  const pick = (riichi: boolean): Action | null => {
    const fits = choices.filter(allowed(riichi))
    const best = fits.filter((choice) => choice.shanten === fits[0].shanten && choice.left === fits[0].left)
    const choice = best[Math.floor(rng() * best.length)]
    const tile = choice && player.hand.find((held) => held.kind === choice.kind && legal.some((action) => action.type === "discard" && action.tile === held.id))
    return tile ? (riichi ? { type: "discard", tile: tile.id, riichi: true } : { type: "discard", tile: tile.id }) : null
  }
  const riichi = pick(true)
  const waiting = choices.find(allowed(true))
  if (riichi && waiting && waiting.left > 0) return riichi
  return pick(false) ?? legal[0]
}

const tileOf = (hand: Tile[], id: number) => hand.find((tile) => tile.id === id)
