interface LassoOverlayProps {
  origin: { x: number; y: number }
  end: { x: number; y: number }
}

export function LassoOverlay({ origin, end }: LassoOverlayProps) {
  const left = Math.min(origin.x, end.x)
  const top = Math.min(origin.y, end.y)
  const width = Math.abs(end.x - origin.x)
  const height = Math.abs(end.y - origin.y)

  return (
    <div
      className="fixed bg-cyan-400/10 border border-cyan-400 pointer-events-none"
      style={{ left, top, width, height, zIndex: 85 }}
    />
  )
}
