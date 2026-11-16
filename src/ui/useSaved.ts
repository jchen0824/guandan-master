import { useState } from "react"

/** A yes/no setting kept in browser storage under `key`. The key must be listed in AGENTS.md. */
export function useSaved(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? fallback : saved === "1"
    } catch {
      return fallback
    }
  })
  const save = (next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(key, next ? "1" : "0")
    } catch {
      return
    }
  }
  return [value, save]
}
