import { comboTypeName } from "../engine/combos"
import type { Combo } from "../engine/combos"
import type { GameState, PlayRecord } from "../engine/game"
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
function BombMoment({ game, table }: { game: GameState; table: (PlayRecord | null)[] }) {
  const bomb = useFreshBomb(game)
  if (!bomb) return null
  const at = rung(bomb.combo)
  return (
    // Keyed by the play, so a second bomb starts the moment again. The cards on the felt already name the play to a screen reader.
    <div key={bomb.combo.cards[0].id} data-slot="bomb-moment" aria-hidden="true">
      <p data-slot="bomb-banner">
        <b>{comboTypeName(bomb.combo.type)}</b>
        <span>{bombNote(bomb, table, game.level)}</span>
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
