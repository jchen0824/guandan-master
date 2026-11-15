import { describe, expect, it } from "vitest"
import { advise, chooseReturn } from "../engine/bot"
import { isWild } from "../engine/cards"
import { newMatch, pass, play, returnTribute, startNextHand } from "../engine/game"
import type { GameState } from "../engine/game"
import { HUMAN } from "./names"
import { tributeLines } from "./tribute"
import { unseen } from "./unseen"

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function playOut(state: GameState, turns = Infinity): GameState {
  for (let turn = 0; state.phase === "play" && turn < turns; turn++) {
    const { combo } = advise(state, state.turn)
    state = combo ? play(state, state.turn, combo.cards) : pass(state, state.turn)
  }
  return state
}

const cell = (state: GameState, key: string) => unseen(state).find((c) => c.key === key)

describe("记牌器", () => {
  it("counts the wild hearts apart from the other level cards", () => {
    const state = newMatch(seeded(3))
    const mine = state.hands[HUMAN]
    const wilds = mine.filter((c) => isWild(c, state.level)).length
    const otherLevel = mine.filter((c) => c.rank === state.level && !isWild(c, state.level)).length
    expect(cell(state, "wild")).toMatchObject({ label: "♥2", left: 2 - wilds })
    expect(cell(state, "level")).toMatchObject({ label: "2", left: 6 - otherLevel })
    expect(unseen(state)).toHaveLength(16)
  })

  it("always adds up to the cards the other three players hold", () => {
    let state = newMatch(seeded(4))
    for (let step = 0; step < 12 && state.phase === "play"; step++) {
      const hidden = state.hands.reduce((n, hand, p) => (p === HUMAN ? n : n + hand.length), 0)
      expect(unseen(state).reduce((n, c) => n + c.left, 0)).toBe(hidden)
      state = playOut(state, 5)
    }
  })

  it("lowers the wild count when a wild heart is played", () => {
    let state = newMatch(seeded(5))
    let seen = cell(state, "wild")?.left ?? 0
    let dropped = false
    while (state.phase === "play") {
      const before = state
      state = playOut(state, 1)
      const record = state.log[state.log.length - 1]
      const played = record?.combo?.cards.filter((c) => isWild(c, before.level)).length ?? 0
      if (state.phase !== "play") break
      const now = cell(state, "wild")?.left ?? 0
      if (record && record.player !== HUMAN) {
        expect(now).toBe(seen - played)
        dropped ||= played > 0
      }
      seen = now
    }
    expect(dropped).toBe(true)
  })
})

describe("进贡记录", () => {
  it("is empty on the first hand", () => {
    expect(tributeLines(newMatch(seeded(1)))).toEqual([])
  })

  it("names who paid, what, and what came back", () => {
    for (const seed of [21, 22, 23, 24]) {
      let state = startNextHand(playOut(newMatch(seeded(seed))), seeded(seed + 100))
      if (state.tributeResisted) {
        expect(tributeLines(state)).toEqual(["抗贡：输家持有两张大王，本局不进贡。"])
        continue
      }
      expect(tributeLines(state)).toHaveLength(state.tributes.length)
      for (const line of tributeLines(state)) expect(line).toMatch(/^.+向.+进贡 .+，等待还贡。$/)
      while (state.phase === "return") {
        const pending = state.tributes.find((t) => !t.returned)
        if (!pending) break
        state = returnTribute(state, pending.to, chooseReturn(state.hands[pending.to], state.level).id)
      }
      for (const line of tributeLines(state)) expect(line).toMatch(/^.+向.+进贡 .+，.+还贡 .+。$/)
      const ended = playOut(state)
      expect(tributeLines(ended)).toEqual(tributeLines(state))
    }
  })
})
