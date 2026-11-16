import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/barlow-condensed/latin-600.css"
import "@fontsource/barlow-condensed/latin-700.css"
import "./index.css"
import "./holdem.css"
import { Root } from "./Root"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root element")

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
