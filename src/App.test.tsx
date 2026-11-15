// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const hand = () => screen.getByLabelText("你的操作").querySelectorAll("[data-card-id]")

/** Lets the bots play until the human may act. */
function waitForMyTurn() {
  for (let turn = 0; turn < 40 && !screen.queryByRole("button", { name: "提示" }); turn++) {
    act(() => {
      vi.advanceTimersByTime(1000)
    })
  }
  return screen.getByRole("button", { name: "提示" })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, "random").mockImplementation(seeded(5))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("the game screen", () => {
  it("deals 27 named cards and shows the top bar in Chinese", () => {
    render(<App />)
    expect(hand()).toHaveLength(27)
    for (const card of hand()) expect(card.getAttribute("aria-label")).toMatch(/[一-鿿]|\d|[JQKA]/)
    for (const name of ["规则", "复盘", "设置"]) expect(screen.getByRole("button", { name })).toBeTruthy()
  })

  it("plays the hinted cards when it is the player's turn", () => {
    render(<App />)
    fireEvent.click(waitForMyTurn())
    const picked = [...hand()].filter((card) => card.getAttribute("aria-pressed") === "true").length
    expect(picked).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "出牌" }))
    expect(hand()).toHaveLength(27 - picked)
  })

  it("opens the rules in a dialog with a title", () => {
    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "规则" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("掼蛋规则速查")).toBeTruthy()
  })

  it("counts the wild hearts in their own cell of the card counter", () => {
    render(<App />)
    const tracker = screen.getByLabelText("记牌器：其他三家手里还剩的牌")
    expect(tracker.querySelectorAll("dd")).toHaveLength(16)
    const wild = within(tracker).getByLabelText("逢人配（红桃2）")
    expect(wild.textContent).toBe("♥2")
    expect(Number(wild.nextElementSibling?.textContent)).toBeLessThanOrEqual(2)
  })

  it("lists the plays under a heading in the review dialog", () => {
    render(<App />)
    waitForMyTurn()
    fireEvent.click(screen.getByRole("button", { name: "复盘" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "出牌记录" })).toBeTruthy()
    expect(within(dialog).queryByRole("heading", { name: "进贡记录" })).toBeNull()
  })

  it("shows the version and a link to the source in settings", () => {
    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    const about = within(screen.getByRole("dialog")).getByRole("region", { name: "关于" })
    expect(about.textContent).toMatch(/v\d+\.\d+\.\d+ · \d{4}-\d{2}-\d{2} 更新/)
    const link = within(about).getByRole("link", { name: "GitHub 源代码" })
    expect(link.getAttribute("href")).toBe("https://github.com/jchen0824/guandan-master")
    expect(link.getAttribute("target")).toBe("_blank")
  })

  it("waits for the player before showing the result of a hand", () => {
    render(<App />)
    const button = (name: string) => screen.queryByRole("button", { name })
    for (let step = 0; step < 600 && !button("查看结果"); step++) {
      if (button("提示")) {
        fireEvent.click(screen.getByRole("button", { name: "提示" }))
        const picked = [...hand()].some((card) => card.getAttribute("aria-pressed") === "true")
        fireEvent.click(screen.getByRole("button", { name: picked ? "出牌" : "不出" }))
      }
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("本局结束"))).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "查看结果" }))
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "下一局" })).toBeTruthy()

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "再看看牌桌" }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "查看结果" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "下一局" }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole("button", { name: "查看结果" })).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("keeps the match in browser storage under documented keys only", () => {
    render(<App />)
    waitForMyTurn()
    for (let i = 0; i < localStorage.length; i++) expect(localStorage.key(i)).toMatch(/^guandan\./)
  })
})
