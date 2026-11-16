import { describe, expect, it } from "vitest"
import { SEATS, SEAT_NAMES, act, legalActions, newTable } from "../../holdem/game"
import type { HoldemState } from "../../holdem/game"
import { rig, seeded, stacked } from "../../holdem/testing"
import { biggestWinner, resultLine } from "./summary"

const from = (state: HoldemState, offset: number) => (state.button + offset) % SEATS

/** Everyone still to act folds or checks until the hand is over. */
function finish(state: HoldemState): HoldemState {
  let now = state
  while (now.toAct !== null) now = act(now, now.toAct, legalActions(now).canCheck ? { kind: "check" } : { kind: "fold" })
  return now
}

describe("the result of a hand", () => {
  it("names every player who won chips when a short stack takes the main pot and another the side pot", () => {
    const dealt = newTable(seeded(1))
    const [short, middle, big] = [from(dealt, 3), from(dealt, 4), from(dealt, 5)]
    let state = rig(stacked(dealt, { [short]: 100, [middle]: 300 }), { [short]: "AS AH", [middle]: "KS KH", [big]: "QS QH" }, "2C 7D 9H 3S 4D")
    state = act(state, short, { kind: "raise", to: 100 })
    state = act(state, middle, { kind: "raise", to: 300 })
    state = act(state, big, { kind: "call" })
    state = finish(state)
    expect(state.result?.winnings[short]).toBe(330)
    expect(state.result?.winnings[middle]).toBe(400)

    expect(biggestWinner(state)).toBe(middle)
    expect(resultLine(state)).toEqual({
      title: "一对",
      line: `${SEAT_NAMES[middle]}用一对 K，赢得 400；${SEAT_NAMES[short]}用一对 A，赢得 330`,
    })
  })

  it("says the pot was split, and names both players", () => {
    const dealt = newTable(seeded(1))
    const [opener, bigBlind] = [from(dealt, 3), from(dealt, 2)]
    let state = rig(dealt, { [opener]: "2C 3D", [bigBlind]: "4C 5D" }, "AS KD QH JC TS")
    state = act(state, opener, { kind: "raise", to: 60 })
    while (state.toAct !== bigBlind) state = act(state, state.toAct as number, { kind: "fold" })
    state = act(state, bigBlind, { kind: "call" })
    while (state.toAct !== null) state = act(state, state.toAct, { kind: "check" })
    const line = resultLine(state)?.line ?? ""
    expect(line.startsWith("平分底池：")).toBe(true)
    expect(line).toContain(`${SEAT_NAMES[opener]}用`)
    expect(line).toContain(`${SEAT_NAMES[bigBlind]}用`)
  })

  it("says everyone else folded when nobody showed a hand", () => {
    const dealt = newTable(seeded(1))
    const bigBlind = from(dealt, 2)
    const state = finish(dealt)
    expect(resultLine(state)).toEqual({ title: `${SEAT_NAMES[bigBlind]}赢了`, line: `其他人都弃牌了，${SEAT_NAMES[bigBlind]}赢得 30` })
  })
})
