// Runs inside Mobile Safari in the iOS Simulator. serve.mjs puts it, with page-tools.js, into the page
// ahead of the app. No test tool can drive that browser from outside, so the page drives itself: it deals
// a fixed hand, follows the coach's hints until several multi-card plays lie on the 3D table, stops the
// game there, and posts where everything is. The workflow then takes a picture of the simulator's screen
// and check-shot.mjs compares the two. See .github/workflows/ios-simulator.yml.
;(() => {
  const SEED = 4
  const LIMIT_MS = 150_000
  const MARK = 14

  // The game runs on timers. Once the table is in the state to photograph, they are dropped so that no bot
  // plays between this report and the screenshot. The driver keeps the real one for itself.
  const realTimeout = window.setTimeout.bind(window)
  let frozen = false
  window.setTimeout = (callback, ms, ...rest) => realTimeout(() => (frozen ? undefined : callback(...rest)), ms)

  const wait = (ms) => new Promise((done) => realTimeout(done, ms))
  const all = (selector, root = document) => [...root.querySelectorAll(selector)]
  const button = (name) => all("button").find((b) => b.textContent.trim() === name)
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10)
  }
  const plays = () =>
    all('[data-slot="seat3d"] [data-slot="card-row"]').map((row) => ({
      side: row.closest("[data-side]").dataset.side,
      label: row.getAttribute("aria-label"),
      cards: all("[data-card]", row).map((card) => ({
        name: card.querySelector('[data-slot="visually-hidden"]')?.textContent ?? "",
        rank: box(card.querySelector('[data-slot="face-rank"]')),
      })),
    }))

  function mark(corner) {
    const el = document.createElement("div")
    el.style.cssText = `position:fixed;${corner};width:${MARK}px;height:${MARK}px;background:#ff00ff;z-index:2147483647;pointer-events:none`
    document.body.append(el)
  }

  async function run() {
    const started = Date.now()
    const left = () => LIMIT_MS - (Date.now() - started)
    localStorage.setItem("guandan.view", "3d")
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
    frozen = true
    await wait(1500)

    // Two marks at opposite corners of the page let the checker find the page inside the screenshot.
    mark("left:0;top:0")
    mark("right:0;bottom:0")
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))

    return {
      reached,
      moves,
      seed: SEED,
      mark: MARK,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight, ratio: window.devicePixelRatio },
      view: document.querySelector('[data-slot="app"]')?.dataset.view ?? null,
      plays: plays(),
      felt: box(document.querySelector('[data-slot="felt"]')),
      fanCard: box(all('[data-slot="seat3d"][data-side="left"] [data-slot="fan-card"]')[13]),
      labels: all('[data-layer="labels"] [data-slot="player"]').map((el) => ({ name: el.textContent.trim().slice(0, 12), box: box(el) })),
      layoutProblems: window.guandanQa.layoutProblems(),
    }
  }

  const send = (report) => fetch("/qa-report", { method: "POST", body: JSON.stringify(report) })
  window.addEventListener("DOMContentLoaded", () => {
    run().then(send, (error) => send({ error: String(error?.stack ?? error) }))
  })
})()
