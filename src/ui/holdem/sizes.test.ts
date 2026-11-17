import { describe, expect, it } from "vitest"
import { HERO, act, legalActions, newTable } from "../../holdem/game"
import type { HoldemState } from "../../holdem/game"
import { seeded, stacked } from "../../holdem/testing"
import { nearestStep, raiseLabel, raiseSizes, raiseSteps } from "./sizes"

/** The player with `stack` chips, facing a raise to `to` before the flop from the first player to act. */
function facing(stack: number, to: number): HoldemState {
  let state = stacked(newTable(seeded(1)), { [HERO]: stack })
  while (state.toAct !== HERO) {
    const seat = state.toAct as number
    state = act(state, seat, state.currentBet < to ? { kind: "raise", to } : { kind: "fold" })
  }
  return state
}

describe("the raise sizes", () => {
  it("runs from the smallest raise to all-in exactly, in tens between", () => {
    expect(raiseSteps(40, 2015).slice(0, 3)).toEqual([40, 50, 60])
    expect(raiseSteps(40, 2015).slice(-3)).toEqual([2000, 2010, 2015])
    expect(raiseSteps(45, 95)).toEqual([45, 50, 60, 70, 80, 90, 95])
    expect(raiseSteps(300, 300)).toEqual([300])
  })

  it("picks the nearest step for a size worked out from the pot", () => {
    const steps = raiseSteps(40, 2015)
    expect(nearestStep(steps, 133)).toBe(130)
    expect(nearestStep(steps, 2014)).toBe(2015)
    expect(nearestStep(steps, 5000)).toBe(2015)
    expect(nearestStep(steps, 0)).toBe(40)
  })
})

describe("the raise controls", () => {
  it("offers only all-in when the smallest raise is more than the player has", () => {
    // 1,400 chips facing 930: a raise must reach at least 1,840, so all-in is the only raise there is.
    const state = facing(1400, 930)
    expect(legalActions(state).minRaiseTo).toBe(1400)
    const sizes = raiseSizes(state)
    expect(sizes?.presets).toEqual([])
    expect(sizes?.steps).toEqual([1400])
    expect(raiseLabel(state, 1400, 1400)).toBe("全下 1,400")
  })

  it("offers five sizes otherwise, and calls the biggest one all-in", () => {
    const state = facing(2000, 60)
    const sizes = raiseSizes(state)
    expect(sizes?.presets.map(([name]) => name)).toEqual(["最小", "半池", "三分之二", "满池", "全下"])
    expect(raiseLabel(state, 120, sizes?.most ?? 0)).toBe("加注到 120")
    expect(raiseLabel(state, sizes?.most ?? 0, sizes?.most ?? 0)).toBe(`全下 ${(sizes?.most ?? 0).toLocaleString("en-US")}`)
  })
})
