import { chips, newDeck, shuffle } from "./cards"
import type { Card } from "./cards"
import { evaluate } from "./hands"
import type { HandValue } from "./hands"

export type TableSize = 6 | 9
/** The tables a player can pick in 设置. A first visit gets 6. */
export const TABLE_SIZES: readonly TableSize[] = [6, 9]
export const HERO = 0
/** Seats act clockwise in this order. A smaller table uses the first of them. */
export const SEAT_NAMES = ["你", "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛"]
export const SMALL_BLIND = 10
export const BIG_BLIND = 20
export const STARTING_STACK = 2000

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown"

/** `raise` is also the first bet on a street. `to` is the seat's whole bet for this street after the action. */
export type Action = { kind: "fold" } | { kind: "check" } | { kind: "call" } | { kind: "raise"; to: number }

export interface Seat {
  stack: number
  hole: Card[]
  folded: boolean
  /** Out of the table: it had no chips when the hand was dealt, so it has no cards and never acts. Also `folded`. */
  out: boolean
  allIn: boolean
  /** Chips put in on this street. */
  bet: number
  /** Chips put in this hand. */
  total: number
}

export interface LogEntry {
  seat: number
  street: Street
  kind: "blind" | "fold" | "check" | "call" | "bet" | "raise"
  /** Chips added by this action. */
  amount: number
  /** The seat's bet on this street after it. */
  to: number
  allIn: boolean
  /** For a blind: true for the small one, which a short stack may post for less than 10. */
  small?: boolean
}

export interface Pot {
  amount: number
  eligible: number[]
  winners: number[]
}

export interface HandResult {
  pots: Pot[]
  /** Hands shown at showdown. Empty when everyone else folded. */
  shown: { seat: number; value: HandValue }[]
  /** Chips won, per seat. */
  winnings: number[]
}

export interface HoldemState {
  seats: Seat[]
  button: number
  street: Street
  board: Card[]
  deck: Card[]
  /** Null when the hand is over. */
  toAct: number | null
  /** The bet to match on this street. */
  currentBet: number
  /** The smallest legal `to` for a raise. */
  minRaiseTo: number
  /** Every chip put in this hand. */
  pot: number
  handNumber: number
  log: LogEntry[]
  result: HandResult | null
  /** Seats that still have to act in this betting round, in order. */
  pending: number[]
  /**
   * The bet each seat had made or matched when it last acted on this street, or null before it has acted.
   * A seat that has acted may raise again only once the bet has grown by a full raise since then, whether
   * in one raise or in several all-ins that are each too small to count as one.
   */
  actedAt: (number | null)[]
  /** The size of the last full bet or raise on this street. */
  lastRaise: number
}

const after = (seat: number, size: number) => (seat + 1) % size
const canAct = (seat: Seat) => !seat.folded && !seat.allIn
const nobodyYet = (size: number): (number | null)[] => Array.from({ length: size }, () => null)

/** Seat numbers clockwise round a table of `size` seats, starting at `from`. */
function clockwise(from: number, size: number): number[] {
  return Array.from({ length: size }, (_, i) => (from + i) % size)
}

function put(seat: Seat, amount: number): Seat {
  return { ...seat, stack: seat.stack - amount, bet: seat.bet + amount, total: seat.total + amount, allIn: seat.stack === amount }
}

/**
 * Nobody has a decision left when at most one seat can bet and it has already put in as much as any other seat still
 * in, as when a big blind short of the small blind is all-in. The board is then dealt out, as after an all-in call.
 */
function nothingToDecide(seats: readonly Seat[]): boolean {
  const able = seats.filter(canAct)
  return able.length === 0 || (able.length === 1 && seats.every((seat) => seat.folded || seat.bet <= able[0].bet))
}

/** The first seat clockwise after `from` that still has chips. */
function nextIn(stacks: readonly number[], from: number): number {
  return clockwise(after(from, stacks.length), stacks.length).find((seat) => stacks[seat] > 0) ?? from
}

function paid(seat: Seat, won: number): Seat {
  return { ...seat, stack: seat.stack + won }
}

function newStreet(seat: Seat): Seat {
  return { ...seat, bet: 0 }
}

/** The seats still in, clockwise from the small blind, which is where the cards start. */
function dealingOrder(seats: readonly Pick<Seat, "out">[], button: number): number[] {
  const playing = clockwise(button, seats.length).filter((seat) => !seats[seat].out)
  // Heads-up, the button posts the small blind and acts first before the flop.
  return playing.length === 2 ? playing : [...playing.slice(1), playing[0]]
}

/** Deals a hand with the cards coming off `deck` in its order. */
function deal(stacks: readonly number[], button: number, handNumber: number, deck: readonly Card[]): HoldemState {
  if (stacks.filter((stack) => stack > 0).length < 2) throw new Error("这一桌已经结束。")
  // A seat with no chips is out: no cards, no blinds, no turn. The button is always on a seat still in.
  const seats: Seat[] = stacks.map((stack) => ({ stack, hole: [], folded: stack === 0, out: stack === 0, allIn: false, bet: 0, total: 0 }))
  const size = stacks.length
  const order = dealingOrder(seats, button)
  const [smallBlind, bigBlind] = order
  let next = 0
  for (let round = 0; round < 2; round++) {
    for (const seat of order) seats[seat] = { ...seats[seat], hole: [...seats[seat].hole, deck[next++]] }
  }
  const log: LogEntry[] = []
  for (const [seat, amount] of [
    [smallBlind, SMALL_BLIND],
    [bigBlind, BIG_BLIND],
  ]) {
    // A stack shorter than its blind posts what it has and is all-in.
    const posted = Math.min(amount, seats[seat].stack)
    seats[seat] = put(seats[seat], posted)
    log.push({ seat, street: "preflop", kind: "blind", amount: posted, to: posted, allIn: seats[seat].allIn, small: seat === smallBlind })
  }
  const pending = clockwise(after(bigBlind, size), size).filter((seat) => canAct(seats[seat]))
  const dealt: HoldemState = {
    seats,
    button,
    street: "preflop",
    board: [],
    deck: deck.slice(next),
    toAct: pending[0],
    currentBet: BIG_BLIND,
    minRaiseTo: BIG_BLIND * 2,
    // What was posted, which is less than 30 when a blind was short.
    pot: log.reduce((sum, entry) => sum + entry.amount, 0),
    handNumber,
    log,
    result: null,
    pending,
    actedAt: nobodyYet(size),
    lastRaise: BIG_BLIND,
  }
  return nothingToDecide(seats) ? nextStreet({ ...dealt, pending: [], toAct: null }) : dealt
}

/**
 * A table of `size` seats with full stacks, the button on a seat picked by `rng`, and the first hand dealt. The button
 * is drawn before the deck is shuffled: `dealHoldem` in e2e/page-tools.js depends on that order.
 */
export function newTable(rng: () => number, size: TableSize = 6): HoldemState {
  return deal(
    Array.from({ length: size }, () => STARTING_STACK),
    Math.floor(rng() * size),
    1,
    shuffle(newDeck(), rng),
  )
}

/** How many seats the table has. Every table comes from `newTable` or a parsed save, so it is one of `TABLE_SIZES`. */
export function tableSize(state: HoldemState): TableSize {
  return state.seats.length as TableSize
}

/**
 * Moves the button to the next seat still in and deals. A seat that lost all its chips is out, as in a real game.
 * Throws when fewer than two seats have chips: check `tableOver` first.
 */
export function nextHand(state: HoldemState, rng: () => number): HoldemState {
  const stacks = state.seats.map((seat) => seat.stack)
  return deal(stacks, nextIn(stacks, state.button), state.handNumber + 1, shuffle(newDeck(), rng))
}

/** How the table ended for the player: out of chips, or the only one left with any. Null while it goes on. */
export function stacksOver(stacks: readonly number[]): "lost" | "won" | null {
  if (stacks[HERO] === 0) return "lost"
  if (stacks.every((stack, seat) => seat === HERO || stack === 0)) return "won"
  return null
}

/** `stacksOver` for a hand that has ended. Null while a hand is being played. */
export function tableOver(state: HoldemState): "lost" | "won" | null {
  return state.result ? stacksOver(state.seats.map((seat) => seat.stack)) : null
}

/** The seats that lost their last chips in this hand, once it has ended. */
export function knockedOut(state: HoldemState): number[] {
  return state.result ? state.seats.flatMap((seat, index) => (!seat.out && seat.stack === 0 ? [index] : [])) : []
}

/**
 * A hand being played, as a save keeps it: the order of the deck it was dealt from, written as one number (`order`),
 * and every action after the blinds. The save names no card, so browser storage shows no one's cards.
 */
export interface SavedHand {
  order: string
  actions: Action[]
}

/**
 * What is kept between visits. Between hands: the stacks, the button and the number of the hand that ended. During a
 * hand: the stacks it started with, its button and number, and the hand itself, so a visit carries on with the same
 * cards rather than dealing new ones. `hand` is null when a hand was being played but its save could not be read: that
 * hand is then dealt afresh. Version 1 saves were only made between hands.
 */
export interface TableSave {
  version: 1 | 2
  savedAt: string
  handNumber: number
  button: number
  stacks: number[]
  hand?: SavedHand | null
}

const CARDS = newDeck()

/** The cards in the order `deal` took them: two rounds of hole cards from the small blind, then the board, then the rest. */
function dealtDeck(state: HoldemState): Card[] {
  const order = dealingOrder(state.seats, state.button)
  return [...order.map((seat) => state.seats[seat].hole[0]), ...order.map((seat) => state.seats[seat].hole[1]), ...state.board, ...state.deck]
}

/**
 * The deck's order as one number: its rank among the 52! orders (a Lehmer code), in base 36. Reading the cards back
 * takes this code, not a glance at storage.
 */
function orderNumber(deck: readonly Card[]): string {
  const rest = CARDS.map((card) => card.id)
  let rank = BigInt(0)
  for (const card of deck) {
    const at = rest.indexOf(card.id)
    rank = rank * BigInt(rest.length) + BigInt(at)
    rest.splice(at, 1)
  }
  return rank.toString(36)
}

/** The deck an `orderNumber` stands for, or null when the text is not one. */
function deckOf(order: unknown): Card[] | null {
  if (typeof order !== "string" || !/^[0-9a-z]{1,60}$/.test(order)) return null
  let rank = BigInt(0)
  for (const digit of order) rank = rank * BigInt(36) + BigInt(parseInt(digit, 36))
  const picks: number[] = []
  for (let left = 1; left <= CARDS.length; left++) {
    picks.unshift(Number(rank % BigInt(left)))
    rank /= BigInt(left)
  }
  if (rank !== BigInt(0)) return null
  const rest = CARDS.slice()
  return picks.map((at) => rest.splice(at, 1)[0])
}

function actionOf(entry: LogEntry): Action[] {
  if (entry.kind === "blind") return []
  if (entry.kind === "bet" || entry.kind === "raise") return [{ kind: "raise", to: entry.to }]
  return [{ kind: entry.kind }]
}

/** The save for the table as it stands, between hands or during one. */
export function toTableSave(state: HoldemState, now: Date = new Date()): TableSave {
  const table = { version: 2 as const, savedAt: now.toISOString(), handNumber: state.handNumber, button: state.button }
  if (state.result) return { ...table, stacks: state.seats.map((seat) => seat.stack) }
  return {
    ...table,
    stacks: state.seats.map((seat) => seat.stack + seat.total),
    hand: { order: orderNumber(dealtDeck(state)), actions: state.log.flatMap(actionOf) },
  }
}

function isAction(data: unknown): data is Action {
  if (typeof data !== "object" || data === null || !("kind" in data)) return false
  if (data.kind === "raise") return "to" in data && Number.isInteger(data.to)
  return data.kind === "fold" || data.kind === "check" || data.kind === "call"
}

/**
 * The saved hand dealt again from its deck and played through its actions by the rules, or null when it is not a
 * hand still being played: an order that is not a number of a deck, a button on a seat that is out, an action the
 * rules refuse, or a hand that ends.
 */
function replay(save: Omit<TableSave, "hand">, hand: unknown): HoldemState | null {
  if (typeof hand !== "object" || hand === null || !("order" in hand) || !("actions" in hand)) return null
  const deck = deckOf(hand.order)
  const { actions } = hand
  if (!deck || !Array.isArray(actions) || !actions.every(isAction)) return null
  if (save.stacks[save.button] === 0) return null
  try {
    let state = deal(save.stacks, save.button, save.handNumber, deck)
    for (const action of actions) {
      if (state.toAct === null) return null
      state = act(state, state.toAct, action)
    }
    return state.result === null ? state : null
  } catch {
    return null
  }
}

/**
 * A save read back from storage, or null when there is none or it is not one this version can read. A hand in the
 * save that does not replay by the rules comes back as `hand: null`, so the table is kept and that hand dealt afresh.
 */
export function parseTableSave(text: string | null): TableSave | null {
  if (!text) return null
  try {
    const data = JSON.parse(text)
    const valid =
      (data?.version === 1 || data?.version === 2) &&
      typeof data.savedAt === "string" &&
      Number.isInteger(data.handNumber) &&
      data.handNumber >= 1 &&
      Number.isInteger(data.button) &&
      data.button >= 0 &&
      Array.isArray(data.stacks) &&
      data.button < data.stacks.length &&
      TABLE_SIZES.some((size) => size === data.stacks.length) &&
      data.stacks.every((stack: unknown) => Number.isInteger(stack) && (stack as number) >= 0)
    if (!valid) return null
    const table: TableSave = { version: data.version, savedAt: data.savedAt, handNumber: data.handNumber, button: data.button, stacks: data.stacks }
    if (data.version === 1 || data.hand === undefined) return table
    return { ...table, hand: replay(table, data.hand) ? { order: data.hand.order, actions: data.hand.actions } : null }
  } catch {
    return null
  }
}

/** The hand a save was taken in, as it stood; or, for a save between hands, the next hand as `nextHand` would deal it. */
export function resumeTable(save: TableSave, rng: () => number): HoldemState {
  if (save.hand === undefined) return deal(save.stacks, nextIn(save.stacks, save.button), save.handNumber + 1, shuffle(newDeck(), rng))
  const hand = save.hand && replay(save, save.hand)
  if (hand) return hand
  const button = save.stacks[save.button] > 0 ? save.button : nextIn(save.stacks, save.button)
  return deal(save.stacks, button, save.handNumber, shuffle(newDeck(), rng))
}

/** What the seat to act may do. The raise fields are null when it cannot raise. */
export function legalActions(state: HoldemState): { canCheck: boolean; callAmount: number; minRaiseTo: number | null; maxRaiseTo: number | null } {
  if (state.toAct === null) throw new Error("这一手已经结束。")
  const me = state.seats[state.toAct]
  const most = me.bet + me.stack
  const someoneElse = state.seats.some((seat, index) => index !== state.toAct && canAct(seat))
  const acted = state.actedAt[state.toAct]
  const open = acted === null || state.currentBet - acted >= state.lastRaise
  const canRaise = open && most > state.currentBet && someoneElse
  return {
    canCheck: me.bet === state.currentBet,
    callAmount: Math.min(state.currentBet - me.bet, me.stack),
    minRaiseTo: canRaise ? Math.min(state.minRaiseTo, most) : null,
    maxRaiseTo: canRaise ? most : null,
  }
}

/** Side pots: one for each level at which a player still in the hand is all-in or has matched the rest. */
export function buildPots(seats: readonly Seat[]): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(seats.filter((seat) => !seat.folded).map((seat) => seat.total))].sort((a, b) => a - b)
  const pots: { amount: number; eligible: number[] }[] = []
  let below = 0
  for (const level of levels) {
    const amount = seats.reduce((sum, seat) => sum + Math.min(seat.total, level) - Math.min(seat.total, below), 0)
    const eligible = seats.flatMap((seat, index) => (!seat.folded && seat.total >= level ? [index] : []))
    const last = pots[pots.length - 1]
    if (last && last.eligible.join() === eligible.join()) last.amount += amount
    else if (amount > 0) pots.push({ amount, eligible })
    below = level
  }
  const left = seats.reduce((sum, seat) => sum + seat.total, 0) - pots.reduce((sum, pot) => sum + pot.amount, 0)
  if (left > 0 && pots.length > 0) pots[pots.length - 1].amount += left
  return pots
}

function settle(state: HoldemState, showdown: boolean): HoldemState {
  const alive = state.seats.flatMap((seat, index) => (seat.folded ? [] : [index]))
  const values = new Map(alive.map((seat) => [seat, evaluate([...state.seats[seat].hole, ...state.board])]))
  const open = showdown ? buildPots(state.seats) : [{ amount: state.pot, eligible: alive }]
  const winnings = state.seats.map(() => 0)
  const size = state.seats.length
  const fromButton = clockwise(after(state.button, size), size)
  const pots: Pot[] = open.map((pot) => {
    const best = Math.max(...pot.eligible.map((seat) => values.get(seat)?.score ?? 0))
    const winners = fromButton.filter((seat) => pot.eligible.includes(seat) && (!showdown || values.get(seat)?.score === best))
    const share = Math.floor(pot.amount / winners.length)
    // Chips that do not divide go one each to the winners nearest the button's left.
    winners.forEach((seat, index) => (winnings[seat] += share + (index < pot.amount - share * winners.length ? 1 : 0)))
    return { amount: pot.amount, eligible: pot.eligible, winners }
  })
  return {
    ...state,
    seats: state.seats.map((seat, index) => paid(seat, winnings[index])),
    street: showdown ? "showdown" : state.street,
    toAct: null,
    pending: [],
    result: {
      pots,
      shown: showdown ? alive.map((seat) => ({ seat, value: values.get(seat) as HandValue })) : [],
      winnings,
    },
  }
}

const NEXT: Record<string, Street> = { preflop: "flop", flop: "turn", turn: "river" }

/** Deals the next street. When at most one player can still bet, it keeps dealing to the showdown. */
function nextStreet(state: HoldemState): HoldemState {
  if (state.street === "river") return settle(state, true)
  const street = NEXT[state.street]
  const count = street === "flop" ? 3 : 1
  const seats = state.seats.map(newStreet)
  const size = seats.length
  const able = clockwise(after(state.button, size), size).filter((seat) => canAct(seats[seat]))
  const pending = able.length > 1 ? able : []
  const dealt: HoldemState = {
    ...state,
    street,
    seats,
    board: [...state.board, ...state.deck.slice(0, count)],
    deck: state.deck.slice(count),
    currentBet: 0,
    lastRaise: BIG_BLIND,
    minRaiseTo: BIG_BLIND,
    pending,
    actedAt: nobodyYet(size),
    toAct: pending[0] ?? null,
  }
  return pending.length > 0 ? dealt : nextStreet(dealt)
}

/**
 * Applies one action for the seat to act. It throws when the action is not legal. When the action ends a
 * betting round the next street is dealt, and when it ends the hand the pots are paid.
 */
export function act(state: HoldemState, seat: number, action: Action): HoldemState {
  if (state.toAct === null) throw new Error("这一手已经结束。")
  if (seat !== state.toAct) throw new Error("还没轮到这位玩家。")
  const legal = legalActions(state)
  const me = state.seats[seat]
  const seats = state.seats.slice()
  const entry = { seat, street: state.street, amount: 0, to: me.bet, allIn: false }
  let { currentBet, lastRaise } = state
  let pending = state.pending.filter((other) => other !== seat)
  let kind: LogEntry["kind"] = action.kind === "raise" ? "raise" : action.kind

  if (action.kind === "fold") {
    seats[seat] = { ...me, folded: true }
  } else if (action.kind === "check") {
    if (!legal.canCheck) throw new Error("前面有人下注，不能过牌。")
  } else if (action.kind === "call") {
    if (legal.callAmount === 0) throw new Error("没有需要跟的注，可以过牌。")
    seats[seat] = put(me, legal.callAmount)
  } else {
    const { to } = action
    if (legal.minRaiseTo === null || legal.maxRaiseTo === null) throw new Error("现在不能加注。")
    if (!Number.isInteger(to) || to > legal.maxRaiseTo || to < legal.minRaiseTo) {
      throw new Error(`加注要在 ${chips(legal.minRaiseTo)} 到 ${chips(legal.maxRaiseTo)} 之间。`)
    }
    seats[seat] = put(me, to - me.bet)
    kind = currentBet === 0 ? "bet" : "raise"
    // An all-in for less than a full raise does not change the size of a raise. See `actedAt`.
    lastRaise = Math.max(lastRaise, to - currentBet)
    currentBet = to
    pending = clockwise(after(seat, seats.length), seats.length).filter((other) => other !== seat && canAct(seats[other]))
  }

  const now = seats[seat]
  const added = now.total - me.total
  const actedAt = state.actedAt.slice()
  actedAt[seat] = currentBet
  const next: HoldemState = {
    ...state,
    seats,
    currentBet,
    lastRaise,
    minRaiseTo: currentBet + lastRaise,
    actedAt,
    pending,
    pot: state.pot + added,
    log: [...state.log, { ...entry, kind, amount: added, to: now.bet, allIn: now.allIn && added > 0 }],
  }
  if (seats.filter((other) => !other.folded).length === 1) return settle(next, false)
  if (pending.length > 0 && !nothingToDecide(seats)) return { ...next, toAct: pending[0] }
  return nextStreet({ ...next, pending: [] })
}

type Position = "button" | "smallBlind" | "bigBlind" | "utg" | "utg1" | "utg2" | "middle" | "hijack" | "cutoff"

/** Which part of the table a seat acts from, for strategy. `out` is a seat with no chips. */
export type PositionGroup = "early" | "middle" | "late" | "blinds" | "out"

const POSITIONS: Record<Position, { name: string; group: Exclude<PositionGroup, "out"> }> = {
  button: { name: "庄位", group: "late" },
  smallBlind: { name: "小盲", group: "blinds" },
  bigBlind: { name: "大盲", group: "blinds" },
  utg: { name: "枪口", group: "early" },
  utg1: { name: "枪口+1", group: "early" },
  utg2: { name: "枪口+2", group: "early" },
  middle: { name: "中位", group: "middle" },
  hijack: { name: "劫位", group: "middle" },
  cutoff: { name: "关位", group: "late" },
}

/**
 * Positions clockwise from the button, indexed by how many players are still in. The table fills from both ends, the
 * way players name seats: 关位 is always the seat before the button. Heads-up the button also posts the small blind.
 */
const ORDER: readonly (readonly Position[])[] = [
  [],
  [],
  ["button", "bigBlind"],
  ["button", "smallBlind", "bigBlind"],
  ["button", "smallBlind", "bigBlind", "utg"],
  ["button", "smallBlind", "bigBlind", "utg", "cutoff"],
  ["button", "smallBlind", "bigBlind", "utg", "middle", "cutoff"],
  ["button", "smallBlind", "bigBlind", "utg", "middle", "hijack", "cutoff"],
  ["button", "smallBlind", "bigBlind", "utg", "utg1", "middle", "hijack", "cutoff"],
  ["button", "smallBlind", "bigBlind", "utg", "utg1", "utg2", "middle", "hijack", "cutoff"],
]

/** Null for a seat that is out. Otherwise its place among the seats still in, counted from the button. */
function position(state: HoldemState, seat: number): Position | null {
  if (state.seats[seat].out) return null
  const playing = clockwise(state.button, state.seats.length).filter((other) => !state.seats[other].out)
  return ORDER[playing.length]?.[playing.indexOf(seat)] ?? null
}

export function positionName(state: HoldemState, seat: number): string {
  const where = position(state, seat)
  return where ? POSITIONS[where].name : "出局"
}

export function positionGroup(state: HoldemState, seat: number): PositionGroup {
  const where = position(state, seat)
  return where ? POSITIONS[where].group : "out"
}

/** The newest item that passes the test. `findLast` is missing from older phone browsers. */
export function lastWhere<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index--) if (test(items[index])) return items[index]
  return undefined
}

export function describeAction(entry: LogEntry): string {
  if (entry.kind === "blind") return `${entry.small ? "小盲" : "大盲"} ${entry.amount}`
  if (entry.kind === "fold") return "弃牌"
  if (entry.kind === "check") return "过牌"
  if (entry.allIn) return `全下 ${chips(entry.to)}`
  if (entry.kind === "call") return `跟注 ${chips(entry.amount)}`
  return entry.kind === "bet" ? `下注 ${chips(entry.to)}` : `加注到 ${chips(entry.to)}`
}
