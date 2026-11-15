import type { GameState } from "../engine/game"
import { unseen } from "./unseen"

function Tracker({ game }: { game: GameState }) {
  return (
    <dl data-slot="tracker" aria-label="记牌器：其他三家手里还剩的牌">
      {unseen(game).map((cell) => (
        <div key={cell.key} data-none={cell.left === 0 ? "" : undefined} data-kind={cell.kind}>
          <dt title={cell.name} aria-label={cell.name}>
            {cell.label}
          </dt>
          <dd>{cell.left}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Tracker }
