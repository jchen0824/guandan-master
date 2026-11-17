import { describe, expect, it } from "vitest"
import { BOT_SKILLS, botAction } from "./bot"
import type { BotSkill } from "./bot"
import { BIG_BLIND, SEATS, STARTING_STACK, act, describeAction, legalActions, newTable, nextHand, parseTableSave, positionName, resumeTable, toTableSave } from "./game"
import type { Action, HoldemState } from "./game"
import { allSeats, rig, seeded, stacked } from "./testing"

const FOLD: Action = { kind: "fold" }
const CALL: Action = { kind: "call" }
const CHECK: Action = { kind: "check" }
const raise = (to: number): Action => ({ kind: "raise", to })
const from = (state: HoldemState, offset: number) => (state.button + offset) % SEATS
const chipsInPlay = (state: HoldemState) => state.seats.reduce((sum, seat) => sum + seat.stack, 0) + (state.result ? 0 : state.pot)

/** Everyone still to act folds, until it is `seat`'s turn or the hand ends. */
function foldTo(state: HoldemState, seat: number): HoldemState {
  let now = state
  while (now.toAct !== null && now.toAct !== seat) now = act(now, now.toAct, FOLD)
  return now
}

/** Checks, or calls when there is a bet, until the hand ends. */
function checkDown(state: HoldemState): HoldemState {
  let now = state
  while (now.toAct !== null) now = act(now, now.toAct, legalActions(now).canCheck ? CHECK : CALL)
  return now
}

describe("dealing and the betting rounds", () => {
  it("posts the blinds, deals two cards each and starts left of the big blind", () => {
    const state = newTable(seeded(1))
    expect(state.pot).toBe(30)
    expect(state.seats[from(state, 1)].bet).toBe(10)
    expect(state.seats[from(state, 2)].bet).toBe(BIG_BLIND)
    expect(state.toAct).toBe(from(state, 3))
    expect(state.deck).toHaveLength(40)
    const dealt = state.seats.flatMap((seat) => seat.hole.map((card) => card.id))
    expect(new Set(dealt).size).toBe(12)
    expect(allSeats.map((seat) => positionName(state, from(state, seat)))).toEqual(["庄位", "小盲", "大盲", "枪口", "中位", "关位"])
  })

  it("gives the big blind the last word before the flop, then starts the flop left of the button", () => {
    let state = newTable(seeded(1))
    for (let i = 0; i < 5; i++) state = act(state, state.toAct as number, CALL)
    expect(state.street).toBe("preflop")
    expect(state.toAct).toBe(from(state, 2))
    state = act(state, state.toAct as number, CHECK)
    expect(state.street).toBe("flop")
    expect(state.board).toHaveLength(3)
    expect(state.pot).toBe(120)
    expect(state.toAct).toBe(from(state, 1))
    expect(state.seats.every((seat) => seat.bet === 0)).toBe(true)
  })

  it("makes a raise at least as big as the one before it", () => {
    let state = newTable(seeded(1))
    expect(legalActions(state).minRaiseTo).toBe(40)
    state = act(state, state.toAct as number, raise(60))
    expect(legalActions(state)).toMatchObject({ canCheck: false, callAmount: 60, minRaiseTo: 100 })
    expect(() => act(state, state.toAct as number, raise(90))).toThrow("加注要在")
    expect(() => act(state, state.toAct as number, CHECK)).toThrow("不能过牌")
    expect(() => act(state, from(state, 0), FOLD)).toThrow("还没轮到")
    expect(act(state, state.toAct as number, raise(100)).currentBet).toBe(100)
  })

  it("does not let an all-in smaller than a raise reopen the betting", () => {
    const dealt = newTable(seeded(1))
    const opener = dealt.toAct as number
    const short = (opener + 1) % SEATS
    let state = act(stacked(dealt, { [short]: 130 }), opener, raise(100))
    state = act(state, short, raise(130))
    state = foldTo(state, opener)
    expect(legalActions(state)).toEqual({ canCheck: false, callAmount: 30, minRaiseTo: null, maxRaiseTo: null })
  })

  it("reopens the betting when all-ins too small to be a raise add up to one", () => {
    const dealt = newTable(seeded(1))
    const opener = dealt.toAct as number
    const [first, second, caller] = [1, 2, 3].map((step) => (opener + step) % SEATS)
    let state = act(stacked(dealt, { [first]: 140, [second]: 180 }), opener, raise(100))
    state = act(state, first, raise(140))
    state = act(state, second, raise(180))
    state = act(state, caller, CALL)
    state = foldTo(state, opener)
    // The opener raised by 80 and now faces 80 more, so a raise is open again, by at least 80.
    expect(legalActions(state)).toMatchObject({ canCheck: false, callAmount: 80, minRaiseTo: 260 })
    expect(act(state, opener, raise(260)).currentBet).toBe(260)
  })

  it("ends the hand when everyone else folds, without a showdown", () => {
    const dealt = newTable(seeded(1))
    const bigBlind = from(dealt, 2)
    const state = foldTo(dealt, bigBlind)
    expect(state.toAct).toBeNull()
    expect(state.street).toBe("preflop")
    expect(state.result?.shown).toEqual([])
    expect(state.result?.winnings[bigBlind]).toBe(30)
    expect(state.seats[bigBlind].stack).toBe(STARTING_STACK + 10)
  })
})

describe("paying the pots", () => {
  it("builds a side pot for each all-in and pays each to the best hand that is in it", () => {
    const dealt = newTable(seeded(1))
    const [small, middle, big] = [from(dealt, 3), from(dealt, 4), from(dealt, 5)]
    let state = rig(stacked(dealt, { [small]: 100, [middle]: 300 }), { [small]: "AS AH", [middle]: "KS KH", [big]: "QS QH" }, "2C 7D 9H 3S 4D")
    state = act(state, small, raise(100))
    state = act(state, middle, raise(300))
    state = act(state, big, CALL)
    state = foldTo(state, -1)
    expect(state.street).toBe("showdown")
    expect(state.result?.pots).toEqual([
      { amount: 330, eligible: [small, middle, big].toSorted((a, b) => a - b), winners: [small] },
      { amount: 400, eligible: [middle, big].toSorted((a, b) => a - b), winners: [middle] },
    ])
    expect([small, middle, big].map((seat) => state.seats[seat].stack)).toEqual([330, 400, STARTING_STACK - 300])
    expect(chipsInPlay(state)).toBe(chipsInPlay(stacked(dealt, { [small]: 100, [middle]: 300 })))
  })

  it("splits the pot when the best hands are equal", () => {
    const dealt = newTable(seeded(1))
    const [opener, bigBlind] = [from(dealt, 3), from(dealt, 2)]
    let state = rig(dealt, { [opener]: "2C 3D", [bigBlind]: "4C 5D" }, "AS KD QH JC TS")
    state = act(state, opener, raise(60))
    state = act(foldTo(state, bigBlind), bigBlind, CALL)
    state = checkDown(state)
    expect(state.result?.pots).toHaveLength(1)
    expect(state.result?.winnings[opener]).toBe(65)
    expect(state.result?.winnings[bigBlind]).toBe(65)
    expect(state.result?.shown.map((shown) => shown.value.category)).toEqual(["straight", "straight"])
  })
})

describe("from one hand to the next", () => {
  it("moves the button on and gives a player with no chips a full stack", () => {
    const dealt = newTable(seeded(1))
    const over = foldTo(dealt, from(dealt, 2))
    const broke = from(dealt, 4)
    const emptied = { ...over, seats: over.seats.with(broke, { ...over.seats[broke], stack: 0 }) }
    const next = nextHand(emptied, seeded(2))
    expect(next.button).toBe(from(dealt, 1))
    expect(next.handNumber).toBe(2)
    expect(next.seats[broke].stack + next.seats[broke].total).toBe(STARTING_STACK)
    expect(next.result).toBeNull()
  })

  it("says each action the way the table would", () => {
    let state = newTable(seeded(1))
    state = act(state, state.toAct as number, raise(60))
    state = act(state, state.toAct as number, CALL)
    state = act(state, state.toAct as number, FOLD)
    expect(state.log.map(describeAction)).toEqual(["小盲 10", "大盲 20", "加注到 60", "跟注 60", "弃牌"])
  })

  it.each(BOT_SKILLS)("keeps every chip accounted for through three hundred hands of %s computer players", (skill) => {
    const rng = seeded(7)
    let state = newTable(rng)
    let showdowns = 0
    for (let hand = 0; hand < 300; hand++) {
      const before = chipsInPlay(state)
      for (let step = 0; state.toAct !== null; step++) {
        expect(step).toBeLessThan(200)
        state = act(state, state.toAct, botAction(state, state.toAct, rng, skill))
        expect(chipsInPlay(state)).toBe(before)
      }
      expect(state.result?.winnings.reduce((sum, won) => sum + won, 0)).toBe(state.pot)
      if (state.street === "showdown") showdowns++
      state = nextHand(state, rng)
    }
    expect(showdowns).toBeGreaterThan(30)
    // Novices reach a showdown in almost every hand, which takes several seconds on a slow CI runner.
  }, 30_000)
})

describe("keeping the table between visits", () => {
  it("saves a hand only once it has ended, and deals the same next hand from the save", () => {
    const dealt = newTable(seeded(1))
    expect(toTableSave(dealt)).toBeNull()
    const ended = foldTo(dealt, -1)
    const save = toTableSave(ended, new Date("2026-11-17T00:00:00Z"))
    expect(save).toEqual({ version: 1, savedAt: "2026-11-17T00:00:00.000Z", handNumber: 1, button: ended.button, stacks: ended.seats.map((seat) => seat.stack) })

    const read = parseTableSave(JSON.stringify(save))
    expect(read).toEqual(save)
    const resumed = resumeTable(read as NonNullable<typeof read>, seeded(9))
    const next = nextHand(ended, seeded(9))
    expect(resumed).toEqual(next)
    expect(resumed.handNumber).toBe(2)
    expect(resumed.button).toBe((ended.button + 1) % SEATS)
  })

  it("gives a seat below one big blind a full stack when it resumes", () => {
    const resumed = resumeTable({ version: 1, savedAt: "", handNumber: 7, button: 0, stacks: [5, 3990, 2000, 2000, 2000, 2005] }, seeded(1))
    expect(resumed.seats.map((seat) => seat.stack + seat.total)).toEqual([STARTING_STACK, 3990, 2000, 2000, 2000, 2005])
    expect(resumed.handNumber).toBe(8)
  })

  it("ignores anything in storage that is not a save this version wrote", () => {
    const good = { version: 1, savedAt: "", handNumber: 3, button: 2, stacks: [2000, 2000, 2000, 2000, 2000, 2000] }
    expect(parseTableSave(JSON.stringify(good))).toEqual(good)
    for (const bad of [null, "", "not json", "{}", JSON.stringify({ ...good, version: 2 }), JSON.stringify({ ...good, stacks: [2000] }), JSON.stringify({ ...good, button: 6 }), JSON.stringify({ ...good, stacks: [-1, 2000, 2000, 2000, 2000, 2000] }), JSON.stringify({ ...good, handNumber: 0 })]) {
      expect(parseTableSave(bad)).toBeNull()
    }
  })
})

describe("how well the computer players play", () => {
  /** Six computer players at one level, for `hands` hands: how often they fold before the flop and bet after it. */
  function habits(skill: BotSkill, hands = 200) {
    const rng = seeded(11)
    let state = newTable(rng)
    const count = { before: 0, folds: 0, after: 0, bets: 0 }
    for (let hand = 0; hand < hands; hand++) {
      while (state.toAct !== null) {
        const action = botAction(state, state.toAct, rng, skill)
        if (state.street === "preflop") {
          count.before++
          if (action.kind === "fold") count.folds++
        } else {
          count.after++
          if (action.kind === "raise") count.bets++
        }
        state = act(state, state.toAct, action)
      }
      state = nextHand(state, rng)
    }
    return { folds: count.folds / count.before, bets: count.bets / count.after }
  }

  it("has a novice play more hands, and bet less after the flop, than an advanced player", () => {
    const novice = habits("novice")
    const advanced = habits("advanced")
    expect(novice.folds).toBeLessThan(advanced.folds - 0.1)
    expect(novice.bets).toBeLessThan(advanced.bets)
  }, 30_000)
})
