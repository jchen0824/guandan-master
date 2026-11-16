import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import type { View } from "./view"

function ViewSwitch({ view, onChange }: { view: View; onChange: (next: View) => void }) {
  return (
    <SegmentedControl
      data-view-switch=""
      aria-label="牌桌视角"
      value={view}
      onValueChange={(next) => next && onChange(next as View)}
    >
      <SegmentedControlItem value="2d">2D</SegmentedControlItem>
      <SegmentedControlItem value="3d">3D</SegmentedControlItem>
    </SegmentedControl>
  )
}

export { ViewSwitch }
