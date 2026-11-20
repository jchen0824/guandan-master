// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { seeded } from "../../holdem/testing"
import { Holdem } from "./Holdem"

const button = (name: string | RegExp) => screen.queryByRole("button", { name })
/** A button in the row of actions (弃牌, 跟注, the raise), not a size button that can have the same words. */
const action = (name: string | RegExp) => {
  const row = document.querySelector<HTMLElement>('[data-slot="he-buttons"]')
  return row ? within(row).queryByRole("button", { name }) : null
}
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
const FOR_ADVICE: Record<string, RegExp> = { fold: /^弃牌$/, check: /^过牌$/, call: /^跟注/, raise: /^(下注|加注到|全下) / }

/** Does what the coach's advice says. */
function followAdvice() {
  const kind = coach().getAttribute("data-advice") ?? ""
  const pick = action(FOR_ADVICE[kind] ?? /^$/)
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
    expect(action(/^(下注|加注到|全下) [\d,]+$/)).toBeTruthy()
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

  it("sets the raise to exactly all-in at the far end of the slider, and to the minimum at the near end, and shows it beside the slider", () => {
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
      expect(slider.closest("label")?.querySelector("b")?.textContent, "the amount beside the slider").toBe(amount)
      // At the far end the raise button says 全下; at the near end 下注 or 加注到.
      const label = preset === "全下" ? "全下" : "(下注|加注到)"
      expect(action(new RegExp(`^${label} ${amount}$`))).toBeTruthy()
    }
  })

  it("shows how much the player has put into the hand once they have", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    fireEvent.click(button(/^(过牌|跟注)/) as HTMLElement)
    expect(document.querySelector('[data-slot="he-in"]')?.textContent).toMatch(/^本手已下 [\d,]+$/)
  })

  it("raises to the size the player picked", () => {
    render(<Holdem onHome={() => {}} />)
    waitForButtons()
    const sizes = within(screen.getByRole("group", { name: /多少$/ }))
    const pot = sizes.getByRole("button", { name: /^满池/ })
    fireEvent.click(pot)
    expect(pot.getAttribute("aria-pressed")).toBe("true")
    const amount = pot.querySelector("b")?.textContent ?? ""
    const raise = action(new RegExp(`^(下注|加注到|全下) ${amount}$`)) as HTMLElement
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

  it("shows how the coach worked out the win rate after the flop, and all of it in a dialog", () => {
    render(<Holdem onHome={() => {}} />)
    // Checking or calling every time reaches the flop with the player still in.
    for (let step = 0; step < 300 && !button("怎么算的"); step++) {
      waitForButtons()
      const next = button("下一手")
      if (next) fireEvent.click(next)
      else fireEvent.click(action(/^(过牌|跟注)/) as HTMLElement)
    }
    const panel = within(coach())
    expect(panel.getByText("估算")).toBeTruthy()
    expect(panel.getByText(/二四法则|不用数有效牌|没有有效牌|牌已经发完/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "怎么算的" }))
    const dialog = within(screen.getByRole("dialog", { name: "教练是怎么算的" }))
    for (const label of ["你的牌", "对手", "估算", "你的胜率，大约"]) expect(dialog.getByText(label)).toBeTruthy()
    // The situation is announced once, by the panel, not again by the copy in the dialog.
    expect(dialog.queryByRole("status")).toBeNull()
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

  it("keeps the table between visits, from the next hand, and starts over from 设置", () => {
    const first = render(<Holdem onHome={() => {}} />)
    playHand()
    const saved = JSON.parse(localStorage.getItem("guandan.holdem.table") ?? "null")
    expect(saved).toMatchObject({ version: 2, handNumber: 1 })
    first.unmount()

    render(<Holdem onHome={() => {}} />)
    expect(document.querySelector('[data-slot="he-hand"]')?.textContent).toContain("第 2 手")
    const mine = saved.stacks[0] < 20 ? 2000 : saved.stacks[0]
    const me = document.querySelector('[data-slot="he-me"]')?.textContent ?? ""
    const inHand = Number(/本手已下 ([\d,]+)/.exec(me)?.[1]?.replace(/,/g, "") ?? 0)
    expect(Number(/筹码 ([\d,]+)/.exec(me)?.[1]?.replace(/,/g, "")) + inHand).toBe(mine)

    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    fireEvent.click(screen.getByRole("button", { name: "重新开始" }))
    fireEvent.click(screen.getByRole("button", { name: /^确认：所有人回到 2,000 筹码/ }))
    expect(document.querySelector('[data-slot="he-hand"]')?.textContent).toContain("第 1 手")
    expect(JSON.parse(localStorage.getItem("guandan.holdem.table") ?? "null")).toMatchObject({ handNumber: 1, stacks: [2000, 2000, 2000, 2000, 2000, 2000] })
  })

  it("brings back the hand being played, with the same cards and board, when the player leaves and comes back", () => {
    const first = render(<Holdem onHome={() => {}} />)
    for (let step = 0; step < 20 && !(button("弃牌") && screen.queryByLabelText(/^公共牌：/)); step++) {
      waitForButtons()
      const call = action(/^(过牌|跟注)/)
      if (!call) throw new Error("the hand ended before the flop")
      if (!screen.queryByLabelText(/^公共牌：/)) fireEvent.click(call)
    }
    const table = () => ({
      hand: document.querySelector('[data-slot="he-hand"]')?.textContent,
      mine: screen.getByLabelText(/^你的手牌：/).getAttribute("aria-label"),
      board: screen.getByLabelText(/^公共牌：/).getAttribute("aria-label"),
      pot: screen.getByText("底池").textContent,
    })
    const left = table()
    expect(left.board?.split("、")).toHaveLength(3)
    // What the screen wrote to storage keeps the hand without naming a card.
    const saved = localStorage.getItem("guandan.holdem.table") ?? ""
    expect(saved).toMatch(/"order":"[0-9a-z]+"/)
    expect(saved).not.toMatch(/"(deck|hole|board|cards?|suit|rank)"/)
    first.unmount()

    render(<Holdem onHome={() => {}} />)
    expect(table()).toEqual(left)
    expect(action(/^(过牌|跟注)/)).toBeTruthy()
  })

  it("shows a player who is out of chips as 出局, without cards, and plays on without them", () => {
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 4, button: 0, stacks: [2000, 0, 2000, 2000, 2000, 4000] }))
    render(<Holdem onHome={() => {}} />)
    const out = screen.getByRole("region", { name: "甲，出局" })
    expect(out.textContent).toContain("没有筹码了")
    expect(out.hasAttribute("data-out")).toBe(true)
    expect(screen.getAllByRole("region", { name: /，/ }).filter((seat) => seat.hasAttribute("data-out"))).toHaveLength(1)
    playHand()
    expect(screen.getByRole("region", { name: "甲，出局" })).toBeTruthy()
  })

  it("ends the table when the player is out, and deals a new one from 再开一桌", () => {
    // Heads-up with two big blinds against everything else: the blinds alone finish the player off.
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 9, button: 0, stacks: [40, 0, 0, 0, 0, 11960] }))
    const first = render(<Holdem onHome={() => {}} />)
    // Plays by the coach's advice, hand after hand, until the table is over.
    for (let step = 0; step < 600 && !button("再开一桌"); step++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      const next = button("下一手")
      if (next) fireEvent.click(next)
      else if (button("弃牌")) followAdvice()
    }
    expect(button("下一手")).toBeNull()
    expect(document.querySelector('[data-slot="he-banner"] b')?.textContent).toMatch(/^(你出局了|全桌冠军)$/)
    // A table that has ended is not resumed: the next visit starts a new one, as 再开一桌 does now.
    first.unmount()
    render(<Holdem onHome={() => {}} />)
    expect(screen.getByText(/第 1 手/)).toBeTruthy()
    cleanup()
    render(<Holdem onHome={() => {}} />)
    expect(screen.queryAllByRole("region", { name: /出局/ })).toHaveLength(0)
  })

  const seatNames = () => Array.from(document.querySelectorAll('[data-slot="he-seat"] [data-slot="he-who"] b'), (name) => name.textContent)

  it("starts a nine-seat table from 设置 after a confirm, and keeps the size across a reload before the first hand ends", () => {
    const first = render(<Holdem onHome={() => {}} />)
    expect(seatNames()).toEqual(["甲", "乙", "丙", "丁", "戊"])
    expect(document.querySelector('[data-slot="holdem"]')?.getAttribute("data-seats")).toBe("6")
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    const dialog = within(screen.getByRole("dialog", { name: "电脑玩家水平" }))
    expect(dialog.getByRole("radio", { name: "6 人" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(dialog.getByRole("radio", { name: "9 人" }))
    expect(dialog.getByText(/枪口\+1、枪口\+2 和劫位/)).toBeTruthy()
    expect(localStorage.getItem("guandan.holdem.seats")).toBeNull()
    fireEvent.click(dialog.getByRole("button", { name: "确认：换成 9 人桌，所有人回到 2,000 筹码，从第 1 手开始" }))
    expect(seatNames()).toEqual(["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛"])
    expect(document.querySelector('[data-slot="holdem"]')?.getAttribute("data-seats")).toBe("9")
    expect(document.querySelector('[data-slot="he-hand"]')?.textContent).toContain("第 1 手")
    expect(localStorage.getItem("guandan.holdem.seats")).toBe("9")
    first.unmount()

    render(<Holdem onHome={() => {}} />)
    expect(seatNames()).toHaveLength(8)
    expect(screen.getByLabelText(/^你的手牌/).querySelectorAll('[data-slot="playing-card"]')).toHaveLength(2)
  })

  it("changes nothing when 设置 is closed without confirming a new size", () => {
    render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "9 人" }))
    expect(within(screen.getByRole("dialog")).getByRole("radio", { name: "9 人" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "好了" }))
    expect(seatNames()).toHaveLength(5)
    expect(localStorage.getItem("guandan.holdem.seats")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    expect(within(screen.getByRole("dialog")).getByRole("radio", { name: "6 人" }).getAttribute("aria-checked")).toBe("true")
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "重新开始" })).toBeTruthy()
  })

  it("deals 再开一桌 at the size of the table that ended", () => {
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 9, button: 0, stacks: [40, 0, 0, 0, 0, 0, 0, 0, 11960] }))
    render(<Holdem onHome={() => {}} />)
    expect(seatNames()).toHaveLength(8)
    for (let step = 0; step < 600 && !button("再开一桌"); step++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      const next = button("下一手")
      if (next) fireEvent.click(next)
      else if (button("弃牌")) followAdvice()
    }
    fireEvent.click(button("再开一桌") as HTMLElement)
    expect(seatNames()).toHaveLength(8)
    expect(document.querySelector('[data-slot="he-hand"]')?.textContent).toContain("第 1 手")
    expect(localStorage.getItem("guandan.holdem.seats")).toBe("9")
  })

  it("explains the rules in a dialog", () => {
    render(<Holdem onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "规则" }))
    const dialog = within(screen.getByRole("dialog", { name: "德州扑克怎么打" }))
    // How to estimate a win rate at the table, in words a beginner can use: outs, the 2-and-4 rule, the price.
    const estimate = within(dialog.getByRole("list", { name: "自己估胜率" }))
    expect(estimate.getByText("二四法则")).toBeTruthy()
    expect(estimate.getByText(/每张有效牌约 4%，所以中的机会约等于有效牌数 × 4/)).toBeTruthy()
    expect(estimate.getAllByRole("listitem")).toHaveLength(3)
    // The price counts only the chips the player can win, as potOdds() does: not side-pot chips beyond their stack.
    expect(estimate.getByText(/跟注的钱 ÷ 跟注后你能赢的全部筹码/)).toBeTruthy()
    expect(estimate.queryByText(/底池里的全部筹码/)).toBeNull()
    expect(dialog.getByText(/位置：庄位左边是小盲、大盲/)).toBeTruthy()
  })
})
