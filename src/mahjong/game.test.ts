import { describe, expect, it } from "vitest"
import { botAction } from "./bot"
import { START_POINTS, act, handName, isFuriten, legalActions, newMatch, nextHand, toAct } from "./game"
import type { Action, MahjongState } from "./game"
import { kinds, matchWithDealer, rig, seeded } from "./testing"
import { byKind, shuffle } from "./tiles"

const JUNK = "147m258p369s1234z"
const READY = "234567m345p67s88s"

/** Discard one tile of this kind from the seat to act. */
function discard(state: MahjongState, name: string, riichi = false): MahjongState {
  const seat = state.turn
  const tile = state.players[seat].hand.find((held) => held.kind === kinds(name)[0])
  if (!tile) throw new Error(`seat ${seat} has no ${name}`)
  return act(state, seat, riichi ? { type: "discard", tile: tile.id, riichi: true } : { type: "discard", tile: tile.id })
}

/** Every seat that may claim the discard passes, except those given an answer. */
function answer(state: MahjongState, answers: Record<number, Action> = {}): MahjongState {
  return toAct(state).reduce((next, seat) => (next.phase === "call" ? act(next, seat, answers[seat] ?? { type: "pass" }) : next), state)
}

const types = (state: MahjongState, seat: number) => legalActions(state, seat).map((action) => action.type)
const total = (state: MahjongState) => state.players.reduce((sum, player) => sum + player.points, 0) + state.sticks * 1000

function playHand(start: MahjongState, rng: () => number): MahjongState {
  let state = start
  for (let step = 0; state.phase !== "over"; step++) {
    if (step > 2000) throw new Error("the hand does not end")
    const seat = toAct(state)[0]
    state = act(state, seat, botAction(state, seat, rng))
  }
  return state
}

describe("发牌", () => {
  it("deals 13 tiles each, 14 to the dealer, and keeps 14 in the dead wall", () => {
    const state = newMatch(seeded(3))
    expect(state.players.map((player) => player.hand.length)).toEqual([0, 1, 2, 3].map((seat) => (seat === state.dealer ? 14 : 13)))
    expect([state.wall.length, state.dead.length, state.indicators]).toEqual([69, 14, 1])
    expect(handName(state)).toBe("东一局")
    expect(toAct(state)).toEqual([state.dealer])
  })
})

describe("和牌", () => {
  it("pays a dealer who wins on the first draw 天和", () => {
    const state = rig(matchWithDealer(0), { hands: { 0: "123m456m789p234s55s" } })
    expect(types(state, 0)).toContain("tsumo")
    const done = act(state, 0, { type: "tsumo" })
    expect(done.result).toMatchObject({ kind: "win", deltas: [48000, -16000, -16000, -16000] })
    expect(done.players.map((player) => player.points)).toEqual([73000, 9000, 9000, 9000])
  })

  it("lets a seat win on a discard, and the discarder pays", () => {
    const state = discard(rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: READY }, indicator: "1z" }), "5s")
    expect(state.phase).toBe("call")
    expect(types(state, 1)).toEqual(["ron", "chi", "pass"])
    const done = act(state, 1, { type: "ron" })
    expect(done.result).toMatchObject({ kind: "win", deltas: [-2000, 2000, 0, 0] })
    expect(done.result?.kind === "win" && done.result.wins[0].value.yaku.map((yaku) => yaku.name)).toEqual(["平和", "断幺九"])
    expect(done.renchan).toBe(false)
  })

  it("pays two seats that win on the same tile", () => {
    const state = discard(rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: READY, 2: READY }, indicator: "1z" }), "5s")
    const done = answer(state, { 1: { type: "ron" }, 2: { type: "ron" } })
    expect(done.result).toMatchObject({ kind: "win", deltas: [-4000, 2000, 2000, 0] })
  })
})

describe("振听", () => {
  it("bars a seat that let a winning tile go by, until its own next discard", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: JUNK, 2: READY }, draws: "8s 9m", indicator: "1z" })
    state = answer(discard(state, "5s"))
    expect(state.players[2].passed).toBe(true)
    state = discard(state, "8s")
    expect(types(state, 2)).toEqual(["pon", "chi", "pass"])
    state = discard(answer(state), "9m")
    expect(state.players[2].passed).toBe(false)
  })

  it("bars a seat that has discarded one of its own waits", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${READY}5s`, 1: `${JUNK}`, 2: JUNK, 3: JUNK }, draws: "8s", indicator: "1z" })
    state = answer(discard(state, "5s"))
    expect(isFuriten(state.players[0])).toBe(true)
    state = discard(state, "8s")
    expect(types(state, 0)).toEqual(["pon", "pass"])
  })
})

describe("立直", () => {
  it("costs 1,000 once the discard is let go, and then only the drawn tile may be discarded", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${READY}1z`, 1: JUNK, 2: JUNK, 3: JUNK }, draws: "9m 9m 9m 9p" })
    expect(legalActions(state, 0).filter((action) => action.type === "discard" && action.riichi)).toHaveLength(3)
    state = discard(state, "1z", true)
    expect(state.players[0]).toMatchObject({ riichi: 2, ippatsu: true, points: START_POINTS - 1000 })
    expect(state.sticks).toBe(1)
    for (let seat = 1; seat <= 3; seat++) state = answer(discard(state, "9m"))
    expect(legalActions(state, 0)).toEqual([{ type: "discard", tile: state.drawn?.id }])
  })

  it("is not offered with an open hand or when the hand is not 听牌", () => {
    const state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5z` } })
    expect(legalActions(state, 0).some((action) => action.type === "discard" && action.riichi)).toBe(false)
  })
})

describe("鸣牌", () => {
  it("gives a 碰 the turn, skips the seats between, and bars discarding the same tile", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}7z`, 1: JUNK, 2: "147m258p369s77z12z", 3: JUNK } })
    state = discard(state, "7z")
    expect(types(state, 2)).toEqual(["pon", "pass"])
    state = act(state, 2, { type: "pon" })
    expect(state).toMatchObject({ phase: "turn", turn: 2, drawn: null, uninterrupted: false })
    expect(state.players[2].melds).toMatchObject([{ type: "pon", from: 0 }])
    expect(state.players[0].river[0].called).toBe(true)
    expect(legalActions(state, 2).every((action) => action.type === "discard")).toBe(true)
    expect(types(state, 2)).toHaveLength(11)
  })

  it("offers 吃 only to the next seat, and forbids the swap discard", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}3m`, 1: "45m6m258p369s1234z", 2: "45m6m258p369s1234z", 3: JUNK } })
    state = discard(state, "3m")
    expect(legalActions(state, 1)).toEqual([{ type: "chi", low: 2 }, { type: "pass" }])
    expect(legalActions(state, 2)).toEqual([])
    state = answer(state, { 1: { type: "chi", low: 2 } })
    expect(state.forbidden).toEqual(kinds("36m"))
    expect(state.players[1].melds[0].tiles.map((tile) => tile.kind)).toEqual(kinds("345m"))
  })

  it("turns a new 宝牌 indicator and draws from the dead wall after a 暗杠", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: "1111m258p369s1234z" }, rinshan: "5z" })
    state = act(state, 0, { type: "ankan", kind: 0 })
    expect(state).toMatchObject({ kans: 1, indicators: 2, rinshan: true, turn: 0 })
    expect(state.drawn?.kind).toBe(kinds("5z")[0])
    expect([state.players[0].hand.length, state.wall.length]).toEqual([11, 68])
  })

  it("lets a seat rob a tile added to a 碰", () => {
    let state = rig(matchWithDealer(0), {
      hands: { 0: "147m289p369s1234z5p", 1: "234567m46p678s88s", 2: "147m28p55p369s123z", 3: "147m289p369s1234z" },
      draws: "5z 6z 7z 5p",
      indicator: "1z",
    })
    state = answer(discard(state, "5p"), { 2: { type: "pon" } })
    state = answer(discard(state, "1z"))
    for (const name of ["5z", "6z", "7z"]) state = answer(discard(state, name))
    expect(types(state, 2)).toContain("kakan")
    state = act(state, 2, { type: "kakan", kind: kinds("5p")[0] })
    expect(types(state, 1)).toEqual(["ron", "pass"])
    const done = act(state, 1, { type: "ron" })
    expect(done.result?.kind === "win" && done.result.wins[0].value.yaku.map((yaku) => yaku.name)).toEqual(["抢杠", "断幺九"])
  })
})

describe("流局", () => {
  it("ends the hand when the first four discards are the same wind", () => {
    let state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5z`, 1: JUNK, 2: JUNK, 3: JUNK } })
    for (let seat = 0; seat < 4; seat++) state = discard(state, "1z")
    expect(state.result).toMatchObject({ kind: "abort", reason: "四风连打" })
    expect(state.renchan).toBe(true)
  })

  it("offers 九种九牌 on the first draw", () => {
    const state = rig(matchWithDealer(0), { hands: { 0: "19m19p19s1234z258m5z" } })
    expect(types(state, 0)).toContain("abort")
    expect(act(state, 0, { type: "abort" }).result).toMatchObject({ kind: "abort", reason: "九种九牌" })
  })
})

describe("一场比赛", () => {
  it("keeps the dealer and adds a 本场 when the dealer wins", () => {
    const done = act(rig(matchWithDealer(0), { hands: { 0: "123m456m789p234s55s" } }), 0, { type: "tsumo" })
    const next = nextHand(done, seeded(1))
    expect([next.dealer, next.honba, handName(next)]).toEqual([0, 1, "东一局"])
  })

  it("passes the deal on when another seat wins", () => {
    const state = discard(rig(matchWithDealer(0), { hands: { 0: `${JUNK}5s`, 1: READY } }), "5s")
    const next = nextHand(act(state, 1, { type: "ron" }), seeded(1))
    expect([next.dealer, next.honba, handName(next)]).toEqual([1, 0, "东二局"])
  })

  it("is played to the end by the computer players, and no points go missing", () => {
    const results = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seeded(seed)
      let state = playHand(newMatch(rng, seed % 2 === 0 ? 2 : 1), rng)
      for (let hands = 1; !state.over; hands++) {
        if (hands > 40) throw new Error("the match does not end")
        expect(total(state)).toBe(4 * START_POINTS)
        state = playHand(nextHand(state, rng), rng)
      }
      results.add(state.result?.kind ?? "")
      expect(total(state)).toBe(4 * START_POINTS)
      expect(() => nextHand(state, rng)).toThrow()
    }
    expect(results).toContain("win")
  })

  it("decides without looking at hidden tiles", () => {
    const rng = seeded(5)
    let state = newMatch(rng)
    const changed: number[] = []
    for (let step = 0; step < 30 && state.phase !== "over"; step++) {
      const seat = toAct(state)[0]
      // The same table with every tile this seat cannot see dealt again.
      const others = state.players.map((player, i) => (i === seat ? [] : player.hand))
      const hidden = shuffle([...others.flat(), ...state.wall, ...state.dead.filter((_, i) => i < 4 || i >= 4 + state.indicators)], seeded(step + 1))
      const players = state.players.map((player, i) => (i === seat ? player : { ...player, hand: hidden.splice(0, player.hand.length).sort(byKind) }))
      const wall = hidden.splice(0, state.wall.length)
      const dead = state.dead.map((tile, i) => (i < 4 || i >= 4 + state.indicators ? hidden.splice(0, 1)[0] : tile))
      const action = botAction(state, seat, seeded(step))
      const blind = botAction({ ...state, players, wall, dead }, seat, seeded(step))
      if (state.phase === "turn" && JSON.stringify(blind) !== JSON.stringify(action)) changed.push(step)
      state = act(state, seat, action)
    }
    expect(changed).toEqual([])
  })
})
