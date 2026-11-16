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

/** Follows the hint every turn until the hand is decided. */
function playToTheEnd() {
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
    playToTheEnd()
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

  it("keeps the player's hand-ending play on the table beside the result button", () => {
    // With this deal the player goes out last of the three, on a bomb, and that play decides the hand.
    vi.spyOn(Math, "random").mockImplementation(seeded(4))
    render(<App />)
    playToTheEnd()
    const controls = within(screen.getByLabelText("你的操作"))
    expect(hand()).toHaveLength(0)
    expect(controls.getByLabelText("你出的牌：4张9炸弹")).toBeTruthy()
    expect(controls.getByRole("button", { name: "查看结果" })).toBeTruthy()

    fireEvent.click(controls.getByRole("button", { name: "查看结果" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "再看看牌桌" }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(controls.getByLabelText("你出的牌：4张9炸弹")).toBeTruthy()
  })

  it("keeps the match in browser storage under documented keys only", () => {
    render(<App />)
    waitForMyTurn()
    for (let i = 0; i < localStorage.length; i++) expect(localStorage.key(i)).toMatch(/^guandan\./)
  })
})

describe("the 3D table", () => {
  const board = () => document.querySelector('[data-slot="app"]')
  const backs = (seat: string) => screen.getByRole("region", { name: seat }).querySelectorAll('[data-slot="fan-card"]')

  it("starts on the flat table and switches from the top bar", () => {
    render(<App />)
    expect(board()?.getAttribute("data-view")).toBe("2d")
    expect(document.querySelector('[data-slot="scene"]')).toBeNull()

    fireEvent.click(screen.getByRole("radio", { name: "3D" }))
    expect(board()?.getAttribute("data-view")).toBe("3d")
    expect(localStorage.getItem("guandan.view")).toBe("3d")
    expect(hand()).toHaveLength(27)
    for (const seat of ["上家", "对家", "下家"]) expect(backs(seat)).toHaveLength(27)

    fireEvent.click(screen.getByRole("radio", { name: "2D" }))
    expect(board()?.getAttribute("data-view")).toBe("2d")
    expect(localStorage.getItem("guandan.view")).toBe("2d")
  })

  it("opens on the 3D table when that was the last choice", () => {
    localStorage.setItem("guandan.view", "3d")
    render(<App />)
    expect(board()?.getAttribute("data-view")).toBe("3d")
    expect(screen.getByRole("region", { name: "比分" }).textContent).toContain("本局打")
  })

  it("offers the same switch in settings", () => {
    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "3D" }))
    expect(board()?.getAttribute("data-view")).toBe("3d")
  })

  it("shows one card back for every card a seat still holds, and each play on the felt", () => {
    localStorage.setItem("guandan.view", "3d")
    render(<App />)
    fireEvent.click(waitForMyTurn())
    const picked = [...hand()].filter((card) => card.getAttribute("aria-pressed") === "true").length
    fireEvent.click(screen.getByRole("button", { name: "出牌" }))

    const mine = screen.getByRole("region", { name: "你出的牌" })
    expect(mine.querySelectorAll("[data-card]")).toHaveLength(picked)
    expect(within(mine).getByRole("list").getAttribute("aria-label")).toMatch(/^你出的牌：/)
    const counts = [...document.querySelectorAll('[data-layer="labels"] [data-slot="count"]')].map((el) => Number(/\d+/.exec(el.textContent ?? "")?.[0]))
    expect(counts).toEqual(["上家", "对家", "下家"].map((seat) => backs(seat).length))
  })

  it("draws the suit of every hand card beside or under its rank, in one corner index", () => {
    localStorage.setItem("guandan.view", "3d")
    render(<App />)
    const plain = [...hand()].filter((card) => !card.querySelector("[data-joker-name]"))
    expect(plain.length).toBeGreaterThan(20)
    for (const card of plain) {
      const index = [...card.querySelectorAll('[data-slot="face-index"] > *')].map((part) => part.getAttribute("data-slot"))
      expect(index).toEqual(["face-rank", "face-suit"])
    }
  })

  it("gives a bomb its moment: its name, who played it, and where it ranks among bombs", () => {
    // With this deal the player goes out on four 9s.
    vi.spyOn(Math, "random").mockImplementation(seeded(4))
    localStorage.setItem("guandan.view", "3d")
    render(<App />)
    expect(document.querySelector('[data-slot="bomb-moment"]')).toBeNull()
    playToTheEnd()

    const moment = document.querySelector('[data-slot="bomb-moment"]')
    expect(moment?.querySelector('[data-slot="bomb-banner"] b')?.textContent).toBe("炸弹")
    expect(moment?.querySelector('[data-slot="bomb-banner"] span')?.textContent).toMatch(/^你(领出4张9炸弹|出4张9炸弹，压过.+的.+)$/)
    expect(moment?.querySelector("[data-current]")?.textContent).toBe("四张你刚出的")
    const mine = screen.getByRole("region", { name: "你出的牌" })
    expect(mine.querySelector("[data-bomb]")).toBeTruthy()
    expect(mine.querySelectorAll('[data-slot="spark"]')).toHaveLength(16)
    expect(document.querySelectorAll('[data-slot="tabletop"] [data-slot="ring"][data-side="me"]')).toHaveLength(3)
  })

  it("does not replay the moment for a bomb that was already on the table", () => {
    vi.spyOn(Math, "random").mockImplementation(seeded(4))
    render(<App />)
    playToTheEnd()
    fireEvent.click(screen.getByRole("radio", { name: "3D" }))
    expect(screen.getByRole("region", { name: "你出的牌" }).querySelector("[data-bomb]")).toBeTruthy()
    expect(document.querySelector('[data-slot="bomb-moment"]')).toBeNull()
  })

  it("plays a whole hand and shows the result on request", () => {
    localStorage.setItem("guandan.view", "3d")
    render(<App />)
    playToTheEnd()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.querySelector('[data-slot="turn-note"]')?.textContent).toBe("本局结束")
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }))
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "下一局" })).toBeTruthy()
  })
})
