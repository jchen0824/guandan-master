import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/barlow-condensed/latin-600.css"
import "@fontsource/barlow-condensed/latin-700.css"
import "./index.css"
import { App } from "./App"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root element")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
