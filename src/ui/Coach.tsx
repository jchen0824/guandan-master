import { Button } from "@ui-sdk/react/button"
import { bombPower, describeCombo, legalPlays } from "../engine/combos"
import type { GameState } from "../engine/game"
import { HUMAN, SEAT_NAMES } from "./names"
import type { Game } from "./useGame"

const BOMB_LADDER = [
  ["四大天王", "最大"],
  ["六张及以上", "张数多者大"],
  ["同花顺", "压四张、五张"],
  ["五张炸弹", ""],
  ["四张炸弹", "最小"],
]

interface Situation {
  /** Status only, with no advice. */
  plain: string
  short: string
  long: string
}

function describeSituation(game: GameState, myTurn: boolean, mustReturn: boolean): Situation {
  if (game.phase === "return") {
    const short = mustReturn ? "请选一张10或更小的牌还贡。" : "等待还贡…"
    return {
      plain: short,
      short,
      long: "进贡阶段：输家把最大的牌交给赢家，赢家还一张10或更小的牌。",
    }
  }
  if (game.phase !== "play") {
    return { plain: "本局结束。", short: "本局结束。", long: "本局结束，看看复盘里四家的起手牌和出牌记录。" }
  }
  if (!myTurn) {
    const short = game.finished.includes(HUMAN) ? "你已出完牌，等待本局结束。" : `等待${SEAT_NAMES[game.turn]}出牌…`
    return { plain: short, short, long: `等待${SEAT_NAMES[game.turn]}出牌。趁这时候看看记牌器，想想谁手里还有大牌。` }
  }
  if (!game.lastPlay) {
    return {
      plain: "轮到你首出。",
      short: "轮到你首出，可以出任意牌型。",
      long: "你首出，可以出任意牌型。一般先送走小的单张、对子，或者出别人不好接的长牌型，把大牌和炸弹留到后面。",
    }
  }
  const target = game.lastPlay.combo
  const distinct = new Map(
    legalPlays(game.hands[HUMAN], game.level, target).map((o) => [`${o.type}:${o.size}:${o.rank}`, o]),
  )
  const options = [...distinct.values()]
  const bombs = options.filter((o) => bombPower(o) > 0).length
  const table = `桌上是${SEAT_NAMES[game.lastPlay.player]}的${describeCombo(target, game.level)}。`
  const plain = `${table}轮到你出牌。`
  if (options.length === 0) {
    const text = `${table}你没有能压住的牌，只能不出。`
    return { plain, short: text, long: text }
  }
  if (bombs === options.length) {
    const text = `${table}你只有炸弹能压（${bombs} 种），想清楚值不值得用。`
    return { plain, short: text, long: text }
  }
  const short = `${table}你有 ${options.length} 种压法${bombs > 0 ? `，其中 ${bombs} 种要用炸弹` : ""}。`
  return { plain, short, long: `${short}先自己想，再点“提示”对照。` }
}

function Coach({ g, onClose, onHide }: { g: Game; onClose: () => void; onHide: () => void }) {
  const { game } = g
  return (
    <aside data-slot="coach" aria-label="教练">
      <header data-slot="coach-header">
        <h2>教练</h2>
        <div data-slot="coach-buttons">
          <Button data-variant="text" onClick={onHide}>
            隐藏教练
          </Button>
          <Button data-variant="text" data-coach-close="" onClick={onClose}>
            收起
          </Button>
        </div>
      </header>
      <section>
        <h3>当前局面</h3>
        <p>{describeSituation(game, g.myTurn, g.mustReturn).long}</p>
      </section>
      <section>
        <h3>点评</h3>
        {g.feedback.length === 0 ? (
          <p data-slot="coach-empty">你每出一手牌，教练都会告诉你它会怎么出、为什么。</p>
        ) : (
          <ul data-slot="coach-feedback">
            {g.feedback.map((item) => (
              <li key={item.id} data-agreed={item.agreed ? "" : undefined}>
                <strong>{item.agreed ? "好棋" : "可以更好"}</strong>
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>炸弹大小</h3>
        <ol data-slot="ladder">
          {BOMB_LADDER.map(([name, note]) => (
            <li key={name}>
              <span>{name}</span>
              <span>{note}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}

export { Coach, describeSituation }
