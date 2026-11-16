import { Button } from "@ui-sdk/react/button"
import { newDeck } from "../holdem/cards"
import { PlayingCard } from "./holdem/PlayingCard"

export type GameChoice = "guandan" | "holdem"

const DECK = newDeck()
const find = (rank: number, suit: string) => DECK.find((card) => card.rank === rank && card.suit === suit) ?? DECK[0]
const EIGHTS = ["S", "H", "C", "D"].map((suit) => find(8, suit))
const FLOP = [find(13, "S"), find(9, "H"), find(4, "H")]

function hasUnfinishedMatch(): boolean {
  try {
    return localStorage.getItem("guandan.match") !== null
  } catch {
    return false
  }
}

/** The first screen: pick 掼蛋 or 德州扑克. */
function Home({ onPick }: { onPick: (game: GameChoice) => void }) {
  return (
    <main data-slot="home">
      <header data-slot="home-top">牌桌教练</header>
      <div data-slot="home-intro">
        <h1>今天练哪一桌？</h1>
        <p>两种牌局，同一位教练。每一手都告诉你为什么这样打。</p>
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
            <p data-slot="tile-note">{hasUnfinishedMatch() ? "有一场没打完的比赛，进去可以接着打" : "和三个电脑玩家打，从打 2 开始"}</p>
          </div>
        </section>
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
            <p data-slot="tile-facts">6 人 · 一副牌 · 无限注</p>
            <ul data-slot="tile-skills">
              <li>起手牌</li>
              <li>位置</li>
              <li>底池赔率</li>
              <li>下注尺度</li>
            </ul>
            <Button data-variant="enter" aria-label="进入德州扑克牌桌" onClick={() => onPick("holdem")}>
              进入牌桌
            </Button>
            <p data-slot="tile-note">和 5 个电脑对手打，从 2,000 筹码开始</p>
          </div>
        </section>
      </div>
      <p data-slot="home-note">只用练习筹码，不涉及真钱。没有倒计时，想多久都可以。</p>
    </main>
  )
}

export { Home }
