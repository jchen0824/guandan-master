// The riichi mahjong table: four seats, one hand at a time. `act` is the only way a hand moves on and
// `legalActions` says what a seat may do, so the screen, the computer players and the tests all go through them.
import { payments } from "./score"
import { shanten, waits } from "./shanten"
import { EAST, WIND_NAMES, byKind, countKinds, doraOf, fromSeed, indexOf, isHonor, isYaochu, newTiles, shuffle, suitOf } from "./tiles"
import type { Kind, Tile } from "./tiles"
import { seatWindOf, valueOf } from "./yaku"
import type { CalledSet, WinValue } from "./yaku"

export const HERO = 0
/** Seats in turn order. 下家 plays after the player and 上家 before, so the player may 吃 only from 上家. */
export const SEAT_NAMES = ["你", "下家", "对家", "上家"]
export const START_POINTS = 25000
const RIICHI_STICK = 1000
const NOTEN_PENALTY = 3000

/** Rounds in a match: 1 is 东风战, 2 is 半庄战. */
export type MatchLength = 1 | 2
export const MATCH_LENGTHS: readonly MatchLength[] = [1, 2]

export interface Discard {
  tile: Tile
  /** The discard that declared 立直. */
  riichi: boolean
  /** Discarded straight after drawing it. */
  tsumogiri: boolean
  /** Taken by another player's 吃, 碰 or 杠. It still counts for 振听. */
  called: boolean
}

export interface Meld {
  type: CalledSet["type"]
  /** Sorted, so the first is the lowest tile of a 吃. */
  tiles: Tile[]
  /** The seat the called tile came from, or null for a 暗杠. */
  from: number | null
}

export interface Player {
  /** Concealed tiles, sorted. On the player's turn it includes the tile just drawn. */
  hand: Tile[]
  melds: Meld[]
  river: Discard[]
  points: number
  /** 0 no 立直, 1 立直, 2 双立直. */
  riichi: 0 | 1 | 2
  ippatsu: boolean
  /** Let a winning tile go by since the last own discard: 同巡振听. */
  passed: boolean
  /** Let a winning tile go by after 立直: 振听 for the rest of the hand. */
  locked: boolean
}

export type Action =
  | { type: "discard"; tile: number; riichi?: true }
  | { type: "tsumo" }
  | { type: "ankan"; kind: Kind }
  | { type: "kakan"; kind: Kind }
  /** 九种九牌: end the hand on the first draw with nine or more kinds of 幺九牌. */
  | { type: "abort" }
  | { type: "ron" }
  | { type: "pon" }
  | { type: "kan" }
  /** `low` is the lowest tile of the run the 吃 makes. */
  | { type: "chi"; low: Kind }
  | { type: "pass" }

/** A discard, or a tile added to a 碰, that other seats may still claim. */
export interface Pending {
  tile: Tile
  from: number
  kakan: boolean
  /** What each seat may answer; empty for a seat with nothing to claim. */
  options: Action[][]
  answers: (Action | null)[]
  /** Seats whose hand this tile finishes, whether or not they may win on it. */
  waiting: boolean[]
}

export interface Win {
  seat: number
  /** The seat that discarded the tile, or null for 自摸. */
  from: number | null
  tile: Tile
  value: WinValue
  deltas: number[]
}

export type HandResult =
  | { kind: "win"; wins: Win[]; deltas: number[] }
  /** 荒牌流局: the wall ran out. */
  | { kind: "draw"; tenpai: boolean[]; deltas: number[] }
  /** 途中流局, with its Chinese name. */
  | { kind: "abort"; reason: string; deltas: number[] }

export interface MahjongState {
  players: Player[]
  length: MatchLength
  /** 0 for 东场, 1 for 南场. */
  round: number
  dealer: number
  firstDealer: number
  honba: number
  /** 立直 sticks on the table, for the next winner. */
  sticks: number
  /** Tiles still to draw. The next one is the last. */
  wall: Tile[]
  /** 王牌: four 岭上牌, five 宝牌 indicators, five 里宝牌 indicators. */
  dead: Tile[]
  /** How many 宝牌 indicators are face up. */
  indicators: number
  phase: "turn" | "call" | "over"
  /** The seat to discard, in the `turn` phase. */
  turn: number
  /** The tile that seat just drew, or null after a 吃 or 碰. */
  drawn: Tile | null
  /** `drawn` came from the dead wall after a 杠. */
  rinshan: boolean
  /** Kinds the seat may not discard right after its 吃 or 碰 (食替). */
  forbidden: Kind[]
  pending: Pending | null
  kans: number
  /** Nobody has called or declared a 杠 yet this hand. */
  uninterrupted: boolean
  result: HandResult | null
  /** The dealer stays for the next hand. */
  renchan: boolean
  /** The match is over. */
  over: boolean
  /** The points and the sticks on the table when this hand was dealt. */
  dealt: { points: number[]; sticks: number }
  /** The number the deal was shuffled from, and every action since: enough to replay the hand. */
  seed: number
  actions: { seat: number; action: Action }[]
}

const KAN_TYPES = new Set<Meld["type"]>(["minkan", "ankan", "kakan"])
const NUMBERS = ["一", "二", "三", "四"]

/** 0 to 3: which hand of the round this is. */
export const handNumber = (state: MahjongState) => (state.dealer - state.firstDealer + 4) % 4
/** 东一局, 南三局. */
export const handName = (state: MahjongState) => `${WIND_NAMES[state.round]}${NUMBERS[handNumber(state)]}局`
export const seatWind = (state: MahjongState, seat: number) => seatWindOf(seat, state.dealer)
/** The 宝牌 indicators that are face up. */
export const indicatorTiles = (state: MahjongState) => state.dead.slice(4, 4 + state.indicators)

function withPlayer(state: MahjongState, seat: number, change: Partial<Player>): MahjongState {
  return { ...state, players: state.players.map((player, i) => (i === seat ? { ...player, ...change } : player)) }
}

function without(hand: Tile[], kind: Kind, count: number): { taken: Tile[]; rest: Tile[] } {
  const taken = hand.filter((tile) => tile.kind === kind).slice(0, count)
  return { taken, rest: hand.filter((tile) => !taken.includes(tile)) }
}

function draw(state: MahjongState, seat: number): MahjongState {
  const tile = state.wall[state.wall.length - 1]
  const hand = [...state.players[seat].hand, tile].sort(byKind)
  // 同巡振听 lasts until the seat draws again, so a call in between does not lift it.
  return { ...withPlayer(state, seat, { hand, passed: false }), wall: state.wall.slice(0, -1), phase: "turn", turn: seat, drawn: tile, rinshan: false, forbidden: [] }
}

type Match = Pick<MahjongState, "length" | "round" | "dealer" | "firstDealer" | "honba" | "sticks">

const newSeed = (rng: () => number) => Math.floor(rng() * 4294967296)

function deal(match: Match, scores: number[], seed: number): MahjongState {
  const tiles = shuffle(newTiles(), fromSeed(seed))
  const players = scores.map((score, seat): Player => ({
    hand: tiles.slice(14 + seat * 13, 27 + seat * 13).sort(byKind),
    melds: [],
    river: [],
    points: score,
    riichi: 0,
    ippatsu: false,
    passed: false,
    locked: false,
  }))
  const state: MahjongState = {
    ...match,
    players,
    wall: tiles.slice(66),
    dead: tiles.slice(0, 14),
    indicators: 1,
    phase: "turn",
    turn: match.dealer,
    drawn: null,
    rinshan: false,
    forbidden: [],
    pending: null,
    kans: 0,
    uninterrupted: true,
    result: null,
    renchan: false,
    over: false,
    dealt: { points: scores, sticks: match.sticks },
    seed,
    actions: [],
  }
  return draw(state, match.dealer)
}

/** A new match with the first hand dealt. The first dealer is picked at random. */
export function newMatch(rng: () => number, length: MatchLength = 1): MahjongState {
  const dealer = Math.floor(rng() * 4)
  return deal({ length, round: 0, dealer, firstDealer: dealer, honba: 0, sticks: 0 }, [0, 1, 2, 3].map(() => START_POINTS), newSeed(rng))
}

/** The hand after a finished one. Throws when the match is over. */
export function nextHand(state: MahjongState, rng: () => number): MahjongState {
  if (!state.result || state.over) throw new Error("no next hand")
  const last = handNumber(state) === 3
  const dealer = state.renchan ? state.dealer : (state.dealer + 1) % 4
  const round = !state.renchan && last ? state.round + 1 : state.round
  const honba = state.result.kind === "win" && !state.renchan ? 0 : state.honba + 1
  const scores = state.players.map((player) => player.points)
  return deal({ length: state.length, round, dealer, firstDealer: state.firstDealer, honba, sticks: state.sticks }, scores, newSeed(rng))
}

/** A match as it is kept between visits: where the match stands, and the hand in play as its deal and its actions. */
export interface MatchSave extends Match {
  version: 1
  /** Each seat's points when the hand in play was dealt. */
  points: number[]
  seed: number
  actions: MahjongState["actions"]
  /** The match has ended, so there is nothing to carry on. */
  over: boolean
}

export function toSave(state: MahjongState): MatchSave {
  const { length, round, dealer, firstDealer, honba, seed, actions, over } = state
  return { version: 1, length, round, dealer, firstDealer, honba, sticks: state.dealt.sticks, points: state.dealt.points, seed, actions, over }
}

const isCount = (value: unknown, below: number) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < below

/** Reads what `toSave` wrote, or null when the text is not a save. */
export function parseSave(text: string | null): MatchSave | null {
  if (!text) return null
  try {
    const save = JSON.parse(text) as Partial<MatchSave>
    const points = Array.isArray(save.points) && save.points.length === 4 && save.points.every((value) => typeof value === "number")
    const whole = save.version === 1 && points && Array.isArray(save.actions) && typeof save.seed === "number" && typeof save.over === "boolean"
    const seats = isCount(save.dealer, 4) && isCount(save.firstDealer, 4) && isCount(save.round, 2) && isCount(save.honba, 1000) && isCount(save.sticks, 1000)
    return whole && seats && MATCH_LENGTHS.some((length) => length === save.length) ? (save as MatchSave) : null
  } catch {
    return null
  }
}

/** The table a save describes: the same deal, played forward through every saved action. Throws when they do not fit. */
export function resumeMatch(save: MatchSave): MahjongState {
  const { length, round, dealer, firstDealer, honba, sticks } = save
  const dealt = deal({ length, round, dealer, firstDealer, honba, sticks }, save.points, save.seed)
  return save.actions.reduce((state, { seat, action }) => act(state, seat, action), dealt)
}

/** What the seat's hand is worth if it wins now: on the tile it drew, or on `ron`, another seat's tile. Null when it cannot win. */
export function handValue(state: MahjongState, seat: number, ron: { tile: Tile; chankan: boolean } | null): WinValue | null {
  const player = state.players[seat]
  const winTile = ron ? ron.tile : state.drawn
  if (!winTile) return null
  const concealed = ron ? [...player.hand, ron.tile] : player.hand
  const counts = countKinds(concealed)
  if (shanten(counts, player.melds.length) !== -1) return null
  const all = [...concealed, ...player.melds.flatMap((meld) => meld.tiles)]
  const dora = (shown: Tile[]) => shown.reduce((sum, indicator) => sum + all.filter((tile) => tile.kind === doraOf(indicator.kind)).length, 0)
  return valueOf({
    counts,
    called: player.melds.map((meld) => ({ type: meld.type, kind: meld.tiles[0].kind })),
    winKind: winTile.kind,
    tsumo: !ron,
    seatWind: seatWind(state, seat),
    roundWind: EAST + state.round,
    riichi: player.riichi,
    ippatsu: player.ippatsu,
    rinshan: !ron && state.rinshan,
    chankan: ron?.chankan ?? false,
    // The discard after a 杠 that used up the wall is still the last discard, so 河底捞鱼 counts on it;
    // only 海底摸月 is lost to a replacement draw.
    lastTile: state.wall.length === 0,
    firstTurn: !ron && state.uninterrupted && player.river.length === 0,
    dealer: seat === state.dealer,
    dora: dora(indicatorTiles(state)),
    ura: player.riichi > 0 ? dora(state.dead.slice(9, 9 + state.indicators)) : 0,
  })
}

/**
 * The tiles that finish these concealed tiles, beside the seat's calls. A tile the seat already holds all four of
 * is not one: a hand that could only win on a fifth copy is not 听牌.
 */
function winningKinds(concealed: readonly Tile[], melds: readonly Meld[]): Kind[] {
  const held = countKinds([...concealed, ...melds.flatMap((meld) => meld.tiles)])
  return waits(countKinds(concealed), melds.length).filter((kind) => held[kind] < 4)
}

/** The tiles a seat is waiting for, when it is not its turn. */
export function waitsOf(player: Player): Kind[] {
  return winningKinds(player.hand, player.melds)
}

/** 振听: the seat may not win on a discard, because it discarded one of its waits or let one go by. */
export function isFuriten(player: Player): boolean {
  return player.passed || player.locked || waitsOf(player).some((kind) => player.river.some((discard) => discard.tile.kind === kind))
}

/**
 * 食替: the kinds a seat may not discard right after calling `kind`. Never the tile just called, and after a 吃
 * that makes the run starting at `low`, not the tile at the other end of the same run either.
 */
function barredAfter(kind: Kind, low: Kind | null): Kind[] {
  const barred = [kind]
  if (low !== null && kind === low && indexOf(low) <= 5) barred.push(low + 3)
  if (low !== null && kind === low + 2 && indexOf(low) >= 1) barred.push(low - 1)
  return barred
}

function claims(state: MahjongState, seat: number, tile: Tile, from: number, kakan: boolean): { options: Action[]; waiting: boolean } {
  const player = state.players[seat]
  const options: Action[] = []
  const waiting = waitsOf(player).includes(tile.kind)
  if (waiting && !isFuriten(player) && handValue(state, seat, { tile, chankan: kakan })) options.push({ type: "ron" })
  if (!kakan && player.riichi === 0 && state.wall.length > 0) {
    const counts = countKinds(player.hand)
    // A call that would leave nothing the seat may discard is not offered.
    const leavesDiscard = (used: Kind[], low: Kind | null) => {
      const barred = barredAfter(tile.kind, low)
      return counts.some((count, kind) => count - used.filter((taken) => taken === kind).length > 0 && !barred.includes(kind))
    }
    if (counts[tile.kind] >= 2 && leavesDiscard([tile.kind, tile.kind], null)) options.push({ type: "pon" })
    if (counts[tile.kind] >= 3 && state.kans < 4) options.push({ type: "kan" })
    if (seat === (from + 1) % 4 && !isHonor(tile.kind)) {
      for (let low = tile.kind - 2; low <= tile.kind; low++) {
        if (low < 0 || suitOf(low) !== suitOf(tile.kind) || indexOf(low) > 6) continue
        const used = [low, low + 1, low + 2].filter((kind) => kind !== tile.kind)
        if (used.every((kind) => counts[kind] > 0) && leavesDiscard(used, low)) options.push({ type: "chi", low })
      }
    }
  }
  if (options.length > 0) options.push({ type: "pass" })
  return { options, waiting }
}

function end(state: MahjongState, result: HandResult, renchan: boolean): MahjongState {
  const players = state.players.map((player, seat) => ({ ...player, points: player.points + result.deltas[seat] }))
  const leads = players.every((player, seat) => seat === state.dealer || player.points < players[state.dealer].points)
  const lastHand = state.round === state.length - 1 && handNumber(state) === 3
  // An abortive draw always repeats the hand, even the last one with the dealer ahead.
  const over = players.some((player) => player.points < 0) || (lastHand && (!renchan || (leads && result.kind !== "abort")))
  return { ...state, players, phase: "over", pending: null, result, renchan, over, sticks: result.kind === "win" ? 0 : state.sticks }
}

const abort = (state: MahjongState, reason: string) => end(state, { kind: "abort", reason, deltas: [0, 0, 0, 0] }, true)

function finishWin(state: MahjongState, winners: number[], ron: { tile: Tile; from: number; chankan: boolean } | null): MahjongState {
  const wins = winners.map((seat, i): Win => {
    const value = handValue(state, seat, ron)
    const tile = ron ? ron.tile : state.drawn
    if (!value || !tile) throw new Error("not a winning hand")
    // 本场 and the sticks on the table go to one winner: the first after the discarder.
    const deltas = payments({ seat, from: ron ? ron.from : null, dealer: state.dealer, base: value.base, honba: i === 0 ? state.honba : 0 })
    if (i === 0) deltas[seat] += state.sticks * RIICHI_STICK
    return { seat, from: ron ? ron.from : null, tile, value, deltas }
  })
  const deltas = [0, 1, 2, 3].map((seat) => wins.reduce((sum, win) => sum + win.deltas[seat], 0))
  return end(state, { kind: "win", wins, deltas }, winners.includes(state.dealer))
}

function exhaust(state: MahjongState): MahjongState {
  const tenpai = state.players.map((player) => waitsOf(player).length > 0)
  const ready = tenpai.filter(Boolean).length
  const split = ready > 0 && ready < 4
  const deltas = tenpai.map((is) => (split ? (is ? NOTEN_PENALTY / ready : -NOTEN_PENALTY / (4 - ready)) : 0))
  return end(state, { kind: "draw", tenpai, deltas }, tenpai[state.dealer])
}

/** After a 杠: one more 宝牌 indicator, and the seat draws from the dead wall. */
function kanDraw(state: MahjongState, seat: number): MahjongState {
  const tile = state.dead[state.kans]
  const hand = [...state.players[seat].hand, tile].sort(byKind)
  return {
    ...withPlayer(state, seat, { hand, passed: false }),
    wall: state.wall.slice(1),
    kans: state.kans + 1,
    indicators: state.indicators + 1,
    phase: "turn",
    turn: seat,
    drawn: tile,
    rinshan: true,
    forbidden: [],
  }
}

/** A call or a 杠 ends every 一发 and the first uninterrupted turn. */
function interrupted(state: MahjongState): MahjongState {
  return { ...state, uninterrupted: false, players: state.players.map((player) => ({ ...player, ippatsu: false })) }
}

function finishKakan(state: MahjongState, seat: number, tile: Tile): MahjongState {
  const melds = state.players[seat].melds.map((meld): Meld =>
    meld.type === "pon" && meld.tiles[0].kind === tile.kind ? { ...meld, type: "kakan", tiles: [...meld.tiles, tile] } : meld,
  )
  return kanDraw(withPlayer(interrupted(state), seat, { melds }), seat)
}

/** The abortive draw that a discard nobody won on brings, whether or not someone wants to call it. */
function endedBy(state: MahjongState): string | null {
  if (state.players.every((player) => player.riichi > 0)) return "四家立直"
  const oneOwner = state.players.some((player) => player.melds.filter((meld) => KAN_TYPES.has(meld.type)).length === 4)
  return state.kans === 4 && !oneOwner ? "四杠散了" : null
}

function afterDiscard(state: MahjongState, from: number): MahjongState {
  const first = state.players.map((player) => player.river[0]?.tile.kind)
  const winds = state.uninterrupted && state.players.every((player) => player.river.length === 1)
  if (winds && isHonor(first[0]) && first[0] < EAST + 4 && first.every((kind) => kind === first[0])) return abort(state, "四风连打")
  if (state.wall.length === 0) return exhaust(state)
  return draw(state, (from + 1) % 4)
}

/** Nobody won on the tile: seats that could have are now 振听, and a 立直 declared with it costs its stick. */
function letGo(state: MahjongState, pending: Pending): MahjongState {
  const discard = state.players[pending.from].river[state.players[pending.from].river.length - 1]
  const declared = !pending.kakan && discard?.riichi
  const players = state.players.map((player, seat) => {
    const missed = pending.waiting[seat] ? (player.riichi > 0 ? { locked: true } : { passed: true }) : {}
    return { ...player, ...missed, points: player.points - (declared && seat === pending.from ? RIICHI_STICK : 0) }
  })
  return { ...state, players, pending: null, sticks: state.sticks + (declared ? 1 : 0) }
}

function call(state: MahjongState, seat: number, action: Action, pending: Pending): MahjongState {
  const { tile, from } = pending
  const river = state.players[from].river.map((discard, i, all) => (i === all.length - 1 ? { ...discard, called: true } : discard))
  const base = withPlayer(interrupted(state), from, { river })
  const hand = base.players[seat].hand
  const meld = (type: Meld["type"], taken: Tile[], rest: Tile[]) =>
    withPlayer(base, seat, { hand: rest, melds: [...base.players[seat].melds, { type, tiles: [...taken, tile].sort(byKind), from }] })
  if (action.type === "kan") {
    const { taken, rest } = without(hand, tile.kind, 3)
    return kanDraw(meld("minkan", taken, rest), seat)
  }
  const turn = { phase: "turn" as const, turn: seat, drawn: null, rinshan: false }
  if (action.type === "pon") {
    const { taken, rest } = without(hand, tile.kind, 2)
    return { ...meld("pon", taken, rest), ...turn, forbidden: [tile.kind] }
  }
  if (action.type !== "chi") throw new Error("not a call")
  const { low } = action
  const taken = [low, low + 1, low + 2].filter((kind) => kind !== tile.kind).map((kind) => without(hand, kind, 1).taken[0])
  return { ...meld("chi", taken, hand.filter((held) => !taken.includes(held))), ...turn, forbidden: barredAfter(tile.kind, low) }
}

function resolve(state: MahjongState, pending: Pending): MahjongState {
  const order = [1, 2, 3].map((step) => (pending.from + step) % 4)
  const winners = order.filter((seat) => pending.answers[seat]?.type === "ron")
  if (winners.length > 0) return finishWin(state, winners, { tile: pending.tile, from: pending.from, chankan: pending.kakan })
  const next = letGo(state, pending)
  if (pending.kakan) return finishKakan(next, pending.from, pending.tile)
  const reason = endedBy(next)
  if (reason) return abort(next, reason)
  const wants = (types: Action["type"][]) => order.find((seat) => types.includes(pending.answers[seat]?.type ?? "pass"))
  const taker = wants(["pon", "kan"]) ?? wants(["chi"])
  const answer = taker === undefined ? null : pending.answers[taker]
  return taker !== undefined && answer ? call(next, taker, answer, pending) : afterDiscard(next, pending.from)
}

function offer(state: MahjongState, tile: Tile, from: number, kakan: boolean): MahjongState {
  const found = state.players.map((_, seat) => (seat === from ? { options: [], waiting: false } : claims(state, seat, tile, from, kakan)))
  const pending: Pending = {
    tile,
    from,
    kakan,
    options: found.map((claim) => claim.options),
    answers: [null, null, null, null],
    waiting: found.map((claim) => claim.waiting),
  }
  if (pending.options.every((options) => options.length === 0)) return resolve(state, pending)
  return { ...state, phase: "call", pending, drawn: null }
}

function riichiDiscards(state: MahjongState, player: Player): Set<Kind> {
  const closed = player.melds.every((meld) => meld.type === "ankan")
  if (!closed || player.riichi > 0 || player.points < RIICHI_STICK || state.wall.length < 4 || !state.drawn) return new Set()
  const kinds = [...new Set(player.hand.map((tile) => tile.kind))]
  return new Set(
    kinds.filter((kind) => {
      const gone = player.hand.find((tile) => tile.kind === kind)
      return winningKinds(player.hand.filter((tile) => tile !== gone), player.melds).length > 0
    }),
  )
}

function turnActions(state: MahjongState, seat: number): Action[] {
  const player = state.players[seat]
  const { drawn } = state
  const actions: Action[] = []
  if (drawn && handValue(state, seat, null)) actions.push({ type: "tsumo" })
  const counts = countKinds(player.hand)
  if (drawn && state.uninterrupted && player.river.length === 0 && counts.filter((count, kind) => count > 0 && isYaochu(kind)).length >= 9) {
    actions.push({ type: "abort" })
  }
  const mayKan = drawn !== null && state.kans < 4 && state.wall.length > 0
  if (player.riichi > 0) {
    if (!drawn) return actions
    // A 暗杠 after 立直 must use the drawn tile and leave the waits as they were.
    if (mayKan && counts[drawn.kind] === 4) {
      const before = waits(countKinds(player.hand.filter((tile) => tile.id !== drawn.id)), player.melds.length)
      const after = waits(countKinds(player.hand.filter((tile) => tile.kind !== drawn.kind)), player.melds.length + 1)
      if (before.join() === after.join()) actions.push({ type: "ankan", kind: drawn.kind })
    }
    return [...actions, { type: "discard", tile: drawn.id }]
  }
  if (mayKan) {
    counts.forEach((count, kind) => {
      if (count === 4) actions.push({ type: "ankan", kind })
      if (count > 0 && player.melds.some((meld) => meld.type === "pon" && meld.tiles[0].kind === kind)) actions.push({ type: "kakan", kind })
    })
  }
  const riichi = riichiDiscards(state, player)
  for (const tile of player.hand) {
    if (state.forbidden.includes(tile.kind)) continue
    actions.push({ type: "discard", tile: tile.id })
    if (riichi.has(tile.kind)) actions.push({ type: "discard", tile: tile.id, riichi: true })
  }
  return actions
}

/** The seats that have something to decide now. */
export function toAct(state: MahjongState): number[] {
  if (state.phase === "turn") return [state.turn]
  const { pending } = state
  if (state.phase !== "call" || !pending) return []
  return [0, 1, 2, 3].filter((seat) => pending.options[seat].length > 0 && pending.answers[seat] === null)
}

/** Everything the seat may do now. Empty when it has nothing to decide. */
export function legalActions(state: MahjongState, seat: number): Action[] {
  if (!toAct(state).includes(seat)) return []
  return state.phase === "turn" ? turnActions(state, seat) : (state.pending?.options[seat] ?? [])
}

/** One string per move, whatever order the action's fields were written in. */
function keyOf(action: Action): string {
  if (action.type === "discard") return `discard ${action.tile}${action.riichi ? " riichi" : ""}`
  if (action.type === "ankan" || action.type === "kakan") return `${action.type} ${action.kind}`
  return action.type === "chi" ? `chi ${action.low}` : action.type
}

/** The table after the seat's action. Throws when the action is not legal. */
export function act(state: MahjongState, seat: number, action: Action): MahjongState {
  if (!legalActions(state, seat).some((legal) => keyOf(legal) === keyOf(action))) throw new Error(`illegal action: ${keyOf(action)}`)
  const logged = { ...state, actions: [...state.actions, { seat, action }] }
  const player = logged.players[seat]
  if (logged.phase === "call" && logged.pending) {
    const pending = { ...logged.pending, answers: logged.pending.answers.map((answer, i) => (i === seat ? action : answer)) }
    const waitingFor = pending.options.some((options, i) => options.length > 0 && pending.answers[i] === null)
    return waitingFor ? { ...logged, pending } : resolve(logged, pending)
  }
  switch (action.type) {
    case "tsumo":
      return finishWin(logged, [seat], null)
    case "abort":
      return abort(logged, "九种九牌")
    case "ankan": {
      const { taken, rest } = without(player.hand, action.kind, 4)
      const melds = [...player.melds, { type: "ankan" as const, tiles: taken, from: null }]
      return kanDraw(withPlayer(interrupted(logged), seat, { hand: rest, melds }), seat)
    }
    case "kakan": {
      const { taken, rest } = without(player.hand, action.kind, 1)
      return offer({ ...withPlayer(logged, seat, { hand: rest }), drawn: null }, taken[0], seat, true)
    }
    case "discard": {
      const tile = player.hand.find((held) => held.id === action.tile)
      if (!tile) throw new Error("tile not in hand")
      const declared = action.riichi === true
      const river = [...player.river, { tile, riichi: declared, tsumogiri: logged.drawn?.id === tile.id, called: false }]
      const riichi = declared ? (logged.uninterrupted && player.river.length === 0 ? 2 : 1) : player.riichi
      const hand = player.hand.filter((held) => held.id !== tile.id)
      return offer(withPlayer(logged, seat, { hand, river, riichi, ippatsu: declared }), tile, seat, false)
    }
    default:
      throw new Error("not this seat's turn")
  }
}
