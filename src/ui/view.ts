import { useState } from "react"

export type View = "2d" | "3d"

const VIEW_KEY = "guandan.view"

/** Which table the player chose. A new player gets the 3D table; the flat one is a click away. */
export function useView(): [View, (next: View) => void] {
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "2d" ? "2d" : "3d"
    } catch {
      return "3d"
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
