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
