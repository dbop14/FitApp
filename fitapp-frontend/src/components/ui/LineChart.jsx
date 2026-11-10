import { useEffect, useRef, useState } from 'react'

/**
 * Responsive line chart over a fixed set of day slots (SVG, theme aware).
 *
 * slots: number of x positions (days in the range)
 * points: [{ key, index, value, isSelected, ariaLabel }]  (index = slot)
 * yMin, yMax, ticks: y scale
 * xLabels: [{ index, top, bottom }]
 * onSelect(point)
 */
const LineChart = ({ slots, points, yMin, yMax, ticks, xLabels = [], onSelect, height = 260, formatTick = (v) => v }) => {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const update = () => setWidth(Math.max(240, el.clientWidth))
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 40
  const padR = 16
  const padT = 14
  const padB = 36
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const range = yMax - yMin || 1
  const x = (i) => padL + (slots > 1 ? (i / (slots - 1)) * plotW : plotW / 2)
  const y = (v) => padT + plotH - ((v - yMin) / range) * plotH

  const sorted = [...points].sort((a, b) => a.index - b.index)
  const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area =
    sorted.length > 1
      ? `${path} L${x(sorted[sorted.length - 1].index).toFixed(1)},${y(yMin).toFixed(1)} L${x(sorted[0].index).toFixed(1)},${y(yMin).toFixed(1)} Z`
      : ''

  return (
    <div ref={wrapRef} className="w-full min-w-0 overflow-hidden" style={{ minHeight: height }}>
      {width > 0 && <svg width={width} height={height} role="img" aria-label="Weight trend chart" className="block select-none">
        <defs>
          <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className="stroke-[rgb(var(--line))]" strokeWidth="1" />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-[rgb(var(--ink-subtle))] text-[10px] font-medium">
              {formatTick(t)}
            </text>
          </g>
        ))}

        {xLabels.map((l) => (
          <g key={l.index}>
            <text x={x(l.index)} y={height - 16} textAnchor="middle" className="fill-[rgb(var(--ink-muted))] text-[10px] font-semibold">
              {l.top}
            </text>
            <text x={x(l.index)} y={height - 4} textAnchor="middle" className="fill-[rgb(var(--ink-subtle))] text-[9px] font-medium uppercase">
              {l.bottom}
            </text>
          </g>
        ))}

        {area && <path d={area} fill="url(#weight-area)" />}
        {sorted.length > 1 && (
          <path d={path} fill="none" className="stroke-blue-500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {sorted.map((p) => (
          <g
            key={p.key}
            role="button"
            tabIndex={0}
            aria-label={p.ariaLabel}
            aria-pressed={!!p.isSelected}
            className="cursor-pointer outline-none"
            onClick={() => onSelect?.(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.(p)
              }
            }}
          >
            <circle cx={x(p.index)} cy={y(p.value)} r="14" fill="transparent" />
            {p.isSelected && <circle cx={x(p.index)} cy={y(p.value)} r="9" className="fill-blue-500" opacity="0.2" />}
            <circle
              cx={x(p.index)}
              cy={y(p.value)}
              r={p.isSelected ? 5.5 : 4}
              className="fill-blue-500 stroke-[rgb(var(--surface))]"
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>}
    </div>
  )
}

export default LineChart
