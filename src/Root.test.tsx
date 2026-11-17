// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Root } from "./Root"

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, "random").mockImplementation(seeded(5))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("the home page", () => {
  it("offers both games by name and deals nothing yet", () => {
    render(<Root />)
    expect(screen.getByRole("heading", { name: "掼蛋" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "德州扑克" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "进入掼蛋牌桌" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "进入德州扑克牌桌" })).toBeTruthy()
    expect(screen.queryByLabelText("你的操作")).toBeNull()
  })

  it("opens the 掼蛋 table and comes back from the button at the left of its top bar", () => {
    render(<Root />)
    fireEvent.click(screen.getByRole("button", { name: "进入掼蛋牌桌" }))
    expect(screen.getByLabelText("你的操作").querySelectorAll("[data-card-id]")).toHaveLength(27)
    fireEvent.click(screen.getByRole("button", { name: "回到首页" }))
    expect(screen.getByRole("heading", { name: "今天练哪一桌？" })).toBeTruthy()
  })

  it("has the same way home in the 掼蛋 settings, for screens with no room in the top bar", () => {
    render(<Root />)
    fireEvent.click(screen.getByRole("button", { name: "进入掼蛋牌桌" }))
    fireEvent.click(screen.getByRole("button", { name: "设置" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "回到首页" }))
    expect(screen.getByRole("heading", { name: "今天练哪一桌？" })).toBeTruthy()
    expect(localStorage.getItem("guandan.game")).toBeNull()
  })

  it("opens the Texas Hold'em table and comes back from its top bar", () => {
    render(<Root />)
    fireEvent.click(screen.getByRole("button", { name: "进入德州扑克牌桌" }))
    expect(screen.getByLabelText(/^你的手牌/).querySelectorAll('[data-slot="playing-card"]')).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: /牌桌教练/ }))
    expect(screen.getByRole("heading", { name: "今天练哪一桌？" })).toBeTruthy()
  })

  it("remembers the game under a documented key and forgets it on the way home", () => {
    const first = render(<Root />)
    fireEvent.click(screen.getByRole("button", { name: "进入德州扑克牌桌" }))
    expect(localStorage.getItem("guandan.game")).toBe("holdem")
    first.unmount()

    render(<Root />)
    expect(screen.getByLabelText(/^你的手牌/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /牌桌教练/ }))
    expect(localStorage.getItem("guandan.game")).toBeNull()
  })

  it("links to the source code on GitHub, in a new tab", () => {
    render(<Root />)
    const link = screen.getByRole("link", { name: "GitHub 源代码" })
    expect(link.getAttribute("href")).toBe("https://github.com/jchen0824/guandan-master")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer")
    expect(link.querySelector("svg")).toBeTruthy()
  })

  it("says where the player left the Texas Hold'em table", () => {
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 7, button: 2, stacks: [2350, 1800, 2000, 1500, 2350, 2000] }))
    render(<Root />)
    expect(screen.getByText("上次打到第 7 手，你有 2,350 筹码，进去接着打")).toBeTruthy()
  })

  it("says how many are left at a Texas Hold'em table, and nothing about one that has ended", () => {
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 40, button: 2, stacks: [5000, 0, 4000, 0, 3000, 0] }))
    const first = render(<Root />)
    expect(screen.getByText("上次打到第 40 手，你有 5,000 筹码，桌上还剩 3 人，进去接着打")).toBeTruthy()
    first.unmount()
    localStorage.setItem("guandan.holdem.table", JSON.stringify({ version: 1, savedAt: "", handNumber: 41, button: 2, stacks: [0, 0, 9000, 0, 3000, 0] }))
    render(<Root />)
    expect(screen.queryByText(/上次打到/)).toBeNull()
  })

  it("says so when a 掼蛋 match is waiting to be continued", () => {
    localStorage.setItem("guandan.match", "{}")
    render(<Root />)
    expect(screen.getByText(/没打完/)).toBeTruthy()
  })
})
