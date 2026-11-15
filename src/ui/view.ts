import { useState } from "react"

export type View = "2d" | "3d"

const VIEW_KEY = "guandan.view"

/** Which table the player chose. The flat table stays the default until they pick the 3D one. */
export function useView(): [View, (next: View) => void] {
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "3d" ? "3d" : "2d"
    } catch {
      return "2d"
    }
  })
  const save = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      return
    }
  }
  return [view, save]
}
