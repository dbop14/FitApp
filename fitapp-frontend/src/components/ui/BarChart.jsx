import { useEffect, useRef, useState } from 'react'

/**
 * Responsive bar chart (SVG, theme aware).
 *
 * bars: [{ key, value, kind: 'met' | 'under' | 'muted', topLabel, bottomLabel, showLabel, isToday, isSelected, ariaLabel }]
 * goal: optional number, drawn as a dashed teal line
 * onSelect(index): bar click / keyboard select
 */
const KIND_CLASS = {
  met: 'fill-teal-500',
  under: 'fill-blue-500',
  muted: 'fill-[rgb(var(--line-strong))]',
}

const niceStep = (max) => {
  if (max <= 12000) return 2500
  if (max <= 30000) return 5000
  return 10000
}

const BarChart = ({ bars, goal, onSelect, height = 260, formatValue = (v) => v.toLocaleString() }) => {
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

  const maxValue = Math.max(goal || 0, 10000, ...bars.map((b) => b.value || 0))
  const step = niceStep(maxValue)
  const yMax = Math.ceil((maxValue * 1.05) / step) * step
  const ticks = []
  for (let v = 0; v <= yMax; v += step) ticks.push(v)

  const padL = 44
  const padR = 8
  const padT = 12
  const padB = 36
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const slot = bars.length ? plotW / bars.length : plotW
  const barW = Math.max(3, Math.min(36, slot * (bars.length > 10 ? 0.7 : 0.5)))
  const y = (v) => padT + plotH - (v / yMax) * plotH

  return (
    <div ref={wrapRef} className="w-full min-w-0 overflow-hidden" style={{ minHeight: height }}>
      {width > 0 && <svg width={width} height={height} role="img" aria-label="Daily steps chart" className="block select-none">
        {/* Grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className="stroke-[rgb(var(--line))]" strokeWidth="1" />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-[rgb(var(--ink-subtle))] text-[10px] font-medium">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}

        {/* Bars */}
        {bars.map((b, i) => {
          const cx = padL + slot * i + slot / 2
          const h = Math.max(b.value > 0 ? 2 : 0, (b.value / yMax) * plotH)
          return (
            <g
              key={b.key ?? i}
              className="cursor-pointer outline-none"
              onClick={() => onSelect?.(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(i)
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={b.ariaLabel}
              aria-pressed={!!b.isSelected}
            >
              {/* full-height hit area */}
              <rect x={cx - slot / 2} y={padT} width={slot} height={plotH} fill="transparent" />
              {b.isSelected && (
                <rect x={cx - slot / 2 + 1} y={padT} width={slot - 2} height={plotH} rx="6" className="fill-[rgb(var(--brand-soft))]" />
              )}
              <rect
                x={cx - barW / 2}
                y={y(0) - h}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 2)}
                className={KIND_CLASS[b.kind] || KIND_CLASS.under}
                opacity={b.value > 0 ? 1 : 0.35}
              />
              {b.isToday && <circle cx={cx} cy={y(0) + 8} r="2.5" className="fill-blue-500" />}
              {b.showLabel !== false && (
                <>
                  <text x={cx} y={height - 16} textAnchor="middle" className={`text-[10px] font-semibold ${b.isSelected ? 'fill-[rgb(var(--brand-ink))]' : 'fill-[rgb(var(--ink-muted))]'}`}>
                    {b.topLabel}
                  </text>
                  <text x={cx} y={height - 4} textAnchor="middle" className="fill-[rgb(var(--ink-subtle))] text-[9px] font-medium uppercase">
                    {b.bottomLabel}
                  </text>
                </>
              )}
            </g>
          )
        })}

        {/* Goal line */}
        {goal > 0 && goal <= yMax && (
          <g pointerEvents="none">
            <line x1={padL} x2={width - padR} y1={y(goal)} y2={y(goal)} className="stroke-teal-500" strokeWidth="1.5" strokeDasharray="6 5" />
            <rect x={width - padR - 50} y={y(goal) - 17} width="50" height="14" rx="7" className="fill-teal-500" />
            <text x={width - padR - 25} y={y(goal) - 10} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[9px] font-bold">
              {formatValue(goal)}
            </text>
          </g>
        )}

        {/* Baseline */}
        <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} className="stroke-[rgb(var(--line-strong))]" strokeWidth="1" />
      </svg>}
    </div>
  )
}

export default BarChart
