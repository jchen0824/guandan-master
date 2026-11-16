import type { GameState } from "../engine/game"
import { PLACE_NAMES, SEAT_NAMES, SIDES } from "./names"

function Player({ game, seat }: { game: GameState; seat: number }) {
  const place = game.finished.indexOf(seat)
  const active = game.phase === "play" && game.turn === seat
  const left = game.hands[seat].length
  return (
    <div
      data-slot="player"
      data-side={SIDES[seat]}
      data-team={seat % 2 === 0 ? "us" : "them"}
      data-active={active ? "" : undefined}
    >
      <span data-slot="avatar" aria-hidden="true">
        {SEAT_NAMES[seat].slice(0, 1)}
      </span>
      <strong data-slot="player-name">
        {SEAT_NAMES[seat]}
        <span data-slot="player-role">{seat % 2 === 0 ? "队友" : "对手"}</span>
      </strong>
      {place >= 0 ? (
        <span data-slot="place">{PLACE_NAMES[place]}</span>
      ) : (
        <span data-slot="count" data-low={left <= 10 ? "" : undefined}>
          剩 {left} 张
        </span>
      )}
    </div>
  )
}

export { Player }
