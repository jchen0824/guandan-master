import { cardName, chips } from "./cards"
import { startingTier } from "./bot"
import { BIG_BLIND, HERO, SEAT_NAMES, SEATS, describeAction, lastWhere, legalActions, positionName } from "./game"
import type { Action, HoldemState } from "./game"
import { evaluate } from "./hands"
import type { HandCategory } from "./hands"
import { draws, potOdds, shareOfPot } from "./odds"
import { Strength, countOuts, readHand, readOpponents, ruleOfThumb } from "./read"

export interface Advice {
  action: Action
  /** 建议：跟注 */
  title: string
  /** One or two plain sentences a beginner can follow. */
  reason: string
  /** The win rate a call needs, or null when there is nothing to call. */
  need: number | null
  /** The hero's estimated win rate. */
  have: number
  /** What the hero holds now. */
  made: HandCategory
  /** What the hand is drawing to, if anything. */
  drawText: string | null
  /** What just happened at the table. */
  situation: string
  reminder: string | null
  /**
   * The coach's working after the flop, so the player can learn to do it without a computer: 你的牌, 能帮你的牌,
   * 对手 and 估算 (the 2-and-4 rule, with the simulated win rate beside it). Empty before the flop.
   */
  explain: { key: "hand" | "outs" | "opponents" | "estimate" | "gap"; label: string; text: string }[]
}

const percent = (value: number) => `${Math.round(value * 100)}%`

function label(state: HoldemState, action: Action): string {
  if (action.kind === "fold") return "弃牌"
  if (action.kind === "check") return "过牌"
  if (action.kind === "call") return `跟注 ${chips(potOdds(state).call)}`
  return state.currentBet === 0 ? `下注 ${chips(action.to)}` : `加注到 ${chips(action.to)}`
}

/** A raise the rules allow, nearest to `to` and rounded to 10 chips. Falls back to a call or a check. */
function raiseTo(state: HoldemState, to: number): Action {
  const legal = legalActions(state)
  if (legal.minRaiseTo === null || legal.maxRaiseTo === null) return legal.callAmount > 0 ? { kind: "call" } : { kind: "check" }
  return { kind: "raise", to: Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(to / 10) * 10)) }
}

function situation(state: HoldemState): string {
  const pot = `底池现在 ${chips(state.pot)}`
  const last = lastWhere(state.log, (entry) => entry.street === state.street && (entry.kind === "bet" || entry.kind === "raise") && entry.seat !== HERO)
  if (last) return `${SEAT_NAMES[last.seat]}${describeAction(last)}，${pot}。`
  return state.street === "preflop" ? `前面还没有人加注，${pot}。` : `还没有人下注，${pot}。`
}

const TIER_WORDS = ["比较弱的牌", "能玩的牌", "一手好牌", "顶尖的起手牌"]

function beforeTheFlop(state: HoldemState): Pick<Advice, "action" | "reason"> {
  const hole = state.seats[HERO].hole
  const legal = legalActions(state)
  const tier = startingTier(hole)
  const fromButton = (HERO - state.button + SEATS) % SEATS
  const late = fromButton === 0 || fromButton === 5
  const blind = fromButton === 1 || fromButton === 2
  const cards = `${cardName(hole[0])}、${cardName(hole[1])}是${TIER_WORDS[tier]}`
  const seat = `你在${positionName(state, HERO)}${late ? "，后面行动，能先看别人怎么做" : blind ? "，已经放了盲注" : "，后面还有好几个人没行动"}`
  const stay: Action = legal.canCheck ? { kind: "check" } : { kind: "fold" }

  if (state.currentBet <= BIG_BLIND) {
    if (tier >= 2) return { action: raiseTo(state, BIG_BLIND * 3 + (state.pot - 30)), reason: `${cards}。主动加注，让差的牌要么弃掉、要么付钱来看。` }
    if (tier === 1 && late) return { action: raiseTo(state, BIG_BLIND * 3), reason: `${cards}，${seat}。在这个位置可以加注争取主动。` }
    if (tier === 1 && legal.canCheck) return { action: { kind: "check" }, reason: `${cards}。不用再花钱，过牌看翻牌。` }
    if (tier === 1 && blind) return { action: { kind: "call" }, reason: `${cards}，${seat}。补一点就能看翻牌，可以跟。` }
    if (legal.canCheck) return { action: { kind: "check" }, reason: `${cards}，不过可以免费看翻牌，过牌就行。` }
    return { action: { kind: "fold" }, reason: `${cards}，${seat}。这样的牌打下去多半要亏，弃掉等下一手。` }
  }
  const price = legal.callAmount / BIG_BLIND
  if (tier === 3) return { action: raiseTo(state, state.currentBet * 3), reason: `${cards}。有人加注也不用怕，再加注把钱打进去。` }
  if (tier === 2 && price <= 5) return { action: { kind: "call" }, reason: `${cards}，${seat}。跟注看翻牌，中了再继续。` }
  if (tier === 1 && price <= 3 && (late || blind)) return { action: { kind: "call" }, reason: `${cards}，${seat}，跟注也不贵，可以看一眼翻牌。` }
  return { action: stay, reason: `${cards}，面对加注不够好。弃掉，把筹码留给更好的机会。` }
}

function afterTheFlop(state: HoldemState, have: number, drawText: string | null): Pick<Advice, "action" | "reason"> {
  const { call, potAfterCall, need } = potOdds(state)
  const mine = `你的胜率大约 ${percent(have)}`
  if (call === 0) {
    if (have >= 0.6) return { action: raiseTo(state, state.pot * 0.66), reason: `${mine}，多半是你领先。下注，让差一点的牌付钱来看。` }
    return { action: { kind: "check" }, reason: `${mine}，还不够主动下注。过牌，免费看下一张。` }
  }
  const price = `花 ${chips(call)} 去赢 ${chips(potAfterCall)}，要有 ${percent(need)} 的胜率才不亏`
  if (have >= 0.75) return { action: raiseTo(state, state.currentBet * 2.5 + state.pot * 0.3), reason: `${mine}，远高于需要的 ${percent(need)}。加注，把底池做大。` }
  if (have >= need + 0.03) return { action: { kind: "call" }, reason: `${price}。${mine}，比需要的高，这样跟下去长期是赚的。` }
  if (have >= need) return { action: { kind: "call" }, reason: `${price}。${mine}，刚好够，跟注稍微划算。` }
  // A draw may call a little below the price only when hitting it can still win more: the hero and someone
  // still in the hand both keep chips after this call. Against an all-in there is no later betting.
  const later = state.seats[HERO].stack > call && state.seats.some((seat, index) => index !== HERO && !seat.folded && seat.stack > 0)
  if (drawText && later && have >= need - 0.06) {
    return { action: { kind: "call" }, reason: `${price}。${mine}，差一点；不过你${drawText.split("，")[0]}，中了还能再赢一笔，可以跟。` }
  }
  return { action: { kind: "fold" }, reason: `${price}。${mine}，不够。弃牌，少输就是赢。` }
}

/** The working behind a win rate after the flop, in the steps a player can do at the table. */
function explain(state: HoldemState, have: number): Advice["explain"] {
  const { hole } = state.seats[HERO]
  const read = readHand(hole, state.board)
  const outs = countOuts(hole, state.board)
  const lines: Advice["explain"] = [{ key: "hand", label: "你的牌", text: read.text }]
  if (outs.text) lines.push({ key: "outs", label: "能帮你的牌", text: outs.text })
  else if (read.strength < Strength.Strong) lines.push({ key: "outs", label: "能帮你的牌", text: "没有一张牌能明显帮到你" })
  lines.push({ key: "opponents", label: "对手", text: readOpponents(state, read.strength) })
  const simulated = `电脑模拟约 ${percent(have)}`
  if (read.strength >= Strength.TopPair) {
    lines.push({ key: "estimate", label: "估算", text: `你多半已经领先，不用数有效牌，要担心的是比你大的牌（${simulated}）` })
    return lines
  }
  const { times, percent: rough } = ruleOfThumb(outs.count, state.board)
  if (outs.count > 0) {
    const left = times === 4 ? "还有转牌和河牌两张" : "只剩河牌一张"
    lines.push({ key: "estimate", label: "估算", text: `${left}，二四法则：${outs.count} 张有效牌 × ${times} ≈ ${rough}%（${simulated}）` })
  } else {
    lines.push({ key: "estimate", label: "估算", text: `没有有效牌，只能靠对手在诈唬（${simulated}）` })
  }
  // The rule counts only cards that make a solid hand; the simulation also counts the times the opponents have less.
  const gap = Math.round(have * 100) - rough
  if (gap > 8) lines.push({ key: "gap", label: "为什么不同", text: "电脑模拟更高：它也算上了对手牌更差、或者只是在诈唬的时候，这时你不中牌也能赢" })
  if (gap < -8) {
    // Times 4 counts a card that comes on both the turn and the river twice, which adds up once there are many outs.
    const many = times === 4 && outs.count > 8 ? "有效牌多于 8 张时，乘 4 会算多；而且" : ""
    lines.push({ key: "gap", label: "为什么不同", text: `电脑模拟更低：${many}有些有效牌中了也未必赢，比如对手的牌更大` })
  }
  return lines
}

/** What the coach would do in the hero's place, and why. Call it when it is the hero's turn. */
export function advise(state: HoldemState, rng: () => number): Advice {
  const me = state.seats[HERO]
  const have = shareOfPot(state, HERO, rng, 400)
  const drawn = draws(me.hole, state.board)
  const { call, need } = potOdds(state)
  const { action, reason } = state.street === "preflop" ? beforeTheFlop(state) : afterTheFlop(state, have, drawn.text)
  const behind = state.pending.filter((seat) => seat !== HERO)
  return {
    explain: state.street === "preflop" ? [] : explain(state, have),
    action,
    title: `建议：${label(state, action)}`,
    reason,
    need: call > 0 ? need : null,
    have,
    made: evaluate([...me.hole, ...state.board]).category,
    drawText: drawn.text,
    situation: situation(state),
    reminder: behind.length > 0 ? `${behind.map((seat) => SEAT_NAMES[seat]).join("、")}在你后面还没行动。要是有人加注，得重新算一次。` : null,
  }
}

export interface Grade {
  verdict: "good" | "ok" | "poor"
  /** 好 可以 欠妥 */
  label: string
  note: string
}

const LABELS = { good: "好", ok: "可以", poor: "欠妥" }
const grade = (verdict: Grade["verdict"], note: string): Grade => ({ verdict, label: LABELS[verdict], note })

/** How the hero's choice compares with the coach's advice for the same spot. */
export function gradeChoice(advice: Advice, chosen: Action): Grade {
  const told = advice.action.kind
  const did = chosen.kind
  const margin = advice.need === null ? 0 : advice.have - advice.need
  if (told === did) return grade("good", advice.reason)
  if (did === "fold") {
    if (told === "check") return grade("poor", "可以免费看牌的时候不用弃牌，过牌就行。")
    return margin > 0.1 || told === "raise" ? grade("poor", `这手牌的胜率大约 ${percent(advice.have)}，弃掉可惜了。${advice.reason}`) : grade("ok", `弃牌稳妥，不过这里跟注是划算的。${advice.reason}`)
  }
  if (told === "fold") {
    return margin > -0.08 && did === "call" ? grade("ok", `差得不多，偶尔跟一次问题不大。${advice.reason}`) : grade("poor", advice.reason)
  }
  if (told === "raise") return grade("ok", `这样也行，只是牌好的时候加注能多赢一些。${advice.reason}`)
  if (did === "raise") return grade("ok", `主动一点也可以，但胜率只有大约 ${percent(advice.have)}，被跟注或者再加注会比较难打。`)
  return grade("ok", advice.reason)
}
