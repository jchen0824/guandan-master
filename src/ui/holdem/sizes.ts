import { chips } from "../../holdem/cards"
import { legalActions } from "../../holdem/game"
import type { HoldemState } from "../../holdem/game"

/**
 * The amounts a raise can be set to: the smallest raise the rules allow, every multiple of 10 chips above it,
 * and all-in. The two ends are exact, so a stack left at 2,015 by a split pot can still go all-in.
 */
export function raiseSteps(least: number, most: number): number[] {
  const steps = [least]
  for (let to = Math.floor(least / 10) * 10 + 10; to < most; to += 10) steps.push(to)
  if (most > least) steps.push(most)
  return steps
}

/** The step nearest to `to`. */
export function nearestStep(steps: readonly number[], to: number): number {
  let best = steps[0]
  for (const step of steps) if (Math.abs(step - to) < Math.abs(best - to)) best = step
  return best
}

/**
 * What the raise controls offer the player to act: the amounts the slider moves through, the size buttons,
 * and the size from a share of the pot. Null when they cannot raise. When the smallest legal raise is the
 * whole stack, all-in is the only raise there is, and there are no size buttons: five buttons that all said
 * the same amount only confused players.
 */
export function raiseSizes(game: HoldemState): { steps: number[]; presets: [string, number][]; most: number; ofPot: (share: number) => number } | null {
  const legal = legalActions(game)
  const { minRaiseTo: least, maxRaiseTo: most } = legal
  if (least === null || most === null) return null
  const steps = raiseSteps(least, most)
  const ofPot = (share: number) => nearestStep(steps, game.currentBet + (game.pot + legal.callAmount) * share)
  const presets: [string, number][] =
    least === most
      ? []
      : [
          ["最小", least],
          ["半池", ofPot(1 / 2)],
          ["三分之二", ofPot(2 / 3)],
          ["满池", ofPot(1)],
          ["全下", most],
        ]
  return { steps, presets, most, ofPot }
}

/** The raise button: 全下 when the amount is the whole stack, otherwise 下注 or 加注到 the amount. */
export function raiseLabel(game: HoldemState, to: number, most: number): string {
  if (to === most) return `全下 ${chips(to)}`
  return `${game.currentBet > 0 ? "加注到" : "下注"} ${chips(to)}`
}
