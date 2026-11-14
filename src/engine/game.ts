import { ACE, BIG_JOKER, buildDeck, cardValue, isWild, shuffle, sortHand } from "./cards"
import type { Card } from "./cards"
import { bombPower, classify, comboTypeName, describeCombo, readPlay } from "./combos"
import type { Combo } from "./combos"

export type Phase = "return" | "play" | "handOver" | "matchOver"

export interface Tribute {
  from: number
  to: number
  card: Card
  returned: Card | null
}

export interface PlayRecord {
  player: number
  combo: Combo | null
}

export interface HandResult {
  order: number[]
  winnerTeam: number
  gain: number
  levelsBefore: [number, number]
  levelsAfter: [number, number]
  notes: string[]
  matchWinner: number | null
}

export interface GameState {
  handNumber: number
  levels: [number, number]
  aFails: [number, number]
  /** Team whose level is in play, or null on the first hand. */
  declarer: number | null
  level: number
  hands: Card[][]
  dealt: Card[][]
  phase: Phase
  turn: number
  lastPlay: { player: number; combo: Combo } | null
  passes: number
  finished: number[]
  tributes: Tribute[]
  tributeResisted: boolean
  leader: number
  log: PlayRecord[]
  result: HandResult | null
}

export const teamOf = (player: number) => player % 2
export const partnerOf = (player: number) => (player + 2) % 4
const nextSeat = (player: number) => (player + 1) % 4

function deal(random: () => number, level: number): Card[][] {
  const deck = shuffle(buildDeck(), random)
  return [0, 1, 2, 3].map((p) => sortHand(deck.slice(p * 27, p * 27 + 27), level))
}

export function newMatch(random: () => number = Math.random): GameState {
  const hands = deal(random, 2)
  const leader = Math.floor(random() * 4)
  return {
    handNumber: 1,
    levels: [2, 2],
    aFails: [0, 0],
    declarer: null,
    level: 2,
    hands,
    dealt: hands.map((h) => h.slice()),
    phase: "play",
    turn: leader,
    lastPlay: null,
    passes: 0,
    finished: [],
    tributes: [],
    tributeResisted: false,
    leader,
    log: [],
    result: null,
  }
}

export function tributeCard(hand: Card[], level: number): Card {
  return sortHand(hand.filter((c) => !isWild(c, level)), level)[0]
}

export function canReturn(hand: Card[], card: Card): boolean {
  if (card.rank <= 10) return true
  return !hand.some((c) => c.rank <= 10)
}

export function startNextHand(state: GameState, random: () => number = Math.random): GameState {
  if (state.phase !== "handOver" || !state.result) throw new Error("本局尚未结束。")
  const { order, winnerTeam } = state.result
  const level = state.levels[winnerTeam]
  const hands = deal(random, level)
  const dealt = hands.map((h) => h.slice())
  const [first, second, third, fourth] = order
  const payers = teamOf(first) === teamOf(second) ? [third, fourth] : [fourth]
  const bigJokers = payers.flatMap((p) => hands[p]).filter((c) => c.rank === BIG_JOKER).length

  const tributes: Tribute[] = []
  let leader = first
  const resisted = bigJokers === 2
  if (!resisted) {
    const offers = payers.map((from) => ({ from, card: tributeCard(hands[from], level) }))
    if (offers.length === 2) {
      const diff = cardValue(offers[0].card, level) - cardValue(offers[1].card, level)
      const toWinner = diff !== 0 ? (diff > 0 ? 0 : 1) : offers[0].from === nextSeat(first) ? 0 : 1
      tributes.push({ ...offers[toWinner], to: first, returned: null })
      tributes.push({ ...offers[1 - toWinner], to: second, returned: null })
    } else {
      tributes.push({ ...offers[0], to: first, returned: null })
    }
    leader = tributes[0].from
    for (const t of tributes) {
      hands[t.from] = hands[t.from].filter((c) => c.id !== t.card.id)
      hands[t.to] = sortHand([...hands[t.to], t.card], level)
    }
  }

  return {
    ...state,
    handNumber: state.handNumber + 1,
    declarer: winnerTeam,
    level,
    hands,
    dealt,
    phase: tributes.length > 0 ? "return" : "play",
    turn: leader,
    lastPlay: null,
    passes: 0,
    finished: [],
    tributes,
    tributeResisted: resisted,
    leader,
    log: [],
    result: null,
  }
}

export function returnTribute(state: GameState, player: number, cardId: number): GameState {
  if (state.phase !== "return") throw new Error("现在不需要还贡。")
  const index = state.tributes.findIndex((t) => t.to === player && !t.returned)
  if (index < 0) throw new Error("该玩家不需要还贡。")
  const card = state.hands[player].find((c) => c.id === cardId)
  if (!card) throw new Error("手牌中没有这张牌。")
  if (!canReturn(state.hands[player], card)) {
    throw new Error("还贡的牌必须是10或更小的牌。")
  }
  const tribute = state.tributes[index]
  const hands = state.hands.slice()
  hands[player] = hands[player].filter((c) => c.id !== cardId)
  hands[tribute.from] = sortHand([...hands[tribute.from], card], state.level)
  const tributes = state.tributes.map((t, i) => (i === index ? { ...t, returned: card } : t))
  const done = tributes.every((t) => t.returned)
  return { ...state, hands, tributes, phase: done ? "play" : "return" }
}

export type PlayCheck = { ok: true; combo: Combo } | { ok: false; reason: string }

export function checkPlay(state: GameState, player: number, cards: Card[]): PlayCheck {
  if (state.phase !== "play") return { ok: false, reason: "现在不能出牌。" }
  if (state.turn !== player) return { ok: false, reason: "还没轮到你。" }
  if (cards.length === 0) return { ok: false, reason: "请先选择要出的牌。" }
  const readings = classify(cards, state.level)
  if (readings.length === 0) {
    return {
      ok: false,
      reason:
        "这些牌不能组成牌型。合法牌型有：单张、对子、三张、三带二、五张顺子、三连对、钢板和炸弹。",
    }
  }
  const previous = state.lastPlay?.combo ?? null
  const combo = readPlay(cards, state.level, previous)
  if (combo) return { ok: true, combo }
  const mine = readings[0]
  const target = previous!
  const reason =
    bombPower(mine) > 0 && bombPower(target) > 0
      ? `你的${describeCombo(mine, state.level)}压不住桌上的${describeCombo(target, state.level)}。炸弹大小：四张 < 五张 < 同花顺 < 六张及以上 < 四大天王，同级比点数。`
      : mine.type === target.type
      ? `你的${describeCombo(mine, state.level)}压不住桌上的${describeCombo(target, state.level)}。`
      : `桌上是${comboTypeName(target.type)}，你需要出更大的${comboTypeName(target.type)}或炸弹，不能出${comboTypeName(mine.type)}。`
  return { ok: false, reason }
}

function isActive(state: GameState, player: number): boolean {
  return !state.finished.includes(player)
}

function nextActive(state: GameState, player: number): number {
  let p = nextSeat(player)
  while (!isActive(state, p)) p = nextSeat(p)
  return p
}

function settle(state: GameState, order: number[]): GameState {
  const winnerTeam = teamOf(order[0])
  const loserTeam = 1 - winnerTeam
  const gain = 4 - order.indexOf(partnerOf(order[0]))
  const levelsBefore: [number, number] = [state.levels[0], state.levels[1]]
  const levels: [number, number] = [state.levels[0], state.levels[1]]
  const aFails: [number, number] = [state.aFails[0], state.aFails[1]]
  const notes: string[] = []
  let matchWinner: number | null = null

  const playingOwnA = (team: number) => state.declarer === team && levels[team] === ACE
  if (playingOwnA(winnerTeam)) {
    if (gain >= 2) matchWinner = winnerTeam
    else {
      aFails[winnerTeam]++
      notes.push("头游一方正在打A，但对家是末游，未能过A。")
    }
  } else {
    levels[winnerTeam] = Math.min(ACE, levels[winnerTeam] + gain)
  }
  if (playingOwnA(loserTeam)) {
    aFails[loserTeam]++
    notes.push("打A的一方输掉本局，未能过A。")
  }
  for (const team of [0, 1]) {
    if (aFails[team] >= 3) {
      levels[team] = 2
      aFails[team] = 0
      notes.push("三次打A不过，该队退回打2。")
    }
  }

  return {
    ...state,
    levels,
    aFails,
    finished: order,
    phase: matchWinner === null ? "handOver" : "matchOver",
    lastPlay: null,
    result: { order, winnerTeam, gain, levelsBefore, levelsAfter: levels, notes, matchWinner },
  }
}

export function play(state: GameState, player: number, cards: Card[]): GameState {
  const check = checkPlay(state, player, cards)
  if (!check.ok) throw new Error(check.reason)
  const ids = new Set(cards.map((c) => c.id))
  const hands = state.hands.slice()
  hands[player] = hands[player].filter((c) => !ids.has(c.id))
  if (hands[player].length + cards.length !== state.hands[player].length) {
    throw new Error("这些牌不全在手牌中。")
  }
  const finished = hands[player].length === 0 ? [...state.finished, player] : state.finished
  const next: GameState = {
    ...state,
    hands,
    finished,
    lastPlay: { player, combo: check.combo },
    passes: 0,
    log: [...state.log, { player, combo: check.combo }],
  }
  if (finished.length === 2 && teamOf(finished[0]) === teamOf(finished[1])) {
    const rest = [0, 1, 2, 3].filter((p) => !finished.includes(p))
    return settle(next, [...finished, ...rest])
  }
  if (finished.length === 3) {
    return settle(next, [...finished, [0, 1, 2, 3].find((p) => !finished.includes(p))!])
  }
  return { ...next, turn: nextActive(next, player) }
}

export function pass(state: GameState, player: number): GameState {
  if (state.phase !== "play") throw new Error("现在不能过牌。")
  if (state.turn !== player) throw new Error("还没轮到你。")
  if (!state.lastPlay) throw new Error("你是首出，必须出牌。")
  const passes = state.passes + 1
  const log = [...state.log, { player, combo: null }]
  const owner = state.lastPlay.player
  const others = [0, 1, 2, 3].filter((p) => p !== owner && isActive(state, p)).length
  if (passes < others) return { ...state, passes, log, turn: nextActive(state, player) }
  const leader = isActive(state, owner) ? owner : partnerOf(owner)
  return { ...state, passes: 0, log, lastPlay: null, turn: leader }
}

/** What is kept between hands: enough to deal the next hand, and nothing about the cards. */
export interface MatchSave {
  version: 1
  savedAt: string
  handNumber: number
  levels: [number, number]
  aFails: [number, number]
  result: HandResult
}

export function toSave(state: GameState, now: Date = new Date()): MatchSave | null {
  if (state.phase !== "handOver" || !state.result) return null
  return {
    version: 1,
    savedAt: now.toISOString(),
    handNumber: state.handNumber,
    levels: state.levels,
    aFails: state.aFails,
    result: state.result,
  }
}

const isPair = (value: unknown, min: number, max: number): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n >= min && n <= max)

/** Checks a save read back from storage, which may be stale, hand-edited or from another version. */
export function parseSave(text: string | null): MatchSave | null {
  if (!text) return null
  try {
    const data = JSON.parse(text)
    const order = data?.result?.order
    const seats = Array.isArray(order) && order.length === 4 && [0, 1, 2, 3].every((p) => order.includes(p))
    const valid =
      data?.version === 1 &&
      Number.isInteger(data.handNumber) &&
      data.handNumber >= 1 &&
      isPair(data.levels, 2, ACE) &&
      isPair(data.aFails, 0, 2) &&
      seats &&
      data.result.matchWinner === null &&
      data.result.winnerTeam === teamOf(order[0])
    return valid ? (data as MatchSave) : null
  } catch {
    return null
  }
}

/** Deals the hand that follows a saved one, with tribute worked out from its finishing order. */
export function resumeMatch(save: MatchSave, random: () => number = Math.random): GameState {
  const ended: GameState = {
    handNumber: save.handNumber,
    levels: save.levels,
    aFails: save.aFails,
    declarer: save.result.winnerTeam,
    level: save.levels[save.result.winnerTeam],
    hands: [[], [], [], []],
    dealt: [[], [], [], []],
    phase: "handOver",
    turn: save.result.order[0],
    lastPlay: null,
    passes: 0,
    finished: save.result.order,
    tributes: [],
    tributeResisted: false,
    leader: save.result.order[0],
    log: [],
    result: save.result,
  }
  return startNextHand(ended, random)
}
