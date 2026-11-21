import { describe, expect, it } from "vitest"
import { botAction } from "./bot"
import { START_POINTS, act, handName, isFuriten, legalActions, newMatch, nextHand, parseSave, resumeMatch, toAct, toSave } from "./game"
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

  it("keeps a seat barred when it calls before it has drawn again", () => {
    let state = rig(matchWithDealer(0), {
      hands: { 0: `${JUNK}5s`, 1: JUNK, 2: "222m345p67s777z88s", 3: "147m258p39s7s1234z" },
      draws: "8s 9m",
      indicator: "1z",
    })
    state = answer(discard(state, "5s"))
    state = answer(discard(state, "8s"), { 2: { type: "pon" } })
    state = answer(discard(state, "6s"))
    state = discard(state, "7s")
    expect(state.players[2].passed).toBe(true)
    expect(types(state, 2)).not.toContain("ron")
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

  it("is not offered to a hand that could only win on a fifth copy of a tile", () => {
    const state = rig(matchWithDealer(0), { hands: { 0: "1111m222p333s444z5z" } })
    const declared = legalActions(state, 0).flatMap((action) => (action.type === "discard" && action.riichi ? [action.tile >> 2] : []))
    // Discarding a 一万 leaves a real wait on 白. Discarding 白 would leave only a fifth 一万 to wait for.
    expect([...new Set(declared)]).toEqual(kinds("1m"))
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

  it("does not offer a 吃 that would leave only the swap discards", () => {
    const dealt = rig(matchWithDealer(0), { hands: { 0: `${JUNK}1m`, 1: "2344m222p444p666s", 2: "7m58p39s11223344z", 3: "79m8p39s55566677z" } })
    const all = dealt.players[1].hand
    const melds = kinds("2p4p6s").map((kind) => ({ type: "pon" as const, tiles: all.filter((tile) => tile.kind === kind), from: 0 }))
    const open = Object.assign({}, dealt.players[1], { hand: all.filter((tile) => tile.kind < 9), melds })
    const state = discard({ ...dealt, players: dealt.players.map((player, seat) => (seat === 1 ? open : player)) }, "1m")
    expect(state).toMatchObject({ phase: "turn", turn: 1 })
    expect(state.players[1].melds).toHaveLength(3)
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

  it("repeats the last hand after an abortive draw, even with the dealer ahead", () => {
    const last = { ...matchWithDealer(0), firstDealer: 1 }
    const state = rig(last, { hands: { 0: "19m19p19s1234z258m5z" } })
    const ahead = { ...state, players: state.players.map((player, seat) => Object.assign({}, player, { points: seat === 0 ? 40000 : 20000 })) }
    const done = act(ahead, 0, { type: "abort" })
    expect([handName(ahead), done.over, done.renchan]).toEqual(["东四局", false, true])
    expect(nextHand(done, seeded(1))).toMatchObject({ dealer: 0, honba: 1 })
  })

  it("takes an action whatever order its fields are written in", () => {
    const state = rig(matchWithDealer(0), { hands: { 0: `${JUNK}5z` } })
    const tile = state.players[0].hand[0].id
    expect(act(state, 0, { tile, type: "discard" }).players[0].river).toHaveLength(1)
  })

  it("ends the hand after a fourth 杠 by a second player even when the next discard is called", () => {
    let state = rig(matchWithDealer(0), {
      hands: { 0: "1111m2222m3333m56z", 1: "4444m258p369s123z", 2: "258p369s147s11z23z", 3: "789m258p369s6677z" },
      draws: "9s",
      rinshan: "1z 2z 3z 4z",
    })
    for (let kind = 0; kind < 3; kind++) state = act(state, 0, { type: "ankan", kind })
    state = answer(discard(state, "5z"))
    state = discard(act(state, 1, { type: "ankan", kind: 3 }), "1z")
    expect(types(state, 2)).toEqual(["pon", "pass"])
    expect(act(state, 2, { type: "pon" }).result).toMatchObject({ kind: "abort", reason: "四杠散了" })
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

  it("comes back from a save to the same tiles at the same point, in the middle of a hand or after it", () => {
    const rng = seeded(9)
    let state = playHand(newMatch(rng, 2), rng)
    state = nextHand(state, rng)
    for (let step = 0; step < 25 && state.phase !== "over"; step++) {
      const seat = toAct(state)[0]
      state = act(state, seat, botAction(state, seat, rng))
    }
    const save = parseSave(JSON.stringify(toSave(state)))
    expect(save).not.toBeNull()
    expect(save && resumeMatch(save)).toEqual(state)
    const ended = playHand(state, rng)
    expect(resumeMatch(toSave(ended))).toEqual(ended)
    expect(JSON.stringify(toSave(state))).not.toContain("kind")
  })

  it("refuses text that is not a save", () => {
    expect(parseSave(null)).toBeNull()
    expect(parseSave("{}")).toBeNull()
    expect(parseSave(JSON.stringify({ ...toSave(newMatch(seeded(1))), dealer: 7 }))).toBeNull()
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
