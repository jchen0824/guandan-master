import { describe, expect, it } from "vitest"
import { SEAT_NAMES, act, legalActions, newTable, resumeTable } from "../../holdem/game"
import type { HoldemState } from "../../holdem/game"
import { rig, seeded, stacked } from "../../holdem/testing"
import { biggestWinner, resultLine } from "./summary"

const from = (state: HoldemState, offset: number) => (state.button + offset) % state.seats.length

/** Everyone still to act folds or checks until the hand is over. */
function finish(state: HoldemState): HoldemState {
  let now = state
  while (now.toAct !== null) now = act(now, now.toAct, legalActions(now).canCheck ? { kind: "check" } : { kind: "fold" })
  return now
}

/** Calls or checks until the hand is over. */
function callDown(state: HoldemState): HoldemState {
  let now = state
  while (now.toAct !== null) now = act(now, now.toAct, legalActions(now).canCheck ? { kind: "check" } : { kind: "call" })
  return now
}

const table = (stacks: number[]) => resumeTable({ version: 1, savedAt: "", handNumber: 1, button: 0, stacks }, seeded(1))

describe("the end of a table", () => {
  it("names who lost their last chips, and says when that ends the table for the player", () => {
    // Three left: 甲 goes all-in with seven-two against the player's aces and is out. The table goes on.
    const three = rig(table([2000, 100, 0, 0, 0, 2000]), { 0: "AH AS", 1: "7C 2D", 5: "QC JC" }, "KD 9S 4H 3C 8D")
    let state = three
    while (state.toAct !== null) state = act(state, state.toAct, state.toAct === 1 ? { kind: "raise", to: 100 } : state.toAct === 5 ? { kind: "fold" } : legalActions(state).canCheck ? { kind: "check" } : { kind: "call" })
    expect(resultLine(state)).toEqual({ title: "一对", line: "你用一对 A，赢得 210。甲输光了筹码，出局" })

    const lost = callDown(act(rig(table([100, 0, 0, 0, 0, 11900]), { 0: "7C 2D", 5: "AH AS" }, "KD 9S 4H 3C JD"), 5, { kind: "raise", to: 200 }))
    expect(resultLine(lost)?.title).toBe("你出局了")

    const won = callDown(act(rig(table([11900, 0, 0, 0, 0, 100]), { 0: "AH AS", 5: "7C 2D" }, "KD 9S 4H 3C JD"), 5, { kind: "raise", to: 100 }))
    expect(resultLine(won)).toEqual({ title: "全桌冠军", line: "你用一对 A，赢得 200。戊输光了筹码，出局" })
  })
})

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
