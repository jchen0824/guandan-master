// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { seeded } from "../../holdem/testing"
import { Holdem } from "./Holdem"

const button = (name: string | RegExp) => screen.queryByRole("button", { name })
const coach = () => screen.getByLabelText("教练")
const shownCards = () => document.querySelectorAll('[data-slot="he-shown"] [data-slot="playing-card"]')

/** Lets the computer players act until the player has buttons to press: a decision, or the next hand. */
function waitForButtons() {
  for (let turn = 0; turn < 60 && !button("弃牌") && !button("下一手"); turn++) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
  }
}

/** Does what the coach's advice says. */
function followAdvice() {
  const title = within(coach()).getByRole("heading", { name: /^建议/ }).textContent ?? ""
  const pick = title.includes("弃牌") ? button("弃牌") : title.includes("过牌") || title.includes("跟注") ? button(/^(过牌|跟注)/) : button(/^(下注|加注到)/)
  if (!pick) throw new Error(`no button for the advice "${title}"`)
  fireEvent.click(pick)
}

/** Plays by the coach's advice until the hand is over. Returns how many decisions that took. */
function playHand() {
  let decisions = 0
  for (let step = 0; step < 40; step++) {
    waitForButtons()
    if (button("下一手")) return decisions
    followAdvice()
    decisions += 1
  }
  throw new Error("the hand did not finish within 40 decisions")
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, "random").mockImplementation(seeded(7))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("the Texas Hold'em table", () => {
  it("seats five opponents, posts the blinds and deals the player two named cards", () => {
    render(<Holdem onHome={() => {}} />)
    for (const name of ["甲", "乙", "丙", "丁", "戊"]) expect(screen.getByRole("region", { name: new RegExp(`^${name}，`) })).toBeTruthy()
    expect(screen.getByLabelText(/^你的手牌：/).querySelectorAll('[data-slot="playing-card"]')).toHaveLength(2)
    expect(screen.getByText("底池").textContent).toBe("底池 30")
    expect(screen.getByLabelText("公共牌还没发")).toBeTruthy()
    expect(screen.getAllByRole("img", { name: /^庄家按钮在/ })).toHaveLength(1)
    expect(screen.getByRole("list", { name: "这一手打到哪一步" }).querySelector("[aria-current]")?.textContent).toBe("翻牌前")
  })

  it("does not show an opponent's cards before the hand is over", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    expect(shownCards()).toHaveLength(0)
    expect(document.querySelectorAll('[data-slot="playing-card"]').length).toBeLessThanOrEqual(7)
  })

  it("gives advice in Chinese with a win rate when it is the player's turn", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    const panel = within(coach())
    expect(panel.getByRole("heading", { name: /^建议：(弃牌|过牌|跟注|下注|加注到)/ })).toBeTruthy()
    expect(panel.getByText("你的胜率，大约").nextElementSibling?.textContent).toMatch(/^\d+%$/)
    expect(panel.getByRole("status").textContent).toMatch(/底池现在 \d/)
    expect(button("弃牌")).toBeTruthy()
    expect(button(/^(过牌|跟注 \d)/)).toBeTruthy()
  })

  it("raises to the size the player picked", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    const sizes = within(screen.getByRole("group", { name: /多少$/ }))
    const pot = sizes.getByRole("button", { name: /^满池/ })
    fireEvent.click(pot)
    expect(pot.getAttribute("aria-pressed")).toBe("true")
    const amount = pot.querySelector("b")?.textContent ?? ""
    const raise = screen.getByRole("button", { name: new RegExp(`^(下注|加注到) ${amount}$`) })
    fireEvent.click(raise)
    expect(screen.getByText(/^筹码 /, { selector: '[data-slot="he-me"] *' }).textContent).not.toBe("筹码 2,000")
  })

  it("plays a hand by the coach's advice, grades every decision and deals the next hand", () => {
    render(<Holdem onHome={() => {}} />)
    const decisions = playHand()
    expect(decisions).toBeGreaterThan(0)

    const panel = within(coach())
    expect(panel.getByRole("heading", { name: `教练 · 这一手你做了 ${decisions} 个决定` })).toBeTruthy()
    const graded = coach().querySelectorAll('ol[data-slot="he-review"] > li')
    expect(graded).toHaveLength(decisions)
    for (const item of graded) expect(item.getAttribute("data-verdict")).toBe("good")
    expect(screen.getAllByRole("status").some((el) => /赢得? ?[\d,]+|平分底池/.test(el.textContent ?? ""))).toBe(true)
    expect(button(/^(弃牌|过牌|跟注)/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "下一手" }))
    expect(screen.getByText(/第 2 手/)).toBeTruthy()
    expect(shownCards()).toHaveLength(0)
  })

  it("turns over the hands that reach a showdown and names the winning hand", () => {
    render(<Holdem onHome={() => {}} />)
    let showdown = false
    for (let hand = 0; hand < 30 && !showdown; hand++) {
      waitForButtons()
      // Calling or checking every time keeps the player in to the river.
      while (!button("下一手")) {
        fireEvent.click(screen.getByRole("button", { name: /^(过牌|跟注)/ }))
        waitForButtons()
      }
      showdown = shownCards().length > 0
      if (!showdown) fireEvent.click(screen.getByRole("button", { name: "下一手" }))
    }
    expect(showdown).toBe(true)
    expect(shownCards().length % 2).toBe(0)
    expect(screen.getByRole("list", { name: "这一手打到哪一步" }).querySelector("[aria-current]")?.textContent).toBe("摊牌")
    expect(document.querySelector('[data-slot="he-banner"] b')?.textContent).toMatch(/同花顺|四条|葫芦|同花|顺子|三条|两对|一对|高牌/)
    expect(document.querySelectorAll('[data-mark="used"]')).toHaveLength(5)
  })

  it("opens the review of the hand in a dialog for screens where the panel is only a bar", () => {
    render(<Holdem onHome={() => {}} />)
    const decisions = playHand()
    fireEvent.click(screen.getByRole("button", { name: "看复盘" }))
    const dialog = within(screen.getByRole("dialog", { name: "这一手的复盘" }))
    expect(dialog.getAllByRole("listitem")).toHaveLength(decisions)
  })

  it("explains the rules in a dialog", () => {
    render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "规则" }))
    expect(screen.getByRole("dialog", { name: "德州扑克怎么打" })).toBeTruthy()
  })
})
