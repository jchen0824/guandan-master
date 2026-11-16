import { describe, expect, it } from "vitest"
import { nearestStep, raiseSteps } from "./sizes"

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
