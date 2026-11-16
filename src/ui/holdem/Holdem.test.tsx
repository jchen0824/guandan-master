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

/** The button for each kind of advice. A raise button starts at the coach's amount, so pressing it follows the advice. */
const FOR_ADVICE: Record<string, RegExp> = { fold: /^弃牌$/, check: /^过牌$/, call: /^跟注/, raise: /^(下注|加注到) / }

/** Does what the coach's advice says. */
function followAdvice() {
  const kind = coach().getAttribute("data-advice") ?? ""
  const pick = button(FOR_ADVICE[kind] ?? /^$/)
  if (!pick) throw new Error(`no button for the advice "${kind}"`)
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
  localStorage.clear()
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
    expect(coach().querySelector('[data-slot="he-why"]')?.textContent).toMatch(/[一-鿿]{4}/)
    expect(panel.getByText("你的胜率，大约").nextElementSibling?.textContent).toMatch(/^\d+%$/)
    expect(panel.getByRole("status").textContent).toMatch(/底池现在 \d/)
    expect(button("弃牌")).toBeTruthy()
    expect(button(/^(过牌|跟注 \d)/)).toBeTruthy()
  })

  it("starts the raise button at the coach's amount when the advice is to raise", () => {
    render(<Holdem onHome={() => {}} />)
    for (let hand = 0; hand < 20 && coach().getAttribute("data-advice") !== "raise"; hand++) {
      waitForButtons()
      if (coach().getAttribute("data-advice") === "raise") break
      fireEvent.click(button(/^(弃牌|下一手)$/) as HTMLElement)
    }
    expect(coach().getAttribute("data-advice")).toBe("raise")
    expect(button(/^(下注|加注到) [\d,]+$/)).toBeTruthy()
  })

  it("turns the coach off and on from the top bar, and remembers the choice", () => {
    const first = render(<Holdem onHome={() => {}} />)
    waitForButtons()
    const toggle = screen.getByRole("button", { name: "教练" })
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(screen.queryByLabelText("教练")).toBeNull()
    expect(screen.queryByText("你的胜率，大约")).toBeNull()
    // What is happening at the table still shows, in one plain line.
    expect(within(screen.getByLabelText("牌桌动态")).getByRole("status").textContent).toMatch(/底池现在 \d/)
    expect(localStorage.getItem("guandan.holdem.coach")).toBe("0")
    first.unmount()

    render(<Holdem onHome={() => {}} />)
    expect(screen.getByRole("button", { name: "教练" }).getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "教练" }))
    expect(screen.getByLabelText("教练")).toBeTruthy()
    expect(localStorage.getItem("guandan.holdem.coach")).toBe("1")
  })

  it("plays a hand to the end with the coach off, and shows the result without the review", () => {
    localStorage.setItem("guandan.holdem.coach", "0")
    render(<Holdem onHome={() => {}} />)
    for (let step = 0; step < 40 && !button("下一手"); step++) {
      waitForButtons()
      if (button("下一手")) break
      fireEvent.click(button(/^(过牌|跟注)/) as HTMLElement)
    }
    expect(button("下一手")).toBeTruthy()
    expect(button("看复盘")).toBeNull()
    expect(within(screen.getByLabelText("牌桌动态")).getByRole("status").textContent).toMatch(/赢得|平分底池/)
  })

  it("sets the raise to exactly all-in at the far end of the slider, and to the minimum at the near end", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    const slider = screen.getByRole("slider")
    const sizes = within(screen.getByRole("group", { name: /多少$/ }))
    for (const [end, preset] of [
      [slider.getAttribute("max") ?? "", "全下"],
      ["0", "最小"],
    ]) {
      fireEvent.change(slider, { target: { value: end } })
      const amount = sizes.getByRole("button", { name: new RegExp(`^${preset}`) }).querySelector("b")?.textContent ?? ""
      expect(slider.getAttribute("aria-valuetext")).toBe(amount)
      expect(screen.getByRole("button", { name: new RegExp(`^(下注|加注到) ${amount}$`) })).toBeTruthy()
    }
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

  it("sets the computer players' level in 设置 and remembers it", () => {
    const first = render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    const dialog = within(screen.getByRole("dialog", { name: "电脑玩家水平" }))
    expect(dialog.getByRole("radio", { name: "普通" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(dialog.getByRole("radio", { name: "进阶" }))
    expect(dialog.getByRole("radio", { name: "进阶" }).getAttribute("aria-checked")).toBe("true")
    expect(dialog.getByText(/偷盲/)).toBeTruthy()
    expect(localStorage.getItem("guandan.holdem.skill")).toBe("advanced")
    first.unmount()

    render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    expect(within(screen.getByRole("dialog")).getByRole("radio", { name: "进阶" }).getAttribute("aria-checked")).toBe("true")
  })

  it("plays a whole hand with novice computer players", () => {
    localStorage.setItem("guandan.holdem.skill", "novice")
    render(<Holdem onHome={() => {}} />)
    expect(playHand()).toBeGreaterThan(0)
    expect(button("下一手")).toBeTruthy()
  })

  it("explains the rules in a dialog", () => {
    render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "规则" }))
    expect(screen.getByRole("dialog", { name: "德州扑克怎么打" })).toBeTruthy()
  })
})
