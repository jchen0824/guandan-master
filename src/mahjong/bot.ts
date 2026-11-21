// The computer players. They see what a player at the table sees: their own hand, the 牌河, the calls and the
// 宝牌 indicators. They never read another seat's hand or the wall.
import { advise } from "./coach"
import { discardChoices } from "./efficiency"
import type { DiscardChoice } from "./efficiency"
import { legalActions, seatWind } from "./game"
import type { Action, MahjongState } from "./game"
import { EAST, isDragon } from "./tiles"
import type { Kind } from "./tiles"

/** 新手, 普通 and 进阶. */
export type BotSkill = "novice" | "basic" | "advanced"
export const BOT_SKILLS: readonly BotSkill[] = ["novice", "basic", "advanced"]

const discardOf = (legal: Action[], kind: Kind, riichi: boolean) =>
  legal.find((action) => action.type === "discard" && (action.riichi === true) === riichi && action.tile >> 2 === kind)

/**
 * The action a computer player takes. `rng` breaks ties, so two players do not move in step.
 * 新手 looks only at 向听, not at how many tiles help, calls 碰 on anything and never gives up a hand.
 * 普通 plays for the fastest hand, calls only 役牌 and never gives up a hand.
 * 进阶 does what the coach would: the fastest hand, or a safe tile when someone has declared 立直 and its own hand is far.
 */
export function botAction(state: MahjongState, seat: number, rng: () => number, skill: BotSkill = "basic"): Action {
  const legal = legalActions(state, seat)
  const win = legal.find((action) => action.type === "tsumo" || action.type === "ron")
  if (win) return win
  if (state.phase === "call") {
    const kind = state.pending?.tile.kind ?? -1
    const valued = isDragon(kind) || kind === seatWind(state, seat) || kind === EAST + state.round
    const pon = legal.find((action) => action.type === "pon")
    return pon && (valued || skill === "novice") ? pon : { type: "pass" }
  }
  if (skill === "advanced") {
    const advice = advise(state, seat)
    const pick = advice?.kind === "discard" ? (discardOf(legal, advice.pick, advice.riichi) ?? discardOf(legal, advice.pick, false)) : undefined
    if (pick) return pick
  }
  const choices = discardChoices(state, seat).filter((choice) => discardOf(legal, choice.kind, false))
  const same = (choice: DiscardChoice) => choice.shanten === choices[0].shanten && (skill === "novice" || choice.left === choices[0].left)
  const best = choices.filter(same)
  const choice = best[Math.floor(rng() * best.length)]
  if (!choice) return legal[0]
  const riichi = discardOf(legal, choice.kind, true)
  return riichi && (skill === "novice" || choice.left > 0) ? riichi : (discardOf(legal, choice.kind, false) ?? legal[0])
}
