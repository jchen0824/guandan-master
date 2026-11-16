// Tools for checking the game in a real browser.
// Playwright injects this file before the app starts (see e2e/helpers.ts). An agent with a browser tool can
// evaluate the same file in the page by hand (see .agents/skills/browser-qa). One copy keeps the two in step.
// It only reads the page: nothing here changes the game except `seed`, which fixes the deal.
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

  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].filter(shown)
  const box = (el) => el.getBoundingClientRect()
  const size = (r) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`
  const overlap = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > SLACK && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > SLACK
  const button = (name) => all("button").find((b) => b.textContent.trim() === name) ?? null
  const name = (el) => el.getAttribute("aria-label") || el.textContent.trim().slice(0, 12) || el.dataset.slot || el.tagName

  /** Where the game is, read from the screen the way a player would. */
  function state() {
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
    const seats = all('[data-slot="player"], [data-slot="me-chip"]').map((el) => el.textContent + (el.dataset.active ?? "-"))
    const plays = all('[data-slot="play-zone"]').map((el) => el.textContent)
    return [...seats, ...plays, state().cards, document.querySelector('[data-slot="bubble"]')?.textContent].join("|")
  }

  /** Everything wrong with the layout right now, as sentences. An empty list means the screen holds together. */
  function layoutProblems() {
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
    for (const el of [...tools, ...menu]) mustBeOnScreen(el, `the ${name(el)} button`)
    for (const el of menu) mustBeReachable(el, `the ${name(el)} button`)
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
        '[data-layer="labels"] [data-slot="player"], [data-slot="play-tag"], [data-slot="pass-mark"], [data-slot="turn-note"], [data-slot="bubble"], [data-slot="score-panel"], [data-slot="bomb-banner"] > *, [data-slot="tracker"], [data-slot="brand"], [data-slot="menu"] > *, [data-slot="pills"] button',
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

  window.guandanQa = { seed, state, signature, layoutProblems, button }
})()
