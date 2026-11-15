import { cardShort } from "../engine/cards"
import { describeCombo } from "../engine/combos"
import type { GameState } from "../engine/game"
import { SEAT_NAMES } from "./names"
import { tributeLines } from "./tribute"

/** This hand from the start: the tribute, then every play and pass in order. */
function PlayLog({ game }: { game: GameState }) {
  const tribute = tributeLines(game)
  return (
    <>
      {tribute.length > 0 ? (
        <>
          <h3>进贡记录</h3>
          <ul data-slot="review-tribute">
            {tribute.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>出牌记录</h3>
      {game.log.length === 0 ? <p data-slot="review-empty">本局还没有人出牌。</p> : null}
      <ol data-slot="review-log">
        {game.log.map((record, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- the log only grows, so position is identity
          <li key={index} data-pass={record.combo ? undefined : ""}>
            {SEAT_NAMES[record.player]}：
            {record.combo
              ? `${describeCombo(record.combo, game.level)}（${record.combo.cards.map(cardShort).join(" ")}）`
              : "不出"}
          </li>
        ))}
      </ol>
    </>
  )
}

export { PlayLog }
