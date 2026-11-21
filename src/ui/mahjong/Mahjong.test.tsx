// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { seeded } from "../../mahjong/testing"
import { Mahjong } from "./Mahjong"

const actions = () => within(document.querySelector<HTMLElement>('[data-slot="mj-actions"]')!)
const button = (name: string | RegExp) => actions().queryByRole("button", { name })
const hand = () => screen.getByRole("list", { name: /^你的手牌/ })
const tiles = () => within(hand()).getAllByRole("button")
const river = (who: string) => within(screen.getByRole("region", { name: `${who}的牌河` })).queryAllByRole("img")
const over = () => button(/^(下一局|再开一场)$/) !== null

/** Lets the computer players move until the player has a button to press. */
function waitForButtons() {
  for (let turn = 0; turn < 400 && actions().queryAllByRole("button").length === 0; turn++) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
  }
}

/** The simplest move: win when it is offered, let other discards go, otherwise discard the tile just drawn. */
function move() {
  const win = button(/^(自摸|荣和)$/)
  const pass = button("过")
  if (win) return fireEvent.click(win)
  if (pass) return fireEvent.click(pass)
  const free = tiles().filter((tile) => !(tile as HTMLButtonElement).disabled)
  if (free.length === 0) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    return
  }
  fireEvent.click(free[free.length - 1])
  fireEvent.click(button("打出")!)
}

/** Plays until the hand is over. */
function playHand() {
  for (let step = 0; step < 400; step++) {
    waitForButtons()
    if (over()) return
    move()
  }
  throw new Error("the hand did not finish within 400 moves")
}

/** Plays on to a turn where the player discards, past any discard of someone else's that could be called. */
function untilMyDiscard() {
  for (let step = 0; step < 100; step++) {
    waitForButtons()
    if (button("打出")) return
    move()
  }
  throw new Error("no turn to discard")
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

describe("the mahjong table", () => {
  it("deals the player 13 tiles, or 14 as the dealer, and names every one in Chinese", () => {
    render(<Mahjong onHome={() => {}} />)
    expect([13, 14]).toContain(tiles().length)
    expect(hand().getAttribute("aria-label")).toMatch(/^你的手牌：([一二三四五六七八九][万筒索]|[东南西北白发中])(、|$)/)
    for (const who of ["你", "下家", "对家", "上家"]) expect(screen.getByRole("region", { name: `${who}的牌河` })).toBeTruthy()
    expect(screen.getByRole("group", { name: /^宝牌指示牌：/ })).toBeTruthy()
    expect(screen.getByRole("img", { name: /^牌山还剩 (69|70) 张$/ })).toBeTruthy()
    expect(document.querySelector('[data-slot="mj-round"]')?.textContent).toContain("东一局 · 0 本场")
  })

  it("lifts a tile on the first tap and discards it with 打出", () => {
    render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    const before = { hand: tiles().length, river: river("你").length }
    expect((button("打出") as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(tiles()[0])
    expect(tiles()[0].getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button("打出")!)
    expect(tiles()).toHaveLength(before.hand - 1)
    expect(river("你")).toHaveLength(before.river + 1)
  })

  it("discards a lifted tile on a second tap", () => {
    render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    const count = tiles().length
    fireEvent.click(tiles()[2])
    fireEvent.click(tiles()[2])
    expect(tiles()).toHaveLength(count - 1)
  })

  it("draws the wall as stacks that go as tiles are drawn, with the 宝牌 indicator on the dead wall", () => {
    render(<Mahjong onHome={() => {}} />)
    const stacks = (height: number) => document.querySelectorAll(`[data-slot="mj-stack"][data-height="${height}"]`).length
    const left = () => Number(/\d+/.exec(document.querySelector('[data-slot="mj-walls"]')?.getAttribute("aria-label") ?? "")?.[0])
    expect(document.querySelectorAll('[data-slot="mj-stack"]')).toHaveLength(68)
    expect(document.querySelectorAll('[data-slot="mj-stack"] img')).toHaveLength(1)
    untilMyDiscard()
    // Seven stacks of the dead wall, and one for every two tiles still to draw.
    expect(stacks(2) * 2 + stacks(1)).toBe(left() + 14)
    expect(stacks(0)).toBe(68 - stacks(2) - stacks(1))
  })

  it("says in Chinese what is happening and what the player can do", () => {
    render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    expect(screen.getAllByRole("status")[0].textContent).toMatch(/选一张牌打出。$/)
  })

  it("plays a hand to the end, shows the result with the points, and deals the next hand", () => {
    render(<Mahjong onHome={() => {}} />)
    playHand()
    const result = screen.getByRole("status", { name: "这一局的结果" })
    expect(within(result).getByRole("heading", { level: 2 }).textContent).toMatch(/自摸|荣和|流局|不算/)
    expect(within(result).getByRole("list", { name: "点数变化" }).textContent).toMatch(/你[\d,]+/)
    const next = button("下一局")
    if (!next) return
    fireEvent.click(next)
    expect(screen.queryByRole("status", { name: "这一局的结果" })).toBeNull()
    expect([13, 14]).toContain(tiles().length)
  })

  it("comes back to the same tiles after leaving in the middle of a hand", () => {
    const first = render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    move()
    untilMyDiscard()
    const before = hand().getAttribute("aria-label")
    const rivers = river("对家").length
    first.unmount()
    render(<Mahjong onHome={() => {}} />)
    expect(hand().getAttribute("aria-label")).toBe(before)
    expect(river("对家")).toHaveLength(rivers)
    expect(localStorage.getItem("guandan.mahjong.match")).not.toContain("kind")
  })

  it("starts a 半庄战 from 设置 after a confirmation, and remembers the length", () => {
    render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    move()
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "半庄战" }))
    expect(localStorage.getItem("guandan.mahjong.length")).toBeNull()
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^确认：换成半庄战/ }))
    expect(localStorage.getItem("guandan.mahjong.length")).toBe("2")
    expect(river("你")).toHaveLength(0)
  })

  it("shows the coach's pick and reason on the player's turn, and marks that tile", () => {
    render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    const coach = screen.getByLabelText("教练")
    const pick = coach.getAttribute("data-pick") ?? ""
    expect(pick).toMatch(/^([一二三四五六七八九][万筒索]|[东南西北白发中])$/)
    expect(coach.textContent).toContain(`打${pick}`)
    expect(within(coach).getByRole("list", { name: "教练比较的三种打法" }).textContent).toMatch(/向听|听牌/)
    expect(within(hand()).getAllByRole("button", { name: pick }).some((tile) => tile.hasAttribute("data-coach"))).toBe(true)
    fireEvent.click(within(coach).getByRole("button", { name: "怎么算的" }))
    expect(within(screen.getByRole("dialog")).getByRole("list", { name: "每一种打法" }).children.length).toBeGreaterThan(3)
  })

  it("turns the coach off from the top bar, and remembers it", () => {
    const first = render(<Mahjong onHome={() => {}} />)
    untilMyDiscard()
    fireEvent.click(screen.getByRole("button", { name: "教练" }))
    expect(screen.queryByLabelText("教练")).toBeNull()
    expect(document.querySelectorAll("[data-coach], [data-safety]")).toHaveLength(0)
    expect(localStorage.getItem("guandan.mahjong.coach")).toBe("0")
    first.unmount()
    render(<Mahjong onHome={() => {}} />)
    expect(screen.queryByLabelText("教练")).toBeNull()
    expect(screen.getByRole("button", { name: "教练" }).getAttribute("aria-pressed")).toBe("false")
  })

  it("sets the computer players' level in 设置 and remembers it", () => {
    render(<Mahjong onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    const dialog = within(screen.getByRole("dialog"))
    expect(dialog.getByRole("radio", { name: "普通" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(dialog.getByRole("radio", { name: "进阶" }))
    expect(localStorage.getItem("guandan.mahjong.skill")).toBe("advanced")
    expect(screen.getByRole("dialog").textContent).toContain("和教练的打法一样")
  })

  it("explains the rules one section at a time, with tiles to show what the words mean", () => {
    render(<Mahjong onHome={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "规则" }))
    const rules = screen.getByRole("dialog")
    const heading = (name: string) => within(rules).getByRole("button", { name })
    // The first section is open and shows a winning hand as tiles, named for a screen reader.
    expect(heading("和牌是什么样子").getAttribute("aria-expanded")).toBe("true")
    within(rules).getByRole("img", { name: "一万二万三万" })
    within(rules).getByRole("img", { name: "白白白" })
    // A closed section's tiles are not shown.
    expect(within(rules).queryByRole("img", { name: "九万一万" })).toBeNull()
    // Opening another section closes the first, so the dialog stays about one screen tall.
    fireEvent.click(heading("宝牌"))
    expect(heading("宝牌").getAttribute("aria-expanded")).toBe("true")
    expect(heading("和牌是什么样子").getAttribute("aria-expanded")).toBe("false")
    within(rules).getByRole("img", { name: "九万一万" })
    expect(within(rules).getAllByRole("button").map((each) => each.textContent)).toEqual([
      "和牌是什么样子",
      "顺子、刻子、对子",
      "牌",
      "吃、碰、杠",
      "役：和牌至少要有一个",
      "立直",
      "自摸和荣和",
      "振听：不能荣和的时候",
      "宝牌",
      "流局和坐庄",
      "一场比赛",
      "知道了",
    ])
    // The rules no longer say what 一索 looks like; the tiles show it.
    expect(rules.textContent).not.toContain("鸟")
  })

  it("goes home from the button at the left of the top bar", () => {
    const onHome = vi.fn<() => void>()
    render(<Mahjong onHome={onHome} />)
    fireEvent.click(screen.getByRole("button", { name: "回到首页" }))
    expect(onHome).toHaveBeenCalledOnce()
  })
})
