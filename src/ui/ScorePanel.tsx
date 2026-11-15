import { rankLabel } from "../engine/cards"
import type { GameState } from "../engine/game"
import { TEAM_NAMES } from "./names"

const MEMBERS = ["你、对家", "上家、下家"]

/** The score card of the 3D table: the level in play, the wild card, and both teams' levels. */
function ScorePanel({ game }: { game: GameState }) {
  return (
    <section data-slot="score-panel" aria-label="比分">
      <p data-slot="score-level">
        <span>本局打</span>
        <b>{rankLabel(game.level)}</b>
        <span data-slot="score-wild">
          逢人配 <b>♥{rankLabel(game.level)}</b>
        </span>
      </p>
      <dl>
        {TEAM_NAMES.map((name, team) => (
          <div key={name}>
            <dt>
              {name} <span>{MEMBERS[team]}</span>
            </dt>
            <dd>{rankLabel(game.levels[team])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export { ScorePanel }
