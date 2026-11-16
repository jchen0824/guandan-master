// Reads `xcrun simctl list devices available -j` on stdin and prints the UDID of an iPhone on the newest
// iOS the runner has. A plain model ("iPhone 16") is preferred over Pro, Plus and SE for a typical screen.
let text = ""
for await (const chunk of process.stdin) text += chunk
const runtimes = Object.entries(JSON.parse(text).devices)
  .filter(([runtime]) => /SimRuntime\.iOS-/.test(runtime))
  .map(([runtime, devices]) => ({ version: runtime.split("iOS-")[1].split("-").map(Number), devices: devices.filter((d) => d.isAvailable && d.name.startsWith("iPhone")) }))
  .filter((runtime) => runtime.devices.length > 0)
  .sort((a, b) => b.version[0] - a.version[0] || (b.version[1] ?? 0) - (a.version[1] ?? 0))
if (runtimes.length === 0) {
  console.error("no iPhone simulator is available on this runner")
  process.exit(1)
}
const { version, devices } = runtimes[0]
const device = devices.find((d) => /^iPhone \d+$/.test(d.name)) ?? devices[0]
console.error(`using ${device.name} on iOS ${version.join(".")}`)
console.log(device.udid)
