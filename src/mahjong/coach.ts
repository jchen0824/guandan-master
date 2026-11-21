// The coach: what it would do on the player's turn, and why, in words for a beginner. It sees what the player
// sees (their hand, every 牌河 and call, the 宝牌 indicators) and nothing else.
import { discardChoices, visibleCounts } from "./efficiency"
import type { DiscardChoice } from "./efficiency"
import { HERO, SEAT_NAMES, legalActions, seatWind } from "./game"
import type { Action, MahjongState } from "./game"
import { EAST, indexOf, isDragon, isHonor, kindName } from "./tiles"
import type { Kind } from "./tiles"

/**
 * How likely a discard is to deal into a seat that has declared 立直. `safe` is 现物 (that seat cannot win on it),
 * `suji` is 筋 (it cannot be a two-sided wait), `honor` an honour tile already seen twice, `danger` anything else.
 */
export type Safety = "safe" | "suji" | "honor" | "danger"
const RISK: Record<Safety, number> = { safe: 0, suji: 1, honor: 1, danger: 3 }
export const SAFETY_NAMES: Record<Safety, string> = { safe: "现物", suji: "筋", honor: "熟字牌", danger: "危险" }

export interface DiscardOption extends DiscardChoice {
  /** Against the seats in 立直, or null when nobody is. */
  safety: Safety | null
}

export type Advice =
  | {
      kind: "discard"
      /** The tile kind to discard. */
      pick: Kind
      /** Declare 立直 with it. */
      riichi: boolean
      /** 攻: play for the hand. 守: give it up for a safe tile. */
      stance: "attack" | "defend"
      /** Every kind in hand, the coach's pick first, then by how well the hand is left. */
      options: DiscardOption[]
      reason: string
    }
  | { kind: "answer"; pick: Action; reason: string }

const risk = (option: DiscardOption) => (option.safety ? RISK[option.safety] : 0)

const SHANTEN_NAMES = ["听牌", "一向听", "两向听", "三向听", "四向听", "五向听", "六向听"]
/** 听牌, 一向听, 两向听: how far a hand is from 听牌, in the words players use. */
export const shantenName = (shanten: number) => SHANTEN_NAMES[Math.max(0, shanten)] ?? `${shanten} 向听`

/** The kinds a seat in 立直 cannot win on: its own discards, and everything discarded since it declared. */
function safeAgainst(state: MahjongState, seat: number): Set<Kind> {
  const safe = new Set(state.players[seat].river.map((discard) => discard.tile.kind))
  const declared = state.actions.findIndex((entry) => entry.seat === seat && entry.action.type === "discard" && entry.action.riichi)
  for (const entry of state.actions.slice(declared + 1)) {
    if (entry.action.type === "discard") safe.add(entry.action.tile >> 2)
  }
  return safe
}

function safetyOf(kind: Kind, safe: Set<Kind>, seen: number[]): Safety {
  if (safe.has(kind)) return "safe"
  if (isHonor(kind)) return seen[kind] >= 2 ? "honor" : "danger"
  const at = indexOf(kind)
  const below = at < 3 || safe.has(kind - 3)
  const above = at > 5 || safe.has(kind + 3)
  return below && above ? "suji" : "danger"
}

function discardAdvice(state: MahjongState, seat: number): Advice {
  const legal = legalActions(state, seat)
  const allowed = (kind: Kind, riichi: boolean) =>
    legal.some((action) => action.type === "discard" && (action.riichi === true) === riichi && action.tile >> 2 === kind)
  const threats = [0, 1, 2, 3].filter((other) => other !== seat && state.players[other].riichi > 0)
  const seen = visibleCounts(state, seat)
  const safes = threats.map((threat) => safeAgainst(state, threat))
  const worst = (kind: Kind): Safety | null =>
    threats.length === 0 ? null : safes.map((safe) => safetyOf(kind, safe, seen)).reduce((a, b) => (RISK[b] > RISK[a] ? b : a))
  const options = discardChoices(state, seat)
    .filter((choice) => allowed(choice.kind, false))
    .map((choice): DiscardOption => Object.assign({}, choice, { safety: worst(choice.kind) }))
  const best = options[0]
  const mine = state.players[seat].riichi > 0
  const who = threats.map((threat) => SEAT_NAMES[threat]).join("、")
  const defend = !mine && threats.length > 0 && (best.shanten >= 2 || (best.shanten === 1 && risk(best) >= 3))
  if (defend) {
    const safest = options.slice().sort((a, b) => risk(a) - risk(b) || a.shanten - b.shanten || b.left - a.left)[0]
    const rest = options.filter((option) => option !== safest)
    const why = safest.safety === "safe" ? `${who}打过或放过这张，是现物，绝对不会放铳` : safest.safety ? `它是${SAFETY_NAMES[safest.safety]}，相对安全` : ""
    return {
      kind: "discard",
      pick: safest.kind,
      riichi: false,
      stance: "defend",
      options: [safest, ...rest],
      reason: `${who}立直了。你离听牌还有${best.shanten === 1 ? "一步" : "好几步"}，先守：打${kindName(safest.kind)}。${why}。`,
    }
  }
  const riichi = allowed(best.kind, true) && best.left > 0
  const efficiency = best.shanten === 0 ? `听牌，等 ${best.useful.length} 种 ${best.left} 张` : `${shantenName(best.shanten)}，进张 ${best.useful.length} 种 ${best.left} 张`
  const lead = threats.length > 0 ? `${who}立直了，但你的牌够近，可以攻。` : ""
  const close = riichi ? "门前清听牌，立直多一番。" : best.shanten === 0 && best.left === 0 ? "要的牌已经没有了，先这样等。" : ""
  return {
    kind: "discard",
    pick: best.kind,
    riichi,
    stance: "attack",
    options,
    reason: `${lead}打${kindName(best.kind)}，打完${efficiency}。${close}`,
  }
}

function answerAdvice(state: MahjongState, seat: number, legal: Action[]): Advice {
  const ron = legal.find((action) => action.type === "ron")
  if (ron) return { kind: "answer", pick: ron, reason: "这张牌能和，荣和。" }
  const kind = state.pending?.tile.kind ?? -1
  const valued = isDragon(kind) || kind === seatWind(state, seat) || kind === EAST + state.round
  const pon = legal.find((action) => action.type === "pon")
  if (pon && valued) return { kind: "answer", pick: pon, reason: `${kindName(kind)}是役牌，碰了就有役，以后吃碰也能和。` }
  return { kind: "answer", pick: { type: "pass" }, reason: "先不鸣牌：鸣了就不能立直，手里又没有别的役，会和不了。" }
}

/** What the coach would do for the seat now, or null when the seat has nothing to decide. */
export function advise(state: MahjongState, seat: number = HERO): Advice | null {
  const legal = legalActions(state, seat)
  if (legal.length === 0) return null
  if (state.phase === "call") return answerAdvice(state, seat, legal)
  const tsumo = legal.find((action) => action.type === "tsumo")
  if (tsumo) return { kind: "answer", pick: tsumo, reason: "摸到了要的牌，自摸。" }
  return legal.some((action) => action.type === "discard") ? discardAdvice(state, seat) : null
}
