import { bombPower, describeCombo, legalPlays } from "../engine/combos"
import type { GameState } from "../engine/game"
import { HUMAN, SEAT_NAMES, TEAM_NAMES } from "./names"

interface Situation {
  /** Status only, with no advice. */
  plain: string
  short: string
  long: string
}

export function describeSituation(game: GameState, myTurn: boolean, mustReturn: boolean): Situation {
  if (game.phase === "return") {
    const short = mustReturn ? "请选一张10或更小的牌还贡。" : "等待还贡…"
    return {
      plain: short,
      short,
      long: "进贡阶段：输家把最大的牌交给赢家，赢家还一张10或更小的牌。",
    }
  }
  if (game.phase !== "play") {
    const won = game.result ? `${TEAM_NAMES[game.result.winnerTeam]}获胜。` : ""
    const short = `本局结束，${won}看完牌桌再点“查看结果”。`
    return { plain: short, short, long: `本局结束，${won}不用急：先看看牌桌上最后几手牌，再点“查看结果”看名次、升级和四家的起手牌。` }
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

/** The one-line status above the action buttons of the 3D table. */
export function turnNote(game: GameState, myTurn: boolean, mustReturn: boolean): string {
  if (game.phase === "return") return mustReturn ? "请还贡" : "等待还贡"
  if (game.phase !== "play") return "本局结束"
  if (!myTurn) return game.finished.includes(HUMAN) ? "你已出完牌" : `等${SEAT_NAMES[game.turn]}出牌`
  if (!game.lastPlay) return "轮到你首出"
  return `轮到你 · 要压过${SEAT_NAMES[game.lastPlay.player]}的${describeCombo(game.lastPlay.combo, game.level)}`
}
