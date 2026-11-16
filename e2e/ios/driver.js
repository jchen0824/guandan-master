// Runs inside Mobile Safari in the iOS Simulator. serve.mjs puts it, with page-tools.js, into the page
// ahead of the app. No test tool can drive that browser from outside, so the page drives itself to a state
// worth photographing, stops the game there, and posts where everything is. The workflow then takes a
// picture of the simulator's screen and check-shot.mjs compares the two. See .github/workflows/ios-simulator.yml.
//
// `?game=guandan` (the default) deals a fixed 掼蛋 hand on the 3D table and follows the coach's hints until
// several multi-card plays lie on it. `?game=holdem` calls every bet on the Texas Hold'em table until a hand
// ends in a showdown, so the board is full and the losing hands are turned over on their seats' labels.
;(() => {
  const GAME = new URLSearchParams(location.search).get("game") === "holdem" ? "holdem" : "guandan"
  const SEED = 4
  const LIMIT_MS = 150_000
  const MARK = 14
  // Hold'em needs several hands to reach a showdown, so its computer players move four times as fast.
  const SPEED = GAME === "holdem" ? 4 : 1

  // Before the app starts: skip the home page and open the game, 掼蛋 on the 3D table.
  localStorage.setItem("guandan.game", GAME)
  localStorage.setItem("guandan.view", "3d")
  // Hold'em deals as soon as it starts, so a repeatable deal is seeded now (page-tools.js says why not exact).
  if (GAME === "holdem") window.guandanQa.seed(SEED)

  // The game runs on timers. Once the table is in the state to photograph, they are dropped so that no bot
  // plays between this report and the screenshot. The driver keeps the real one for itself.
  const realTimeout = window.setTimeout.bind(window)
  let frozen = false
  window.setTimeout = (callback, ms, ...rest) => realTimeout(() => (frozen ? undefined : callback(...rest)), (ms ?? 0) / SPEED)

  const wait = (ms) => new Promise((done) => realTimeout(done, ms))
  const all = (selector, root = document) => [...root.querySelectorAll(selector)]
  const button = (name) => all("button").find((b) => b.textContent.trim() === name)
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10)
  }

  function mark(corner) {
    const el = document.createElement("div")
    el.style.cssText = `position:fixed;${corner};width:${MARK}px;height:${MARK}px;background:#ff00ff;z-index:2147483647;pointer-events:none`
    document.body.append(el)
  }

  /** Stops the game, draws the two marks the checker finds the page by, and waits for them to be painted. */
  async function freeze() {
    frozen = true
    await wait(1500)
    // Two marks at opposite corners of the page let the checker find the page inside the screenshot.
    mark("left:0;top:0")
    mark("right:0;bottom:0")
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  }

  const page = () => ({
    game: GAME,
    seed: SEED,
    mark: MARK,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight, ratio: window.devicePixelRatio },
  })

  const plays = () =>
    all('[data-slot="seat3d"] [data-slot="card-row"]').map((row) => ({
      side: row.closest("[data-side]").dataset.side,
      label: row.getAttribute("aria-label"),
      cards: all("[data-card]", row).map((card) => ({
        name: card.querySelector('[data-slot="visually-hidden"]')?.textContent ?? "",
        rank: box(card.querySelector('[data-slot="face-rank"]')),
      })),
    }))

  async function guandan(left) {
    while (!document.querySelector('[data-slot="fan-card"]') && left() > 0) await wait(100)

    // An exact deal: seed right before the match restarts (page-tools.js says why).
    button("设置").click()
    await wait(400)
    button("重新开始整场比赛").click()
    await wait(400)
    window.guandanQa.seed(SEED)
    all("button")
      .find((b) => b.textContent.trim().startsWith("确认"))
      .click()
    await wait(800)

    let reached = false
    let moves = 0
    while (left() > 0) {
      await wait(450)
      const big = plays().filter((play) => play.cards.length >= 5)
      if (big.length >= 2 && big.some((play) => play.side === "top")) {
        reached = true
        break
      }
      const now = window.guandanQa.state()
      if (now.over) break
      if (now.myTurn && !now.dialog) {
        button("提示").click()
        await wait(150)
        button(window.guandanQa.state().selected > 0 ? "出牌" : "不出").click()
        moves++
      }
    }
    await freeze()

    return {
      ...page(),
      reached,
      moves,
      view: document.querySelector('[data-slot="app"]')?.dataset.view ?? null,
      plays: plays(),
      felt: box(document.querySelector('[data-slot="felt"]')),
      fanCard: box(all('[data-slot="seat3d"][data-side="left"] [data-slot="fan-card"]')[13]),
      labels: all('[data-layer="labels"] [data-slot="player"]').map((el) => ({ name: el.textContent.trim().slice(0, 12), box: box(el) })),
      layoutProblems: window.guandanQa.layoutProblems(),
    }
  }

  const cardsIn = (selector) =>
    all(`${selector} [data-slot="playing-card"]`).map((card) => ({
      name: card.querySelector('[data-slot="visually-hidden"]')?.textContent ?? "",
      rank: box(card.querySelector('[data-slot="pc-rank"]')),
    }))

  /** Small squares on the felt where nothing else is drawn, found by asking the page what is on top there. */
  function feltSpots() {
    const felt = document.querySelector('[data-slot="he-felt"]')
    if (!felt) return []
    const r = felt.getBoundingClientRect()
    const spots = []
    for (let fy = 0.2; fy <= 0.8; fy += 0.1) {
      for (let fx = 0.2; fx <= 0.8; fx += 0.1) {
        const x = r.left + r.width * fx
        const y = r.top + r.height * fy
        if (document.elementFromPoint(x, y) === felt) spots.push([x - 3, y - 3, 6, 6].map((v) => Math.round(v * 10) / 10))
      }
    }
    return spots
  }

  async function holdem(left) {
    while (!document.querySelector('[data-slot="he-hole"]') && left() > 0) await wait(100)
    let reached = false
    let hands = 1
    let decisions = 0
    while (left() > 0) {
      await wait(150)
      const next = button("下一手")
      if (next) {
        if (document.querySelector('[data-slot="he-shown"]')) {
          reached = true
          break
        }
        next.click()
        hands++
        continue
      }
      // Calling or checking every time keeps the player in until the river.
      const stay = all('[data-slot="he-buttons"] button').find((b) => /^(过牌|跟注)/.test(b.textContent.trim()))
      if (stay) {
        stay.click()
        decisions++
      }
    }
    await freeze()

    return {
      ...page(),
      reached,
      hands,
      decisions,
      felt: feltSpots(),
      board: cardsIn('[data-slot="he-board"]'),
      shown: all('[data-slot="he-seat"]')
        .filter((seat) => seat.querySelector('[data-slot="he-shown"]'))
        .map((seat) => ({ seat: seat.getAttribute("aria-label"), cards: cardsIn(`[data-seat="${seat.dataset.seat}"] [data-slot="he-shown"]`) })),
      hole: cardsIn('[data-slot="he-hole"]'),
      labels: all('[data-slot="he-seat"]').map((seat) => ({ name: seat.getAttribute("aria-label"), box: box(seat.querySelector('[data-slot="he-note"]')) })),
      layoutProblems: window.guandanQa.layoutProblems(),
    }
  }

  async function run() {
    const started = Date.now()
    const left = () => LIMIT_MS - (Date.now() - started)
    return GAME === "holdem" ? holdem(left) : guandan(left)
  }

  const send = (report) => fetch(`/qa-report?game=${GAME}`, { method: "POST", body: JSON.stringify(report) })
  window.addEventListener("DOMContentLoaded", () => {
    run().then(send, (error) => send({ ...page(), error: String(error?.stack ?? error) }))
  })
})()
