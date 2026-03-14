import { useMemo, useState, useRef, useCallback, useEffect } from 'react'

const NODE_W = 150
const NODE_H = 48
const COURSE_HEADER_H = 38
const COL_GAP = 200
const ROW_GAP = 64
const COURSE_PAD = 14

function getNodeColor(completed, locked) {
  if (completed) return { fill: '#14532d', stroke: '#22c55e', text: '#86efac' }
  if (locked)   return { fill: '#1f2937', stroke: '#374151', text: '#4b5563' }
  return { fill: '#1e3a5f', stroke: '#3b82f6', text: '#93c5fd' }
}

function Arrow({ x1, y1, x2, y2 }) {
  const midX = (x1 + x2) / 2
  return (
    <path
      d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
      fill="none" stroke="#374151" strokeWidth="1.5"
      markerEnd="url(#arrowhead)"
    />
  )
}

export default function DependencyTree({ roadmap }) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  // Zoom / pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const completedCourseIds = new Set(roadmap.courses.filter((c) => c.completed).map((c) => c.id))
  const completedModuleIds = new Set(
    roadmap.courses.flatMap((c) => c.modules.filter((m) => m.completedAt).map((m) => m.id))
  )

  const layout = useMemo(() => {
    const visit = (c, visited, rec, sorted) => {
      if (rec.has(c.id) || visited.has(c.id)) return
      rec.add(c.id)
      for (const pid of c.prerequisiteCourseIds || []) {
        const p = roadmap.courses.find((x) => x.id === pid)
        if (p) visit(p, visited, rec, sorted)
      }
      rec.delete(c.id)
      visited.add(c.id)
      sorted.push(c)
    }
    const sorted = []
    const visited = new Set()
    for (const c of roadmap.courses) visit(c, visited, new Set(), sorted)

    return sorted.map((course, col) => {
      const moduleLayout = course.modules.map((m, row) => ({ module: m, row }))
      const innerH = course.modules.length * ROW_GAP + COURSE_PAD * 2 + COURSE_HEADER_H
      const height = Math.max(innerH, COURSE_HEADER_H + NODE_H + COURSE_PAD * 2)
      return { course, col, moduleLayout, height }
    })
  }, [roadmap])

  const courseBoxWidth = NODE_W + COURSE_PAD * 2

  const courseBoxes = useMemo(() => layout.map(({ course, col, moduleLayout, height }) => {
    const x = col * COL_GAP
    const y = 20
    return {
      course, x, y, width: courseBoxWidth, height,
      modules: moduleLayout.map(({ module, row }) => ({
        module,
        mx: x + COURSE_PAD,
        my: y + COURSE_HEADER_H + COURSE_PAD + row * ROW_GAP,
      })),
    }
  }), [layout, courseBoxWidth])

  const totalWidth = layout.length * COL_GAP + courseBoxWidth + 40
  const maxHeight = layout.length > 0 ? Math.max(...layout.map((l) => l.height)) + 60 : 200

  // ── Fit to screen ────────────────────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    const el = containerRef.current
    if (!el || totalWidth === 0) return
    const { width, height } = el.getBoundingClientRect()
    const scaleX = (width - 20) / totalWidth
    const scaleY = (height - 20) / maxHeight
    const newZoom = Math.min(scaleX, scaleY, 1.5)
    setZoom(newZoom)
    setPan({
      x: (width - totalWidth * newZoom) / 2,
      y: (height - maxHeight * newZoom) / 2,
    })
  }, [totalWidth, maxHeight])

  useEffect(() => {
    const raf = requestAnimationFrame(fitToScreen)
    return () => cancelAnimationFrame(raf)
  }, [fitToScreen])

  // ── Wheel zoom (centered on cursor) ─────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.85 : 1.18
    setZoom((z) => {
      const nz = Math.min(Math.max(z * delta, 0.12), 4)
      setPan((p) => ({
        x: cx - (cx - p.x) * (nz / z),
        y: cy - (cy - p.y) * (nz / z),
      }))
      return nz
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Drag to pan ──────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }
  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    })
  }, [])
  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  // ── Arrows ───────────────────────────────────────────────────────────────────
  const courseArrows = []
  for (const box of courseBoxes) {
    for (const prereqId of box.course.prerequisiteCourseIds || []) {
      const srcBox = courseBoxes.find((b) => b.course.id === prereqId)
      if (srcBox) {
        courseArrows.push({
          x1: srcBox.x + srcBox.width,
          y1: srcBox.y + srcBox.height / 2,
          x2: box.x,
          y2: box.y + box.height / 2,
        })
      }
    }
  }

  const modArrows = []
  for (const box of courseBoxes) {
    for (const { module, mx, my } of box.modules) {
      for (const prereqId of module.prerequisiteModuleIds || []) {
        const srcMod = box.modules.find((bm) => bm.module.id === prereqId)
        if (srcMod) {
          modArrows.push({
            x1: srcMod.mx + NODE_W,
            y1: srcMod.my + NODE_H / 2,
            x2: mx,
            y2: my + NODE_H / 2,
          })
        }
      }
    }
  }

  if (layout.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
        Add courses to see the dependency tree.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Controls bar */}
      <div className="flex items-center gap-2 pb-2 shrink-0 flex-wrap">
        <button
          onClick={fitToScreen}
          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 text-xs rounded font-medium transition-colors"
        >
          ⊡ Fit
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 4))}
          className="w-7 h-7 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 rounded flex items-center justify-center font-bold text-sm transition-colors"
        >+</button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.12))}
          className="w-7 h-7 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 rounded flex items-center justify-center font-bold text-sm transition-colors"
        >−</button>
        <span className="text-gray-500 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <span className="text-gray-700 text-xs ml-auto hidden sm:block">Scroll to zoom · Drag to pan</span>
        <div className="flex gap-3 text-xs text-gray-500">
          {[
            { color: 'bg-green-700 border-green-500', label: 'Done' },
            { color: 'bg-blue-900 border-blue-500',   label: 'Ready' },
            { color: 'bg-gray-800 border-gray-600',   label: 'Locked' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded border ${color}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden rounded-xl bg-gray-950/40 border border-gray-800 cursor-grab active:cursor-grabbing"
        style={{ minHeight: 0, userSelect: 'none', position: 'relative' }}
        onMouseDown={onMouseDown}
      >
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#374151" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {courseArrows.map((a, i) => <Arrow key={`ca-${i}`} {...a} />)}
            {modArrows.map((a, i) => <Arrow key={`ma-${i}`} {...a} />)}

            {courseBoxes.map(({ course, x, y, width, height, modules }) => {
              const isCourseLocked = (course.prerequisiteCourseIds || []).some((pid) => !completedCourseIds.has(pid))
              const courseColors = getNodeColor(course.completed, isCourseLocked)
              const completedMods = modules.filter((bm) => bm.module.completedAt).length
              const totalMods = modules.length
              const coursePct = totalMods ? Math.round((completedMods / totalMods) * 100) : 0

              return (
                <g key={course.id}>
                  <rect
                    x={x} y={y} width={width} height={height}
                    rx="10" ry="10"
                    fill={courseColors.fill} stroke={courseColors.stroke} strokeWidth="1.5"
                  />
                  <text x={x + 10} y={y + 18} fill={courseColors.text} fontSize="11" fontWeight="700">
                    {course.emoji} {course.name.length > 16 ? course.name.slice(0, 15) + '…' : course.name}
                  </text>
                  <text x={x + 10} y={y + 32} fill="#6b7280" fontSize="9">
                    {totalMods > 0 ? `${completedMods}/${totalMods} · ${coursePct}%` : 'No modules'}
                    {course.deadline ? `  📅 ${course.deadline}` : ''}
                  </text>

                  {modules.map(({ module, mx, my }) => {
                    const isModLocked = (module.prerequisiteModuleIds || []).some(
                      (pid) => !completedModuleIds.has(pid)
                    )
                    const modColors = getNodeColor(!!module.completedAt, isModLocked)

                    return (
                      <g
                        key={module.id}
                        onMouseEnter={() => setTooltip({
                          text: `${module.title}\n${module.durationMins}min · ${module.scheduledDate || 'unscheduled'}`,
                          x: mx + NODE_W / 2,
                          y: my,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{ cursor: 'default' }}
                      >
                        <rect
                          x={mx} y={my} width={NODE_W} height={NODE_H}
                          rx="6" ry="6"
                          fill={modColors.fill} stroke={modColors.stroke} strokeWidth="1"
                        />
                        <text x={mx + 8} y={my + 18} fill={modColors.text} fontSize="10" fontWeight="500">
                          {module.completedAt ? '✓ ' : isModLocked ? '🔒 ' : ''}{module.title.length > 17 ? module.title.slice(0, 16) + '…' : module.title}
                        </text>
                        {module.scheduledDate && !module.completedAt && (
                          <text x={mx + 8} y={my + 33} fill="#6b7280" fontSize="9">
                            📅 {module.scheduledDate}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {tooltip && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tooltip.x - 80} y={tooltip.y - 52} width={160} height={44} rx="6" fill="#111827" stroke="#374151" />
                {tooltip.text.split('\n').map((line, i) => (
                  <text key={i} x={tooltip.x} y={tooltip.y - 36 + i * 16} fill="#d1d5db" fontSize="9" textAnchor="middle">{line}</text>
                ))}
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}
