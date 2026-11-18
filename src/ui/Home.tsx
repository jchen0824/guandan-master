import { useState } from "react"
import { Button } from "@ui-sdk/react/button"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { chips, newDeck } from "../holdem/cards"
import { HERO, TABLE_SIZES } from "../holdem/game"
import type { TableSave, TableSize } from "../holdem/game"
import { REPO_URL } from "./buildInfo"
import { savedSize, savedTable, startOver, writeSize } from "./holdem/storage"
import { PlayingCard } from "./holdem/PlayingCard"

// The GitHub mark, from GitHub's Octicons (MIT licence).
const GITHUB_MARK =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"

export type GameChoice = "guandan" | "holdem"

const DECK = newDeck()
const find = (rank: number, suit: string) => DECK.find((card) => card.rank === rank && card.suit === suit) ?? DECK[0]
const EIGHTS = ["S", "H", "C", "D"].map((suit) => find(8, suit))
const FLOP = [find(13, "S"), find(9, "H"), find(4, "H")]

/** Where the player left the Texas Hold'em table, in words for its tile, or null when nothing was saved. */
function holdemProgress(save: TableSave | null): string | null {
  if (!save) return null
  const left = save.stacks.filter((stack) => stack > 0).length
  return `上次打到第 ${save.handNumber} 手，你有 ${chips(save.stacks[HERO])} 筹码${left < save.stacks.length ? `，桌上还剩 ${left} 人` : ""}，进去接着打`
}

function hasUnfinishedMatch(): boolean {
  try {
    return localStorage.getItem("guandan.match") !== null
  } catch {
    return false
  }
}

/** The Texas Hold'em tile. Picking a size here is the same choice as 牌桌人数 in 设置, made before sitting down. */
function HoldemTile({ onPick }: { onPick: (game: GameChoice) => void }) {
  const [save] = useState(savedTable)
  const [size, setSize] = useState<TableSize>(() => TABLE_SIZES.find((option) => option === save?.stacks.length) ?? savedSize())
  // A saved table keeps its own size until the player presses the button: only then is it given up.
  const switching = save !== null && size !== save.stacks.length
  const choose = (picked: string | null) => {
    const chosen = TABLE_SIZES.find((option) => String(option) === picked)
    if (!chosen) return
    setSize(chosen)
    if (!save) writeSize(chosen)
  }
  const enter = () => {
    if (switching) startOver(size)
    onPick("holdem")
  }
  const note = switching
    ? `上次的 ${save.stacks.length} 人桌打到第 ${save.handNumber} 手。换成 ${size} 人桌会从第 1 手重新开始，上次的进度不保留`
    : (holdemProgress(save) ?? `和 ${size - 1} 个电脑对手打，从 2,000 筹码开始`)
  return (
    <section data-slot="game-tile" data-game="holdem" data-new="" aria-labelledby="home-holdem">
      <div data-slot="tile-scene" aria-hidden="true">
        <span data-slot="tile-table" />
        <span data-slot="tile-cards">
          {FLOP.map((card) => (
            <PlayingCard key={card.id} card={card} />
          ))}
          <span data-slot="card-gap" />
          <span data-slot="card-gap" />
        </span>
      </div>
      <span data-slot="tile-badge">新增</span>
      <div data-slot="tile-body">
        <h2 id="home-holdem">德州扑克</h2>
        <p data-slot="tile-facts">一副牌 · 无限注</p>
        <SegmentedControl aria-label="牌桌人数" value={String(size)} onValueChange={choose}>
          {TABLE_SIZES.map((option) => (
            <SegmentedControlItem key={option} value={String(option)}>
              {option} 人
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <ul data-slot="tile-skills">
          <li>起手牌</li>
          <li>位置</li>
          <li>底池赔率</li>
          <li>下注尺度</li>
        </ul>
        <Button data-variant="enter" aria-label={switching ? undefined : "进入德州扑克牌桌"} onClick={enter}>
          {switching ? `开一张 ${size} 人桌` : "进入牌桌"}
        </Button>
        <p data-slot="tile-note" data-progress={save ? "" : undefined}>
          {note}
        </p>
      </div>
    </section>
  )
}

/** The first screen: pick 掼蛋 or 德州扑克. */
function Home({ onPick }: { onPick: (game: GameChoice) => void }) {
  return (
    <main data-slot="home">
      <header data-slot="home-top">
        <span>牌桌教练</span>
        <a data-slot="home-source" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub 源代码">
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d={GITHUB_MARK} />
          </svg>
        </a>
      </header>
      <div data-slot="home-intro">
        <h1>今天练哪一桌？</h1>
      </div>
      <div data-slot="home-games">
        <section data-slot="game-tile" data-game="guandan" aria-labelledby="home-guandan">
          <div data-slot="tile-scene" aria-hidden="true">
            <span data-slot="tile-table" />
            <span data-slot="tile-cards">
              {EIGHTS.map((card) => (
                <PlayingCard key={card.id} card={card} />
              ))}
            </span>
          </div>
          <div data-slot="tile-body">
            <h2 id="home-guandan">掼蛋</h2>
            <p data-slot="tile-facts">4 人 · 两副牌 · 升级打到 A</p>
            <ul data-slot="tile-skills">
              <li>记牌</li>
              <li>组牌</li>
              <li>炸弹时机</li>
              <li>和对家配合</li>
            </ul>
            <Button data-variant="enter" aria-label="进入掼蛋牌桌" onClick={() => onPick("guandan")}>
              进入牌桌
            </Button>
            <p data-slot="tile-note" data-progress={hasUnfinishedMatch() ? "" : undefined}>
              {hasUnfinishedMatch() ? "有一场没打完的比赛，进去可以接着打" : "和三个电脑玩家打，从打 2 开始"}
            </p>
          </div>
        </section>
        <HoldemTile onPick={onPick} />
      </div>
      <p data-slot="home-note">*纯人机练习</p>
    </main>
  )
}

export { Home }
