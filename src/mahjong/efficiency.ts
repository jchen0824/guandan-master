// What a seat can see, and how well each discard would leave its hand. The computer players and the coach both
// work from this, so neither can know more than a player at the table does.
import { indicatorTiles } from "./game"
import type { MahjongState } from "./game"
import { shanten, usefulKinds } from "./shanten"
import { countKinds, isHonor, isTerminal } from "./tiles"
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
