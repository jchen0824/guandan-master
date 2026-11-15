import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

/** Node 25 ships its own `localStorage`, which hides jsdom's, so UI tests get one that works everywhere. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  }
}

// Engine tests run in Node with no DOM; everything below is for tests that opt in to jsdom.
if (typeof document !== "undefined") {
  globalThis.__UI_SDK_STRICT__ = true

  // jsdom lacks these, and ui-sdk popups and dialogs call them when they open.
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  document.head.append(
    Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }),
  )

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage())
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
}
