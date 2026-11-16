import { useState } from "react"
import { comboTypeName } from "../engine/combos"
import type { Combo } from "../engine/combos"
import type { GameState } from "../engine/game"
import { SEAT_NAMES } from "./names"
import { bombNote } from "./situation"
import { useFreshBomb } from "./useFreshBomb"

const LADDER = ["四张", "五张", "同花顺", "六张及以上", "四个王"]

function rung(combo: Combo): number {
  if (combo.type === "jokerBomb") return 4
  if (combo.type === "straightFlush") return 2
  return combo.size >= 6 ? 3 : combo.size - 4
}

/** The moment a bomb lands on the 3D table: its name across the table, what it beat, and where it ranks among bombs. */
function BombMoment({ game }: { game: GameState }) {
  const bomb = useFreshBomb(game)
  const [over, setOver] = useState<Combo | null>(null)
  if (!bomb || bomb.combo === over) return null
  const at = rung(bomb.combo)
  return (
    // Keyed by the play, so a second bomb starts the moment again. The cards on the felt already name the play to a screen reader.
    <div key={bomb.combo.cards[0].id} data-slot="bomb-moment" aria-hidden="true">
      {/* The moment leaves the page when the banner has faded: while it is here, index.css hides the tag under it. */}
      <p data-slot="bomb-banner" onAnimationEnd={() => setOver(bomb.combo)}>
        <b>{comboTypeName(bomb.combo.type)}</b>
        <span>{bombNote(bomb, game.log, game.level)}</span>
      </p>
      <div data-slot="bomb-ladder">
        <span>炸弹从小到大</span>
        <ol>
          {LADDER.map((name, i) => (
            <li key={name} data-current={i === at ? "" : undefined}>
              <span>{name}</span>
              {i === at ? <span>{SEAT_NAMES[bomb.player]}刚出的</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export { BombMoment }
