// Tools for checking the game in a real browser.
// Playwright injects this file before the app starts (see e2e/helpers.ts). An agent with a browser tool can
// evaluate the same file in the page by hand (see .agents/skills/browser-qa). One copy keeps the two in step.
// It only reads the page: nothing here changes the game except `seed` and `dealHoldem`, which fix the deal.
;(() => {
  const SLACK = 1.5
  const MIN_TABLE_HEIGHT = 60

  /** Makes every deal repeatable. Call before the app starts, or just before 重新开始整场比赛. */
  function seed(value) {
    let current = value
    Math.random = () => {
      current = (current * 1664525 + 1013904223) % 4294967296
      return current / 4294967296
    }
  }

  /**
   * Texas Hold'em: makes the next new table (设置 → 重新开始) deal exactly these cards, as `rig()` does in a unit
   * test. `holes` maps a seat (0 is the player) to two cards such as "AH TD"; `board` is the five board cards in
   * the order they come. Seats not named get cards nobody asked for. Every random number after the deal comes
   * from `seed`, so the hand plays out the same way each time. Call it right before confirming 重新开始.
   * `seats` is the size of the table on screen unless given, since 重新开始 deals a new table of the same size.
   */
  function dealHoldem({ button = 0, seats = Number(holdem()?.dataset.seats ?? 6), holes, board, seed: after = 5 }) {
    const id = (name) => "SHCD".indexOf(name[1]) * 13 + ("23456789TJQKA".indexOf(name[0]))
    const want = Array.from({ length: 2 * seats + 5 }, () => null)
    for (const [seat, names] of Object.entries(holes)) {
      // Hole cards go round twice, clockwise from the small blind, then the board comes off the top.
      const from = (Number(seat) - button - 1 + 2 * seats) % seats
      names.split(" ").forEach((name, round) => (want[round * seats + from] = id(name)))
    }
    board.split(" ").forEach((name, i) => (want[2 * seats + i] = id(name)))
    const named = new Set(want.filter((card) => card !== null))
    // Run the game's shuffle backwards: at each step pick the swap that leaves the wanted card in place.
    const deck = Array.from({ length: 52 }, (_, card) => card)
    const draws = [(button + 0.5) / seats]
    for (let i = 51; i > 0; i--) {
      const j = i < want.length && want[i] !== null ? deck.indexOf(want[i]) : deck.findIndex((card, at) => at <= i && !named.has(card))
      draws.push((j + 0.5) / (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    let current = after
    Math.random = () => {
      if (draws.length > 0) return draws.shift()
      current = (current * 1664525 + 1013904223) % 4294967296
      return current / 4294967296
    }
  }

  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].filter(shown)
  const box = (el) => el.getBoundingClientRect()
  const size = (r) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`
  const overlap = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > SLACK && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SLACK
  const button = (name) => all("button").find((b) => b.textContent.trim() === name) ?? null
  const name = (el) => el.getAttribute("aria-label") || el.textContent.trim().slice(0, 12) || el.dataset.slot || el.tagName

  const holdem = () => document.querySelector('[data-slot="holdem"]')

  /** Where the game is, read from the screen the way a player would. */
  function state() {
    if (holdem()) {
      return {
        // At the end of a table there is 再开一桌 instead of 下一手.
        over: button("下一手") !== null || button("再开一桌") !== null,
        myTurn: button("弃牌") !== null,
        mustReturn: false,
        cards: all('[data-slot="he-hole"] [data-slot="playing-card"]').length,
        selected: 0,
        dialog: all('[data-slot="dialog-content"]').length > 0,
      }
    }
    return {
      over: button("查看结果") !== null,
      myTurn: button("提示") !== null,
      mustReturn: button("还贡") !== null,
      cards: all('[data-slot="hand"] [data-card-id]').length,
      selected: all('[data-slot="hand"] [data-card-id][aria-pressed="true"]').length,
      dialog: all('[data-slot="dialog-content"]').length > 0,
    }
  }

  /** Changes whenever any seat plays, passes or finishes. Used to wait for a move to land. */
  function signature() {
    if (holdem()) return all('[data-slot="he-table"], [data-slot="he-controls"], [data-slot="he-streets"] [aria-current]').map((el) => el.textContent).join("|")
    const seats = all('[data-slot="player"], [data-slot="me-chip"]').map((el) => el.textContent + (el.dataset.active ?? "-"))
    const plays = all('[data-slot="play-zone"]').map((el) => el.textContent)
    return [...seats, ...plays, state().cards, document.querySelector('[data-slot="bubble"]')?.textContent].join("|")
  }

  /**
   * The Texas Hold'em table. Seats, bets, the board and the panels are all placed by hand over the table, so
   * nothing in the layout stops one landing on another: every pair is checked.
   */
  function holdemProblems(mustBeOnScreen, mustBeReachable) {
    const problems = []
    const labels = all(
      '[data-slot="he-top"] > *, [data-slot="he-chip"], [data-slot="he-bet"], [data-slot="he-pot"], [data-slot="he-board"], [data-slot="he-banner"] > *, [data-slot="he-coach"], [data-slot="he-ranks"], [data-slot="he-me"], [data-slot="he-hole"], [data-slot="he-notice"], [data-slot="he-sizes"] > *, [data-slot="he-slider"], [data-slot="he-buttons"] > *',
    )
    const cross = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3
    // On a phone held sideways the player's label is the last line of the coach's box, by design, so it is checked
    // against each line in the box instead of the box.
    const sideways = window.innerHeight <= 480
    const together = (a, b) => sideways && [a.dataset.slot, b.dataset.slot].sort().join() === "he-coach,he-me"
    for (const el of labels) mustBeOnScreen(el, `the label ${name(el)}`)
    labels.forEach((a, i) => {
      for (const b of labels.slice(i + 1)) {
        if (!a.contains(b) && !b.contains(a) && !together(a, b) && cross(box(a), box(b))) problems.push(`the label ${name(a)} overlaps ${name(b)}`)
      }
    })
    for (const me of sideways ? all('[data-slot="he-me"]') : []) {
      for (const line of all('[data-slot="he-coach"] > *')) if (cross(box(me), box(line))) problems.push(`the label ${name(me)} overlaps the coach's line ${name(line)}`)
    }
    for (const el of all('[data-slot="he-who"], [data-slot="he-note"], [data-slot="he-in"], [data-slot="he-streets"] li, [data-slot="he-buttons"] > *, [data-slot="he-sizes"] > *')) {
      if (el.scrollWidth > el.clientWidth + 1) problems.push(`the text of ${name(el)} is cut off`)
    }
    // A size button's words may wrap instead of being cut off, and 三分之 over 二 does not read as one name.
    for (const el of all('[data-slot="he-sizes"] > * > *')) {
      const range = document.createRange()
      range.selectNodeContents(el)
      if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) problems.push(`the words ${el.textContent} on a size button wrap onto two lines`)
    }
    // The dealer badge sits on a corner of its seat's label, so it is inside the label and the pair check skips it.
    for (const badge of all('[data-slot="he-dealer"]')) {
      const who = badge.parentElement.querySelector('[data-slot="he-who"]')
      if (who && overlap(box(badge), box(who))) problems.push(`the dealer badge covers the name on ${name(badge.parentElement)}`)
    }
    for (const el of all('[data-slot="holdem"] button')) mustBeReachable(el, `the ${name(el)} button`)
    const table = all('[data-slot="he-stage"]')[0]
    if (table && box(table).height < 180) problems.push(`the table is squeezed to ${Math.round(box(table).height)}px high`)
    return problems
  }

  /** The home page. It may scroll up and down, so each game's button is only checked for what could cover it. */
  function homeProblems() {
    const problems = []
    const width = window.innerWidth
    if (document.documentElement.scrollWidth > width + SLACK) problems.push("the page scrolls sideways")
    for (const tile of all('[data-slot="game-tile"]')) {
      const game = name(tile.querySelector("h2"))
      const picture = tile.querySelector('[data-slot="tile-scene"]')
      for (const el of all('h2, p, li, button, [data-slot="tile-badge"]', tile)) {
        const r = box(el)
        if (r.left < -SLACK || r.right > width + SLACK) problems.push(`${name(el)} of ${game} runs past the side of the screen (${size(r)})`)
        if (el.dataset.slot !== "tile-badge" && overlap(r, box(picture))) problems.push(`the picture of ${game} covers ${name(el)}`)
        if (el.scrollWidth > el.clientWidth + 1) problems.push(`the text of ${name(el)} of ${game} is cut off`)
      }
      const enter = tile.querySelector("button")
      if (box(enter).height < 44) problems.push(`the button of ${game} is only ${Math.round(box(enter).height)}px high`)
    }
    return problems
  }

  /** Everything wrong with the layout right now, as sentences. An empty list means the screen holds together. */
  function layoutProblems() {
    if (document.querySelector('[data-slot="home"]')) return homeProblems()
    const problems = []
    const width = window.innerWidth
    const height = window.innerHeight
    const offScreen = (r) => r.left < -SLACK || r.right > width + SLACK || r.top < -SLACK || r.bottom > height + SLACK
    const mustBeOnScreen = (el, what) => {
      if (offScreen(box(el))) problems.push(`${what} is partly off screen (${size(box(el))} in ${width}×${height})`)
    }
    const mustBeReachable = (el, what) => {
      const r = box(el)
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (top && top !== el && !el.contains(top) && !top.contains(el)) problems.push(`${what} is covered by ${name(top)}`)
    }

    if (document.documentElement.scrollWidth > width + SLACK) problems.push("the page scrolls sideways")
    if (document.documentElement.scrollHeight > height + SLACK) problems.push("the page scrolls up and down")

    const dialog = all('[data-slot="dialog-content"]')[0]
    if (dialog) {
      mustBeOnScreen(dialog, "the dialog")
      for (const el of all("button, a", dialog)) {
        const r = box(el)
        if (r.left < box(dialog).left - SLACK || r.right > box(dialog).right + SLACK) problems.push(`${name(el)} sticks out of the dialog`)
      }
      return problems
    }

    if (holdem()) return [...new Set([...problems, ...holdemProblems(mustBeOnScreen, mustBeReachable)])]

    const drawer = all('[data-slot="coach"]')[0]
    if (drawer && width <= 1000) {
      mustBeOnScreen(drawer, "the coach panel")
      for (const el of all("button", drawer)) mustBeReachable(el, `the coach button ${name(el)}`)
      return problems
    }

    const actions = all('[data-slot="pills"] button')
    const cards = all('[data-slot="hand"] [data-card-id]')
    const tools = all('[data-slot="tools"] button')
    const menu = all('[data-slot="menu"] button')

    for (const el of actions) {
      mustBeOnScreen(el, `the ${name(el)} button`)
      mustBeReachable(el, `the ${name(el)} button`)
    }
    const back = all('[data-slot="top-left"] > button')
    for (const el of [...tools, ...menu, ...back]) mustBeOnScreen(el, `the ${name(el)} button`)
    for (const el of [...menu, ...back]) mustBeReachable(el, `the ${name(el)} button`)
    for (const el of cards) mustBeOnScreen(el, `the card ${name(el)}`)
    for (const el of all('[data-slot="scores"], [data-slot="player"], [data-slot="tracker"], [data-slot="bubble"]')) {
      const r = box(el)
      if (r.left < -SLACK || r.right > width + SLACK) problems.push(`${name(el)} runs past the side of the screen (${size(r)})`)
    }
    for (const el of all('[data-slot="play-zone"] [data-card]')) {
      const r = box(el)
      if (r.left < -SLACK || r.right > width + SLACK) problems.push(`a played card runs past the side of the screen (${size(r)})`)
    }

    for (const action of actions) {
      const hit = cards.find((card) => overlap(box(action), box(card)))
      if (hit) problems.push(`the ${name(action)} button overlaps the card ${name(hit)}`)
    }
    const scores = all('[data-slot="scores"]')[0]
    for (const el of menu) {
      if (scores && overlap(box(el), box(scores))) problems.push(`the ${name(el)} button overlaps the scores`)
    }
    for (const tool of tools) {
      const hit = cards.find((card) => overlap(box(tool), box(card)))
      if (hit) problems.push(`the ${name(tool)} tool overlaps the card ${name(hit)}`)
    }

    // On the 3D table every label floats over the scene, so only this check keeps one from landing on another.
    if (document.querySelector('[data-view="3d"]')) {
      const faint = (el) => {
        for (let node = el; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 0.3) return true
        return false
      }
      const labels = all(
        '[data-layer="labels"] [data-slot="player"], [data-slot="play-tag"], [data-slot="pass-mark"], [data-slot="turn-note"], [data-slot="bubble"], [data-slot="score-panel"], [data-slot="bomb-banner"] > *, [data-slot="tracker"], [data-slot="brand"], [data-slot="top-left"] > button, [data-slot="menu"] > *, [data-slot="pills"] button',
      ).filter((el) => !faint(el))
      const cross = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3
      labels.forEach((a, i) => {
        for (const b of labels.slice(i + 1)) {
          if (!a.contains(b) && !b.contains(a) && cross(box(a), box(b))) problems.push(`the label ${name(a)} overlaps ${name(b)}`)
        }
      })
    }

    const table = all('[data-slot="table"]')[0]
    if (table && box(table).height < MIN_TABLE_HEIGHT) {
      problems.push(`the table is squeezed to ${Math.round(box(table).height)}px high`)
    }
    return [...new Set(problems)]
  }

  window.guandanQa = { seed, dealHoldem, state, signature, layoutProblems, button }
})()
