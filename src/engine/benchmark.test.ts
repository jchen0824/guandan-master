import { it } from "vitest"
import { advise, chooseReturn } from "./bot"
import type { Skill } from "./bot"
import { newMatch, pass, play, returnTribute, teamOf } from "./game"
import type { GameState } from "./game"

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function playHand(seed: number, skills: Skill[]): GameState {
  const random = seeded(seed)
  let state = newMatch(random)
  while (state.phase === "return") {
    const t = state.tributes.find((x) => !x.returned)!
    state = returnTribute(state, t.to, chooseReturn(state.hands[t.to], state.level).id)
  }
  while (state.phase === "play") {
    const { combo } = advise(state, state.turn, skills[state.turn], random)
    state = combo ? play(state, state.turn, combo.cards) : pass(state, state.turn)
  }
  return state
}

function series(name: string, hands: number, skillsFor: (seed: number) => Skill[], strongTeam?: (seed: number) => number) {
  let doubles = 0
  let strongWins = 0
  let strongDoubles = 0
  for (let seed = 1; seed <= hands; seed++) {
    const result = playHand(seed, skillsFor(seed)).result!
    if (result.gain === 3) doubles++
    if (strongTeam && result.winnerTeam === strongTeam(seed)) {
      strongWins++
      if (result.gain === 3) strongDoubles++
    }
  }
  const pct = (n: number) => `${Math.round((n / hands) * 100)}%`
  console.log(
    `${name}: double wins ${pct(doubles)}` +
      (strongTeam ? `, stronger side wins ${pct(strongWins)} (by a double ${pct(strongDoubles)})` : ""),
  )
}

it.runIf(import.meta.env.VITE_BENCH)("benchmarks the bot levels", () => {
  const hands = 300
  const all = (skill: Skill) => () => [skill, skill, skill, skill]
  const versus = (strong: Skill, weak: Skill) => (seed: number) =>
    [0, 1, 2, 3].map((p) => (teamOf(p) === seed % 2 ? strong : weak))
  series("advanced vs advanced", hands, all("advanced"))
  series("basic vs basic", hands, all("basic"))
  series("advanced vs basic", hands, versus("advanced", "basic"), (seed) => seed % 2)
  series("basic vs novice", hands, versus("basic", "novice"), (seed) => seed % 2)
  series("advanced vs novice", hands, versus("advanced", "novice"), (seed) => seed % 2)
}, 600000)
