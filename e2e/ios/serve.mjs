// Serves the production build to Mobile Safari in the iOS Simulator, with page-tools.js and driver.js put
// into the page ahead of the app, and saves the report the page posts back as <prefix>-<game>.json.
// Usage: node e2e/ios/serve.mjs [prefix]   (after `npm run build`; the prefix defaults to ios-report)
import { createServer } from "node:http"
import { readFile, writeFile } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"

const PORT = Number(process.env.PORT ?? 4174)
const dist = resolve("dist")
const prefix = process.argv[2] ?? "ios-report"
const GAMES = ["guandan", "holdem"]
const here = (name) => readFile(new URL(name, import.meta.url), "utf8")
const inject = `<script>${await here("../page-tools.js")}\n${await here("./driver.js")}</script>`
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" }

createServer(async (request, response) => {
  const { pathname, searchParams } = new URL(request.url, "http://localhost")
  if (request.method === "POST" && pathname === "/qa-report") {
    const parts = []
    for await (const part of request) parts.push(part)
    const game = GAMES.includes(searchParams.get("game")) ? searchParams.get("game") : "unknown"
    await writeFile(`${prefix}-${game}.json`, Buffer.concat(parts))
    response.end("saved")
    return
  }
  const file = join(dist, normalize(pathname === "/" ? "/index.html" : pathname))
  try {
    if (!file.startsWith(dist)) throw new Error("outside dist")
    const body = await readFile(file)
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" })
    response.end(file.endsWith("index.html") ? body.toString().replace("<head>", `<head>${inject}`) : body)
  } catch {
    response.writeHead(404).end("not found")
  }
}).listen(PORT, "127.0.0.1", () => console.log(`serving dist with the iOS driver on http://127.0.0.1:${PORT}`))
