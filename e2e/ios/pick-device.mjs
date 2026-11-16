// Reads `xcrun simctl list devices available -j` on stdin and prints the UDID of an iPhone on the newest
// iOS the runner has. A plain model ("iPhone 16") is preferred over Pro, Plus and SE for a typical screen.
let text = ""
for await (const chunk of process.stdin) text += chunk
// A runtime id is "…SimRuntime.iOS-27-2", or "…SimRuntime.iOS-27-2-iPhone19-4" for one made for a single new
// model. Only the major and minor numbers are a version, and runtimes of the same version share one list.
const byVersion = new Map()
for (const [runtime, devices] of Object.entries(JSON.parse(text).devices)) {
  const match = /SimRuntime\.iOS-(\d+)-(\d+)/.exec(runtime)
  if (!match) continue
  const key = `${match[1]}.${match[2]}`
  const entry = byVersion.get(key) ?? { version: [Number(match[1]), Number(match[2])], devices: [] }
  entry.devices.push(...devices.filter((d) => d.isAvailable && d.name.startsWith("iPhone")))
  byVersion.set(key, entry)
}
const runtimes = [...byVersion.values()].filter((runtime) => runtime.devices.length > 0).sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1])
if (runtimes.length === 0) {
  console.error("no iPhone simulator is available on this runner")
  process.exit(1)
}
const { version, devices } = runtimes[0]
const device = devices.find((d) => /^iPhone \d+$/.test(d.name)) ?? devices[0]
console.error(`using ${device.name} on iOS ${version.join(".")}`)
console.log(device.udid)
