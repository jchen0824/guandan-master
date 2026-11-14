import { BIG_JOKER, SMALL_JOKER, rankLabel } from "../engine/cards"
import type { GameState } from "../engine/game"
import { HUMAN } from "./names"

function unseen(game: GameState) {
  const ranks = [BIG_JOKER, SMALL_JOKER, game.level]
  for (let r = 14; r >= 2; r--) if (r !== game.level) ranks.push(r)
  const gone = new Map<number, number>()
  const count = (rank: number) => gone.set(rank, (gone.get(rank) ?? 0) + 1)
  game.hands[HUMAN].forEach((c) => count(c.rank))
  game.log.forEach((record) => record.combo?.cards.forEach((c) => count(c.rank)))
  return ranks.map((rank) => ({
    rank,
    label: rank === BIG_JOKER ? "大" : rank === SMALL_JOKER ? "小" : rankLabel(rank),
    left: (rank >= SMALL_JOKER ? 2 : 8) - (gone.get(rank) ?? 0),
  }))
}

function Tracker({ game }: { game: GameState }) {
  return (
    <dl data-slot="tracker" aria-label="记牌器：其他三家手里还剩的牌">
      {unseen(game).map((cell) => (
        <div key={cell.rank} data-none={cell.left === 0 ? "" : undefined} data-joker={cell.rank >= SMALL_JOKER ? "" : undefined}>
          <dt>{cell.label}</dt>
          <dd>{cell.left}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Tracker }
