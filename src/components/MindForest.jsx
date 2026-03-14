/**
 * MindForest — Top-down strategy-game knowledge world map.
 *
 * Visual concept: FarmVille / Civilization top-down map.
 * - Each roadmap = a named territory (hex-ish region)
 * - Each course inside roadmap = a sub-region grove
 * - Each skill tag on a course = an individual tree inside that grove
 * - Unexplored courses show fog-of-war over the region
 * - Pan + scroll-zoom + click on trees/regions
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoadmapsStore from '../store/roadmapsStore'
import { SKILL_TIERS, getTier } from '../store/skillsStore'

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic helpers
// ─────────────────────────────────────────────────────────────────────────────
function strHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function rnd(seed) { return ((strHash(String(seed)) % 10000) / 10000) }
function rndRange(seed, lo, hi) { return lo + rnd(seed) * (hi - lo) }

// Split text into at most 2 lines at a word boundary closest to the midpoint
function wrapText(text, maxCharsPerLine = 18) {
  if (text.length <= maxCharsPerLine) return [text]
  const words = text.split(' ')
  if (words.length < 2) return [text]
  let best = 0, bestDiff = Infinity, running = 0
  for (let i = 0; i < words.length - 1; i++) {
    running += words[i].length + 1
    const diff = Math.abs(running - text.length / 2)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  }
  return [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')]
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene / camera constants
// ─────────────────────────────────────────────────────────────────────────────
const SCENE_W  = 4000
const SCENE_H  = 2600
const MIN_ZOOM = 0.08
const MAX_ZOOM = 4.0

// Roadmap territory color palette (cycles)
const TERRITORY_PALETTES = [
  { land: '#0f1f0f', border: '#1e4d1e', fog: '#0a150a', accent: '#4ade80', glow: 'rgba(74,222,128,0.15)' },
  { land: '#0f0f20', border: '#1e1e55', fog: '#09091a', accent: '#818cf8', glow: 'rgba(129,140,248,0.15)' },
  { land: '#200f0f', border: '#551e1e', fog: '#1a0909', accent: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  { land: '#201c0f', border: '#55480e', fog: '#1a1608', accent: '#fbbf24', glow: 'rgba(251,191,36,0.15)'  },
  { land: '#0f1c20', border: '#1e4555', fog: '#091318', accent: '#38bdf8', glow: 'rgba(56,189,248,0.15)'  },
  { land: '#1c0f20', border: '#451e55', fog: '#130918', accent: '#c084fc', glow: 'rgba(192,132,252,0.15)' },
  { land: '#0f201a', border: '#1e5542', fog: '#091a14', accent: '#34d399', glow: 'rgba(52,211,153,0.15)'  },
  { land: '#201a0f', border: '#554010', fog: '#1a1208', accent: '#fb923c', glow: 'rgba(251,146,60,0.15)'  },
]

// Regular hexagon points helper
function hexPoints(cx, cy, r, rotation = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i + rotation)
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout: pack territories in a grid with jitter
// ─────────────────────────────────────────────────────────────────────────────
function layoutTerritories(roadmaps) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(roadmaps.length * 1.4)))
  const cellW = SCENE_W / cols
  const cellH = SCENE_H / Math.ceil(roadmaps.length / cols)

  return roadmaps.map((rm, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = cellW * col + cellW / 2 + rndRange(rm.id + 'cx', -cellW * 0.12, cellW * 0.12)
    const cy = cellH * row + cellH / 2 + rndRange(rm.id + 'cy', -cellH * 0.12, cellH * 0.12)
    const radius = Math.min(cellW, cellH) * rndRange(rm.id + 'r', 0.30, 0.44)
    const palette = TERRITORY_PALETTES[i % TERRITORY_PALETTES.length]
    return { rm, cx, cy, radius, palette, index: i }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Build skill tree data for a course
// ─────────────────────────────────────────────────────────────────────────────
function buildCourseTrees(course, roadmap, cx, cy, regionRadius) {
  // Use explicit skill tags if defined, otherwise fall back to module titles
  const rawSkills  = (course.skills || []).filter(Boolean)
  const skillNames = rawSkills.length > 0
    ? rawSkills
    : (course.modules || []).map((m) => m.title || `Module ${m.id}`).slice(0, 24)

  if (skillNames.length === 0) return []

  const count     = skillNames.length
  const spread    = regionRadius * 0.62
  const totalMods = course.modules?.length ?? 0
  const isCompleted = !!course.completed

  return skillNames.map((name, idx) => {
    // Assign each skill a proportional slice of the course's modules.
    // This makes trees grow progressively as you complete modules in order.
    const modStart = Math.floor(idx * totalMods / count)
    const modEnd   = Math.floor((idx + 1) * totalMods / count)
    const myMods   = totalMods > 0 ? (course.modules || []).slice(modStart, modEnd) : []
    const myDone   = myMods.filter((m) => m.completedAt).length
    const myTotal  = myMods.length

    // Per-skill completion (falls back to full course pct when no modules assigned)
    const skillPct  = myTotal > 0 ? myDone / myTotal : (isCompleted ? 1 : 0)
    const skillDone = isCompleted || (myTotal > 0 && myDone === myTotal)

    const stage = skillDone        ? 4
      : skillPct >= 0.75 ? 3
      : skillPct >= 0.40 ? 2
      : skillPct >= 0.05 ? 1
      : 0

    const tierKey = stage === 0 ? 'unexplored'
      : stage === 1 ? 'initiate'
      : stage === 2 ? 'practitioner'
      : stage === 3 ? 'master'
      : 'legend'

    const tierMeta   = SKILL_TIERS[tierKey]
    const baseRadius = 12 + stage * 7

    const angle = (idx / count) * Math.PI * 2 + rndRange(name + course.id + 'ang', -0.4, 0.4)
    const dist  = rndRange(name + course.id + 'dist', 0.25, 0.95) * spread
    const tx    = cx + Math.cos(angle) * dist
    const ty    = cy + Math.sin(angle) * dist

    return {
      id: name + '-' + course.id,
      name,
      key: name.toLowerCase(),
      stage,
      tierKey,
      color: tierMeta.color,
      glowColor: tierMeta.glowColor,
      tx, ty,
      baseRadius,
      courseId: course.id,
      roadmapId: roadmap.id,
      courseName: course.name,
      roadmapName: roadmap.name,
      pct: skillPct,
      isCompleted: skillDone,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Organic bezier helper (Q quadratic with perpendicular control point offset)
// ─────────────────────────────────────────────────────────────────────────────
function organicPath(x1, y1, x2, y2, curvature = 0.28) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1, dy = y2 - y1
  const cpx = mx + (-dy) * curvature
  const cpy = my + dx  * curvature
  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill→grove connection paths (drawn below trees)
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionPaths({ trees, gcx, gcy, accent, zoom }) {
  if (!trees.length) return null
  const sw = Math.max(0.6, 1.6 / zoom)
  return (
    <g pointerEvents="none">
      {/* Grove hub spoke */}
      <circle cx={gcx} cy={gcy} r={Math.max(2, 3.5 / zoom)}
        fill={accent} opacity="0.55" />
      {trees.map((tree) => {
        const pathD = organicPath(gcx, gcy, tree.tx, tree.ty, 0.22)
        const opacity = tree.stage === 0 ? 0.12 : 0.30
        return (
          <path key={tree.id} d={pathD}
            stroke={accent} strokeWidth={sw}
            fill="none" opacity={opacity}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG: Top-down tree canopy (viewed from above)
// ─────────────────────────────────────────────────────────────────────────────

// Ground shadow beneath canopy
function TreeShadow({ tx, ty, r }) {
  return (
    <ellipse
      cx={tx + r * 0.18} cy={ty + r * 0.28}
      rx={r * 0.9} ry={r * 0.45}
      fill="rgba(0,0,0,0.35)"
      style={{ filter: 'blur(3px)' }}
    />
  )
}

// Fog patch (stage 0) — top-down misty blob
function FogTree({ tx, ty, r, seed, skill, onHover, onLeave, onClick }) {
  return (
    <g className="cursor-pointer"
       onMouseEnter={(e) => onHover(skill, e)} onMouseLeave={onLeave}
       onClick={() => onClick(skill)}>
      <ellipse cx={tx} cy={ty} rx={r * 1.2} ry={r * 0.9} fill="rgba(148,163,184,0.12)" style={{ filter: 'blur(7px)' }} />
      <ellipse cx={tx - r*0.3} cy={ty - r*0.2} rx={r*0.7} ry={r*0.5} fill="rgba(148,163,184,0.07)" style={{ filter: 'blur(5px)' }} />
      <text x={tx} y={ty + 4} textAnchor="middle" fontSize={Math.max(7, r * 0.55)}
        fill="rgba(148,163,184,0.3)" fontFamily="sans-serif">?</text>
    </g>
  )
}

// Top-down sapling — small dot + tiny leaf ring
function SaplingTree({ tx, ty, r, color, seed, skill, onHover, onLeave, onClick }) {
  const dur = 3.5 + rnd(seed + 'sd') * 2
  return (
    <g className="cursor-pointer"
       onMouseEnter={(e) => onHover(skill, e)} onMouseLeave={onLeave}
       onClick={() => onClick(skill)}>
      <TreeShadow tx={tx} ty={ty} r={r} />
      {/* Trunk dot */}
      <circle cx={tx} cy={ty} r={r * 0.25} fill="#6b4c2a" />
      {/* Foliage ring */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const lx = tx + Math.cos(rad) * r * 0.52
        const ly = ty + Math.sin(rad) * r * 0.43
        return (
          <ellipse key={deg} cx={lx} cy={ly} rx={r * 0.38} ry={r * 0.32}
            fill={color} opacity="0.78">
            <animate attributeName="rx"
              values={`${r*0.38};${r*0.42};${r*0.38}`}
              dur={`${dur + deg*0.005}s`} repeatCount="indefinite" />
          </ellipse>
        )
      })}
      <circle cx={tx} cy={ty} r={r * 0.45} fill={color} opacity="0.6" />
    </g>
  )
}

// Top-down young tree — wider canopy with sub-blobs
function YoungTreeTopDown({ tx, ty, r, color, seed, skill, onHover, onLeave, onClick }) {
  const dur = 4.2 + rnd(seed + 'yd') * 2.5
  const offsets = [
    { a: 0,   d: 0.55 }, { a: 72,  d: 0.52 }, { a: 144, d: 0.54 },
    { a: 216, d: 0.50 }, { a: 288, d: 0.53 },
  ]
  return (
    <g className="cursor-pointer"
       onMouseEnter={(e) => onHover(skill, e)} onMouseLeave={onLeave}
       onClick={() => onClick(skill)}>
      <TreeShadow tx={tx} ty={ty} r={r} />
      {/* Base canopy */}
      <circle cx={tx} cy={ty} r={r * 0.88} fill={color} opacity="0.65">
        <animate attributeName="r" values={`${r*0.88};${r*0.94};${r*0.88}`} dur={`${dur}s`} repeatCount="indefinite" />
      </circle>
      {/* Sub-blobs */}
      {offsets.map(({ a, d }, i) => {
        const rad = (a * Math.PI) / 180
        return (
          <circle key={i}
            cx={tx + Math.cos(rad) * r * d} cy={ty + Math.sin(rad) * r * d}
            r={r * 0.45} fill={color} opacity="0.75">
            <animate attributeName="r"
              values={`${r*0.45};${r*0.50};${r*0.45}`}
              dur={`${dur + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        )
      })}
      {/* Trunk center */}
      <circle cx={tx} cy={ty} r={r * 0.18} fill="#5a3d20" opacity="0.9" />
    </g>
  )
}

// Top-down full/master tree — lush layered canopy
function FullTreeTopDown({ tx, ty, r, color, seed, skill, onHover, onLeave, onClick }) {
  const dur = 5 + rnd(seed + 'fd') * 3
  const layers = [
    { scale: 1.0,  opacity: 0.60 },
    { scale: 0.80, opacity: 0.72 },
    { scale: 0.55, opacity: 0.85 },
    { scale: 0.30, opacity: 1.00 },
  ]
  // Ring of sub-blobs
  const blobs = Array.from({ length: 8 }, (_, i) => ({
    ang: i * 45 + rnd(seed + 'bang' + i) * 20,
    d: 0.58 + rnd(seed + 'bd' + i) * 0.20,
    r: 0.38 + rnd(seed + 'br' + i) * 0.15,
  }))
  return (
    <g className="cursor-pointer"
       onMouseEnter={(e) => onHover(skill, e)} onMouseLeave={onLeave}
       onClick={() => onClick(skill)}>
      <TreeShadow tx={tx} ty={ty} r={r * 1.1} />
      {/* Outer perimeter blobs */}
      {blobs.map(({ ang, d, r: br }, i) => {
        const rad = (ang * Math.PI) / 180
        return (
          <circle key={i}
            cx={tx + Math.cos(rad) * r * d} cy={ty + Math.sin(rad) * r * d}
            r={r * br} fill={color} opacity="0.70">
            <animate attributeName="r" values={`${r*br};${r*(br+0.05)};${r*br}`}
              dur={`${dur + i * 0.22}s`} repeatCount="indefinite" />
          </circle>
        )
      })}
      {/* Concentric canopy layers */}
      {layers.map(({ scale, opacity }, i) => (
        <circle key={i} cx={tx} cy={ty} r={r * scale} fill={color} opacity={opacity}>
          <animate attributeName="r"
            values={`${r*scale};${r*(scale+0.04)};${r*scale}`}
            dur={`${dur + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* Trunk */}
      <circle cx={tx} cy={ty} r={r * 0.15} fill="#4a2e10" />
      {/* Light highlight */}
      <ellipse cx={tx - r * 0.22} cy={ty - r * 0.28}
        rx={r * 0.32} ry={r * 0.22}
        fill="rgba(255,255,255,0.12)" style={{ filter: 'blur(2px)' }} />
    </g>
  )
}

// Top-down ancient/legend tree — glowing crown + fireflies
function AncientTreeTopDown({ tx, ty, r, color, glowColor, seed, skill, onHover, onLeave, onClick }) {
  const dur = 6 + rnd(seed + 'ad') * 4
  const fireflies = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      angle: rnd(seed + 'ffa' + i) * Math.PI * 2,
      dist:  r * (0.8 + rnd(seed + 'ffd' + i) * 0.7),
      size:  1.2 + rnd(seed + 'ffr' + i) * 1.5,
      dur:   1.4 + rnd(seed + 'fft' + i) * 2.2,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [seed, r])

  const blobs = Array.from({ length: 9 }, (_, i) => ({
    ang: i * 40 + rnd(seed + 'ab' + i) * 22,
    d:   0.62 + rnd(seed + 'abd' + i) * 0.25,
    r:   0.42 + rnd(seed + 'abr' + i) * 0.18,
  }))

  return (
    <g className="cursor-pointer"
       onMouseEnter={(e) => onHover(skill, e)} onMouseLeave={onLeave}
       onClick={() => onClick(skill)}>
      {/* Outer glow aura */}
      <circle cx={tx} cy={ty} r={r * 1.6}
        fill={glowColor} opacity="0.09" style={{ filter: 'blur(12px)' }}>
        <animate attributeName="r" values={`${r*1.6};${r*1.8};${r*1.6}`} dur={`${dur*0.7}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.09;0.16;0.09" dur={`${dur*0.7}s`} repeatCount="indefinite" />
      </circle>
      <TreeShadow tx={tx} ty={ty} r={r * 1.2} />
      {/* Perimeter blob ring */}
      {blobs.map(({ ang, d, r: br }, i) => {
        const rad = (ang * Math.PI) / 180
        return (
          <circle key={i}
            cx={tx + Math.cos(rad) * r * d} cy={ty + Math.sin(rad) * r * d}
            r={r * br} fill={color} opacity="0.72">
            <animate attributeName="r" values={`${r*br};${r*(br+0.06)};${r*br}`}
              dur={`${dur + i * 0.25}s`} repeatCount="indefinite" />
          </circle>
        )
      })}
      {/* Canopy layers */}
      {[1.0, 0.78, 0.55, 0.32].map((scale, i) => (
        <circle key={i} cx={tx} cy={ty} r={r * scale}
          fill={i === 0 ? color : i < 3 ? color : glowColor}
          opacity={i === 0 ? 0.62 : i === 1 ? 0.78 : i === 2 ? 0.90 : 0.80}>
          <animate attributeName="r"
            values={`${r*scale};${r*(scale+0.05)};${r*scale}`}
            dur={`${dur + i * 0.6}s`} repeatCount="indefinite" />
          {i === 3 && (
            <animate attributeName="opacity" values="0.80;0.40;0.80" dur={`${dur*0.5}s`} repeatCount="indefinite" />
          )}
        </circle>
      ))}
      {/* Trunk */}
      <circle cx={tx} cy={ty} r={r * 0.12} fill="#2d1a06" />
      {/* Light highlight */}
      <ellipse cx={tx - r * 0.28} cy={ty - r * 0.35}
        rx={r * 0.38} ry={r * 0.25}
        fill="rgba(255,255,255,0.18)" style={{ filter: 'blur(2px)' }} />
      {/* Glowing center pulse */}
      <circle cx={tx} cy={ty} r={r * 0.32} fill={glowColor} opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2.2s" repeatCount="indefinite" />
      </circle>
      {/* Fireflies */}
      {fireflies.map((ff, i) => (
        <circle key={i}
          cx={tx + Math.cos(ff.angle) * ff.dist}
          cy={ty + Math.sin(ff.angle) * ff.dist}
          r={ff.size} fill={glowColor} opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.05;0.9" dur={`${ff.dur}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate"
            values={`0,0;${Math.cos(ff.angle + 1.5) * 6},${Math.sin(ff.angle + 1.5) * 6};0,0`}
            dur={`${ff.dur * 1.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Region (course grove)
// ─────────────────────────────────────────────────────────────────────────────
function CourseGrove({
  course, roadmap, cx, cy, radius, palette, revealed,
  onHover, onLeave, onTreeClick, onGroveClick,
  zoom,
}) {
  const trees = useMemo(
    () => buildCourseTrees(course, roadmap, cx, cy, radius),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course.id, course.completed, course.modules?.map(m => m.completedAt).join(','), (course.skills||[]).join(',')]
  )

  const totalMods  = course.modules?.length ?? 0
  const doneMods   = course.modules?.filter((m) => m.completedAt)?.length ?? 0
  const pct        = totalMods > 0 ? Math.round((doneMods / totalMods) * 100) : (course.completed ? 100 : 0)
  const isComplete = !!course.completed
  const hasTrees   = trees.length > 0
  const arcR       = radius + 5
  const arcCirc    = 2 * Math.PI * arcR

  return (
    <g>
      {/* Grove ground patch — hex shape */}
      <polygon
        points={hexPoints(cx, cy, radius, 30)}
        fill={revealed ? palette.land : palette.fog}
        stroke={palette.border} strokeWidth={revealed ? 1.8 : 0.8}
        opacity={revealed ? 1 : 0.55}
        className="cursor-pointer"
        style={{ filter: revealed ? `drop-shadow(0 0 ${radius * 0.08}px ${palette.accent}22)` : 'none' }}
        onClick={() => onGroveClick(course, roadmap)}
      />

      {/* Inner glow ring */}
      {revealed && (
        <polygon points={hexPoints(cx, cy, radius * 0.88, 30)}
          fill="none" stroke={palette.accent} strokeWidth="0.6" opacity="0.18" />
      )}
      {revealed && (
        <polygon points={hexPoints(cx, cy, radius * 0.65, 30)}
          fill="none" stroke={palette.border} strokeWidth="0.5" opacity="0.20" />
      )}

      {/* Progress arc around grove */}
      {revealed && pct > 0 && pct < 100 && (
        <circle
          cx={cx} cy={cy} r={arcR}
          fill="none"
          stroke={palette.accent}
          strokeWidth="2.5"
          strokeDasharray={`${(pct / 100) * arcCirc} ${arcCirc}`}
          strokeDashoffset={arcCirc * 0.25}
          strokeLinecap="round"
          opacity="0.85"
        />
      )}
      {/* Complete ring */}
      {isComplete && (
        <>
          <circle cx={cx} cy={cy} r={arcR}
            fill="none" stroke={palette.accent} strokeWidth="2" opacity="0.95" />
          <circle cx={cx} cy={cy} r={arcR}
            fill="none" stroke={palette.accent} strokeWidth="8" opacity="0.18"
            style={{ filter: 'blur(4px)' }} />
        </>
      )}

      {/* FOG OF WAR */}
      {!revealed && (
        <>
          <polygon points={hexPoints(cx, cy, radius * 1.05, 30)}
            fill={palette.fog} opacity="0.90"
            filter="url(#fogFilter)" />
          <polygon points={hexPoints(cx, cy, radius * 0.80, 30)}
            fill={palette.fog} opacity="0.55"
            filter="url(#fogFilter)">
            <animate attributeName="opacity" values="0.55;0.75;0.55" dur="7s" repeatCount="indefinite" />
          </polygon>
          <circle cx={cx} cy={cy} r={radius * 0.62}
            fill="rgba(0,0,0,0.40)">
            <animate attributeName="r"
              values={`${radius*0.62};${radius*0.72};${radius*0.62}`}
              dur="9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.40;0.60;0.40" dur="9s" repeatCount="indefinite" />
          </circle>
          <text x={cx} y={cy - 2} textAnchor="middle"
            fontSize={radius * 0.38} fontFamily="sans-serif" fill="rgba(148,163,184,0.35)">
            🌫️
          </text>
          {(() => {
            const fSize = Math.max(7, Math.min(12, radius * 0.20)) / zoom
            return (
              <text x={cx} y={cy + radius * 0.38} textAnchor="middle"
                fontSize={fSize} fontFamily="'Inter',sans-serif"
                fill="rgba(148,163,184,0.35)" filter="url(#labelShadow)">
                {course.name}
              </text>
            )
          })()}
        </>
      )}

      {/* TREES (only when revealed) */}
      {revealed && hasTrees && (
        <>
          <ConnectionPaths trees={trees} gcx={cx} gcy={cy} accent={palette.accent} zoom={zoom} />
          {trees.map((tree) => {
        const tProps = {
          tx: tree.tx, ty: tree.ty,
          r: tree.baseRadius,
          color: tree.color,
          glowColor: tree.glowColor,
          seed: tree.id,
          skill: tree,
          onHover, onLeave,
          onClick: onTreeClick,
        }
        return tree.stage === 0 ? <FogTree key={tree.id} {...tProps} />
          : tree.stage === 1   ? <SaplingTree key={tree.id} {...tProps} />
          : tree.stage === 2   ? <YoungTreeTopDown key={tree.id} {...tProps} />
          : tree.stage === 3   ? <FullTreeTopDown key={tree.id} {...tProps} />
          :                      <AncientTreeTopDown key={tree.id} {...tProps} />
        })}
          {/* Skill name labels — appear when zoomed in, below each tree */}
          {zoom > 0.45 && trees.map((tree) => {
            if (tree.stage === 0) return null
            const fSize = Math.max(7, 11 / zoom)
            const lines = wrapText(tree.name, 14)
            return (
              <g key={tree.id + '-lbl'} pointerEvents="none">
                {lines.map((line, li) => (
                  <text key={li}
                    x={tree.tx}
                    y={tree.ty + tree.baseRadius + (9 + li * fSize * 1.25 * zoom) / zoom}
                    textAnchor="middle"
                    fontSize={fSize}
                    fontFamily="'Inter',sans-serif"
                    fill="rgba(255,255,255,0.82)"
                    filter="url(#labelShadow)"
                  >{line}</text>
                ))}
              </g>
            )
          })}
        </>
      )}

      {/* Grove label — full name, 2-line wrap, zoom-inverse size */}
      {revealed && (() => {
        const emoji  = course.emoji || '📚'
        const lines  = wrapText(course.name, 16)
        const fSize  = Math.max(9, Math.min(15, radius * 0.22)) / zoom
        const lineH  = fSize * 1.32
        const line1  = `${emoji} ${lines[0]}`
        const line2  = lines[1] || null
        const maxLen = Math.max(line1.length, line2 ? line2.length : 0)
        const pillW  = maxLen * fSize * 0.56 + 18
        const pillH  = line2 ? lineH * 2 + fSize * 0.4 : fSize * 1.6
        const pillX  = cx - pillW / 2
        const pillY  = cy + radius + 6 / zoom
        return (
          <g pointerEvents="none">
            <rect x={pillX} y={pillY} width={pillW} height={pillH}
              rx={6 / zoom} fill={palette.land} fillOpacity="0.92"
              stroke={palette.border} strokeWidth={0.8 / zoom} />
            <text x={cx} y={pillY + fSize * 1.05}
              textAnchor="middle"
              fontSize={fSize}
              fontFamily="'Inter',sans-serif" fontWeight="600"
              fill={palette.accent} opacity="0.95"
              filter="url(#labelShadow)"
            >
              {line1}
              {line2 && <tspan x={cx} dy={lineH}>{line2}</tspan>}
            </text>
          </g>
        )
      })()}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Territory (roadmap region)
// ─────────────────────────────────────────────────────────────────────────────
function RoadmapTerritory({
  territory, onHover, onLeave, onTreeClick, onGroveClick, zoom,
}) {
  const { rm, cx, cy, radius, palette } = territory
  const groves = useMemo(() => {
    if (rm.courses.length === 0) return []
    // Arrange courses in a ring inside territory
    const count = rm.courses.length
    const groveRadius = radius * rndRange(rm.id + 'gr', 0.16, 0.24)
    return rm.courses.map((course, i) => {
      const angle  = (i / count) * Math.PI * 2 + rndRange(rm.id + course.id + 'ga', -0.3, 0.3)
      const dist   = radius * rndRange(rm.id + course.id + 'gd', 0.25, 0.68)
      const gcx    = cx + Math.cos(angle) * dist
      const gcy    = cy + Math.sin(angle) * dist
      return { course, gcx, gcy, groveRadius }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rm.id, rm.courses.length])

  const totalCourses = rm.courses.length
  const doneCourses  = rm.courses.filter((c) => c.completed).length
  const allDone      = totalCourses > 0 && doneCourses === totalCourses

  return (
    <g>
      {/* Territory outer glow halo (always on for premium feel) */}
      <polygon points={hexPoints(cx, cy, radius * 1.06, 15)}
        fill={palette.glow} stroke="none"
        style={{ filter: `blur(${radius * 0.18}px)` }} />

      {/* Territory hex background */}
      <polygon points={hexPoints(cx, cy, radius, 15)}
        fill={palette.land} opacity="0.70"
        stroke={palette.border} strokeWidth="2"
      />
      {/* Inner accent ring */}
      <polygon points={hexPoints(cx, cy, radius * 0.94, 15)}
        fill="none" stroke={palette.accent} strokeWidth="0.7"
        strokeDasharray="10 7" opacity="0.25"
      />
      {/* Second inner ring for depth */}
      <polygon points={hexPoints(cx, cy, radius * 0.75, 15)}
        fill="none" stroke={palette.border} strokeWidth="0.5"
        opacity="0.18"
      />

      {/* Conquest glow for fully completed territories */}
      {allDone && (
        <>
          <polygon points={hexPoints(cx, cy, radius + 8, 15)}
            fill="none" stroke={palette.accent} strokeWidth="3" opacity="0.40"
            style={{ filter: 'blur(5px)' }}>
            <animate attributeName="opacity" values="0.40;0.80;0.40" dur="2.2s" repeatCount="indefinite" />
          </polygon>
          <polygon points={hexPoints(cx, cy, radius + 2, 15)}
            fill="none" stroke={palette.accent} strokeWidth="1.5" opacity="0.70" />
        </>
      )}

      {/* Territory name banner — zoom-inverse, fades out when zoomed in close */}
      {(() => {
        const fadeOpacity = zoom < 0.35 ? 0.92
          : zoom > 0.75 ? 0
          : 0.92 * (0.75 - zoom) / 0.40
        if (fadeOpacity < 0.04) return null
        const fSize  = Math.max(10, Math.min(22, radius * 0.14)) / zoom
        const emoji  = rm.emoji || '🗺️'
        const lines  = wrapText(rm.name, 20)
        const lineH  = fSize * 1.3
        const line1  = `${emoji} ${lines[0]}`
        const line2  = lines[1] || null
        const maxLen = Math.max(line1.length, line2 ? line2.length : 0)
        const pillW  = maxLen * fSize * 0.56 + 24
        const pillH  = line2 ? lineH * 2 + fSize * 0.45 : fSize * 1.6
        const pillX  = cx - pillW / 2
        const pillY  = cy - radius - (pillH + 12 / zoom)
        return (
          <g pointerEvents="none" opacity={fadeOpacity}>
            <rect x={pillX} y={pillY} width={pillW} height={pillH}
              rx={pillH / 3} fill="#060c0a" fillOpacity="0.82"
              stroke={palette.accent} strokeWidth={1 / zoom} strokeOpacity="0.45" />
            <text x={cx} y={pillY + fSize * 1.1}
              textAnchor="middle" fontSize={fSize}
              fontFamily="'Inter',sans-serif" fontWeight="700"
              fill={palette.accent}
              filter="url(#labelShadow)"
            >
              {line1}
              {line2 && <tspan x={cx} dy={lineH}>{line2}</tspan>}
            </text>
          </g>
        )
      })()}

      {/* Course progress counter — zoom-inverse */}
      {totalCourses > 0 && (() => {
        const fSize = Math.max(7, Math.min(11, radius * 0.09)) / zoom
        return (
          <text x={cx} y={cy + radius + 30 / zoom}
            textAnchor="middle" fontSize={fSize}
            fontFamily="sans-serif" fill="rgba(180,220,180,0.40)"
          >
            {doneCourses}/{totalCourses} courses
          </text>
        )
      })()}

      {/* Course groves */}
      {groves.map(({ course, gcx, gcy, groveRadius }) => {
        const revealed = course.completed ||
          (course.modules?.some((m) => m.completedAt)) ||
          (course.modules?.length > 0)
        return (
          <CourseGrove
            key={course.id}
            course={course} roadmap={rm}
            cx={gcx} cy={gcy} radius={groveRadius}
            palette={palette} revealed={revealed}
            onHover={onHover} onLeave={onLeave}
            onTreeClick={onTreeClick} onGroveClick={onGroveClick}
            zoom={zoom}
          />
        )
      })}

      {/* Empty territory placeholder */}
      {totalCourses === 0 && (
        <text x={cx} y={cy + 5}
          textAnchor="middle"
          fontSize={Math.max(7, radius * 0.12)}
          fontFamily="sans-serif"
          fill="rgba(148,163,184,0.30)"
        >
          No courses yet
        </text>
      )}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Background terrain
// ─────────────────────────────────────────────────────────────────────────────
function WorldBackground() {
  const tiles = useMemo(() => {
    const out = []
    const step = 160
    for (let row = 0; row * step < SCENE_H + step; row++) {
      for (let col = 0; col * step < SCENE_W + step; col++) {
        const ox = row % 2 === 0 ? 0 : step / 2
        const tx = col * step + ox
        const ty = row * step * 0.86
        const v  = rnd(`t${row}-${col}`)
        out.push({ tx, ty, v })
      }
    }
    return out
  }, [])

  const rays = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      x1: 100 + i * 780, y1: 0,
      x2: 100 + i * 780 + 700, y2: SCENE_H,
      dur: 28 + i * 9,
    })), [])

  return (
    <g>
      <defs>
        <filter id="labelShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000000" floodOpacity="0.90" />
        </filter>
        <filter id="fogFilter" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.014" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="conquestGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Subtle bloom for ancient trees */}
        <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="wmap-vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
        </radialGradient>
        {/* Grid-line pattern */}
        <pattern id="hex-grid" patternUnits="userSpaceOnUse" width="160" height="138.56">
          <polygon points={hexPoints(80, 69.28, 72, 30)}
            fill="none" stroke="#0d1f0d" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Deep background */}
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill="#04080a" />
      {/* Hex grid overlay */}
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill="url(#hex-grid)" opacity="0.7" />
      {/* Subtle dot nodes at hex intersections for depth */}
      {tiles.filter((_, i) => i % 3 === 0).map(({ tx, ty, v }, i) => (
        <circle key={i} cx={tx} cy={ty} r={v > 0.7 ? 1.2 : 0.7}
          fill={v > 0.6 ? '#1a3020' : '#0f1a10'}
          opacity={0.4 + v * 0.35}
        />
      ))}
      {/* Light shafts */}
      {rays.map((ray, i) => (
        <line key={i} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
          stroke="rgba(160,230,160,0.028)" strokeWidth="110"
          strokeLinecap="round">
          <animate attributeName="opacity" values="0.4;1.0;0.4" dur={`${ray.dur}s`} repeatCount="indefinite" />
        </line>
      ))}
      {/* Vignette */}
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill="url(#wmap-vignette)" />
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient floating particles across whole world
// ─────────────────────────────────────────────────────────────────────────────
function WorldParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => {
      const palette = TERRITORY_PALETTES[i % TERRITORY_PALETTES.length]
      return {
        x:   rndRange('px' + i, 0, SCENE_W),
        y:   rndRange('py' + i, 0, SCENE_H),
        r:   rndRange('pr' + i, 1.0, 3.0),
        dur: rndRange('pd' + i, 20, 60),
        dxAmp: (rnd('pdx' + i) - 0.5) * 18,
        dyAmp: -4 - rnd('pdy' + i) * 12,
        col: palette.accent,
        phaseOffset: rnd('pp' + i),
      }
    }), [])

  return (
    <g>
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.col} opacity="0.40">
          <animate attributeName="opacity"
            values={`0;0.55;0.40;0.55;0`}
            dur={`${p.dur}s`} begin={`${p.phaseOffset * p.dur}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate"
            values={`0,0;${p.dxAmp * 0.5},${p.dyAmp * 0.5};${p.dxAmp},${p.dyAmp};${p.dxAmp * 0.5},${p.dyAmp * 0.5};0,0`}
            dur={`${p.dur}s`} begin={`${p.phaseOffset * p.dur}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_LABELS = ['🌫️ Seedling', '🌱 Sprouting', '🌿 Growing', '🌳 Mature', '🌲 Ancient']

function WorldTooltip({ data, pos }) {
  if (!data) return null

  const isGrove = data._type === 'grove'
  const isTree  = data._type === 'tree'
  const stageColors = ['#6b7280','#cd7f32','#94a3b8','#f59e0b','#a78bfa']
  const accentColor = isTree ? data.color : '#34d399'

  return (
    <AnimatePresence>
      <motion.div
        key={data.id || data.courseId}
        initial={{ opacity: 0, y: 8, scale: 0.90 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.14, type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed z-[300] pointer-events-none"
        style={{ left: Math.min(pos.x + 18, window.innerWidth - 230), top: pos.y - 20 }}
      >
        <div
          className="bg-gray-950/98 rounded-2xl shadow-2xl min-w-[170px] max-w-[240px] overflow-hidden backdrop-blur"
          style={{ border: `1px solid ${accentColor}40`, boxShadow: `0 0 24px ${accentColor}18, 0 8px 32px rgba(0,0,0,0.7)` }}
        >
          {/* Top accent stripe */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
          <div className="px-4 py-3">
            {isTree && (
              <>
                <p className="text-white text-sm font-bold leading-tight">{data.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-semibold" style={{ color: data.color }}>{STAGE_LABELS[data.stage]}</span>
                </div>
                {/* Stage bar */}
                <div className="flex gap-0.5 mt-2">
                  {[0,1,2,3,4].map((s) => (
                    <div key={s} className="flex-1 h-1 rounded-full"
                      style={{ backgroundColor: s <= data.stage ? data.color : '#2d3748', opacity: s <= data.stage ? 1 : 0.4 }} />
                  ))}
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] text-gray-400">📚 {data.courseName}</p>
                  <p className="text-[10px] text-gray-500">🗺️ {data.roadmapName}</p>
                </div>
                {data.isCompleted && (
                  <div className="mt-1.5 flex items-center gap-1 text-emerald-400">
                    <span className="text-[10px]">✅ Course complete</span>
                  </div>
                )}
              </>
            )}
            {isGrove && (
              <>
                <p className="text-white text-sm font-bold leading-tight">{data.course?.emoji} {data.course?.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">🗺️ {data.roadmap?.name}</p>
                {/* Progress bar */}
                {data.totalMods > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>{data.doneMods}/{data.totalMods} modules</span>
                      <span style={{ color: accentColor }}>{Math.round(data.doneMods / data.totalMods * 100)}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(data.doneMods / data.totalMods) * 100}%`, backgroundColor: accentColor }} />
                    </div>
                  </div>
                )}
                {data.skillCount > 0 && (
                  <p className="text-[10px] text-emerald-400 mt-1.5">🌿 {data.skillCount} skill trees</p>
                )}
                {data.course?.completed && (
                  <p className="text-[10px] text-emerald-400 mt-1">✅ Completed</p>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Selected skill panel (side drawer)
// ─────────────────────────────────────────────────────────────────────────────
const TIER_COLORS = {
  unexplored: '#6b7280', initiate: '#cd7f32',
  practitioner: '#94a3b8', master: '#f59e0b', legend: '#a78bfa',
}

function SkillPanel({ skill, course, roadmap, onClose }) {
  if (!skill) return null
  const tierLabel  = STAGE_LABELS[skill.stage]
  const totalMods  = course?.modules?.length ?? 0
  const doneMods   = course?.modules?.filter((m) => m.completedAt)?.length ?? 0
  const pct        = Math.round(skill.pct * 100)

  return (
    <motion.div
      initial={{ opacity: 0, x: 28, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="absolute top-3 right-3 z-20 w-68 overflow-hidden"
      style={{ width: 272 }}
    >
      <div
        className="bg-gray-950/98 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
        style={{
          border: `1px solid ${skill.color}45`,
          boxShadow: `0 0 40px ${skill.color}18, 0 12px 40px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Gradient header band */}
        <div className="relative px-4 py-3 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${skill.color}22, transparent)` }}
        >
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at top left, ${skill.color}14, transparent 70%)` }} />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="text-white font-bold text-sm leading-tight">{skill.name}</p>
              <p className="text-xs mt-0.5 font-semibold" style={{ color: skill.color }}>{tierLabel}</p>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-all flex-shrink-0 text-xs leading-none"
            >✕</button>
          </div>
          {/* Stage dots */}
          <div className="flex gap-1.5 mt-2.5">
            {[0,1,2,3,4].map((s) => (
              <div key={s}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  flex: 1,
                  backgroundColor: s <= skill.stage ? skill.color : '#1f2937',
                  opacity: s <= skill.stage ? 1 : 0.35,
                  boxShadow: s === skill.stage ? `0 0 6px ${skill.color}` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Course + Roadmap chips */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-1.5">
              <span className="text-sm">{course?.emoji || '📚'}</span>
              <span className="text-xs text-gray-300 truncate font-medium">{course?.name}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-800/30 rounded-xl px-3 py-1.5">
              <span className="text-sm">{roadmap?.emoji || '🗺️'}</span>
              <span className="text-xs text-gray-500 truncate">{roadmap?.name}</span>
            </div>
          </div>

          {/* Progress */}
          {totalMods > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Course Progress</span>
                <span className="text-[11px] font-bold" style={{ color: skill.color }}>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ backgroundColor: skill.color, boxShadow: `0 0 8px ${skill.color}80` }}
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">{doneMods} of {totalMods} modules done</p>
            </div>
          )}

          {skill.isCompleted && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}
            >
              <span>✅</span>
              <span className="text-xs text-emerald-400 font-semibold">Course completed!</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-map
// ─────────────────────────────────────────────────────────────────────────────
function MiniMap({ territories, zoom, panX, panY, viewW, viewH, onJump }) {
  const MM_W = 140, MM_H = 90
  const scaleX = MM_W / SCENE_W
  const scaleY = MM_H / SCENE_H

  const vpW = Math.min(MM_W, (viewW / zoom) * scaleX)
  const vpH = Math.min(MM_H, (viewH / zoom) * scaleY)
  const vpX = Math.max(0, Math.min(MM_W - vpW, (-panX / zoom) * scaleX))
  const vpY = Math.max(0, Math.min(MM_H - vpH, (-panY / zoom) * scaleY))

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = (e.clientX - rect.left) / MM_W * SCENE_W
    const sy = (e.clientY - rect.top) / MM_H * SCENE_H
    onJump(sx, sy)
  }

  return (
    <div
      className="absolute bottom-10 left-3 rounded-xl overflow-hidden cursor-crosshair"
      style={{
        width: MM_W, height: MM_H,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(4,8,10,0.92)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={handleClick}
      title="Mini-map — click to jump"
    >
      <svg width={MM_W} height={MM_H}>
        <rect width={MM_W} height={MM_H} fill="transparent" />
        {territories.map(({ rm, cx, cy, radius, palette }) => {
          const doneCourses = rm.courses.filter(c => c.completed).length
          const allDone = rm.courses.length > 0 && doneCourses === rm.courses.length
          const pts = hexPoints(cx * scaleX, cy * scaleY, radius * scaleX * 0.92, 15)
          return (
            <g key={rm.id}>
              <polygon points={pts} fill={palette.land}
                stroke={palette.accent} strokeWidth={allDone ? 1.0 : 0.5} opacity={0.90} />
              {allDone && (
                <polygon points={pts} fill="none"
                  stroke={palette.accent} strokeWidth={1.8} opacity={0.45}
                  style={{ filter: `blur(1px)` }} />
              )}
            </g>
          )
        })}
        {/* Viewport rect */}
        <rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.8" rx="2" />
      </svg>
      {/* Label */}
      <div className="absolute bottom-1 right-1.5 text-[8px] text-gray-600 font-mono pointer-events-none">MAP</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MindForest export
// ─────────────────────────────────────────────────────────────────────────────
export default function MindForest({ skills = [], onSkillClick }) {
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const wrapRef  = useRef(null)

  // Camera — single-object state so zoom+pan always update in one commit (one CSS transition trigger)
  const [cam, setCam] = useState({ zoom: 0.22, panX: 0, panY: 0 })
  const { zoom, panX, panY } = cam
  const setCamera = useCallback((z, px, py) =>
    setCam({ zoom: z, panX: px, panY: py }), [])

  const [dragging, setDragging] = useState(false)
  const dragRef    = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // UI state
  const [tooltip,       setTooltip]       = useState(null)
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 })
  const [selectedTree,  setSelectedTree]  = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedRoadmap, setSelectedRoadmap] = useState(null)
  const [viewSize,      setViewSize]      = useState({ w: 800, h: 420 })

  // Layout
  const territories = useMemo(() => layoutTerritories(roadmaps), [roadmaps])

  // Fit-to-view on mount
  useEffect(() => {
    const el = wrapRef.current
    if (!el || territories.length === 0) return
    const W = el.clientWidth || 800
    const H = el.clientHeight || 420
    setViewSize({ w: W, h: H })
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(W / SCENE_W, H / SCENE_H) * 0.85))
    setCamera(z, (W - SCENE_W * z) / 2, (H - SCENE_H * z) / 2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories.length])

  // Track container size
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      setViewSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Wheel zoom — reads current cam values from ref to avoid stale closure
  const camRef = useRef(cam)
  useEffect(() => { camRef.current = cam }, [cam])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const { zoom: pz, panX: px, panY: py } = camRef.current
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pz * factor))
    const ratio = nz / pz
    const rect = wrapRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setCamera(nz, mx * (1 - ratio) + px * ratio, my * (1 - ratio) + py * ratio)
  }, [setCamera])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Drag
  const onMouseDown = (e) => {
    if (e.button !== 0) return
    setDragging(true)
    dragRef.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY }
  }
  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const npx = dragRef.current.px + e.clientX - dragRef.current.mx
    const npy = dragRef.current.py + e.clientY - dragRef.current.my
    setCam((c) => ({ ...c, panX: npx, panY: npy }))
  }, [dragging])
  const onMouseUp = () => setDragging(false)

  // Zoom buttons
  const zoomBy = (f) => {
    const { zoom: pz, panX: px, panY: py } = camRef.current
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pz * f))
    const ratio = nz / pz
    const W = viewSize.w, H = viewSize.h
    setCamera(nz, W / 2 * (1 - ratio) + px * ratio, H / 2 * (1 - ratio) + py * ratio)
  }
  const fitAll = () => {
    const W = viewSize.w, H = viewSize.h
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(W / SCENE_W, H / SCENE_H) * 0.85))
    setCamera(z, (W - SCENE_W * z) / 2, (H - SCENE_H * z) / 2)
  }
  const jumpTo = (sx, sy) => {
    const { zoom: z } = camRef.current
    const W = viewSize.w, H = viewSize.h
    setCamera(z, W / 2 - sx * z, H / 2 - sy * z)
  }

  // Hover handlers
  const handleTreeHover = (skill, e) => {
    setTooltip({ ...skill, _type: 'tree' })
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }
  const handleLeave = () => setTooltip(null)

  const handleTreeClick = (skill) => {
    // Find owning course + roadmap
    const rm = roadmaps.find((r) => r.id === skill.roadmapId)
    const course = rm?.courses?.find((c) => c.id === skill.courseId)
    setSelectedTree(skill)
    setSelectedCourse(course ?? null)
    setSelectedRoadmap(rm ?? null)
    onSkillClick?.(skill)
  }

  const handleGroveClick = (course, roadmap) => {
    setTooltip({
      _type: 'grove',
      course,
      roadmap,
      totalMods: course.modules?.length ?? 0,
      doneMods: course.modules?.filter((m) => m.completedAt)?.length ?? 0,
      skillCount: (course.skills ?? []).length,
    })
    setTooltipPos({ x: viewSize.w / 2, y: 60 })
  }

  const totalTrees = territories.reduce((acc, t) =>
    acc + t.rm.courses.reduce((a, c) => a + (c.skills?.length ?? 0), 0), 0)
  const totalTerritories = territories.length
  const conqueredTerritories = territories.filter(({ rm }) =>
    rm.courses.length > 0 && rm.courses.every((c) => c.completed)
  ).length

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#04080a]"
         style={{ userSelect: 'none', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>

      {/* ── Premium header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(10,20,12,0.95), rgba(4,8,10,0.90))' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🌲</span>
          <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Knowledge World</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-gray-600">
          <span>🗺️ <span className="text-gray-400 font-semibold">{totalTerritories}</span> territories</span>
          <span>🌲 <span className="text-gray-400 font-semibold">{totalTrees}</span> skill trees</span>
          {conqueredTerritories > 0 && (
            <span className="text-emerald-500 font-semibold">✅ {conqueredTerritories} conquered</span>
          )}
        </div>
      </div>

      {/* ── Map viewport ──────────────────────────────────────────────────── */}
      <div
        ref={wrapRef}
        className={`relative overflow-hidden ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ height: 'clamp(320px, 48vw, 560px)' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg width="100%" height="100%"
          aria-label="Knowledge World Map — your skill forest"
        >
          <g style={{
            transform: `matrix(${zoom},0,0,${zoom},${panX},${panY})`,
            transformOrigin: '0px 0px',
            transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <WorldBackground />
            <WorldParticles />

            {/* Territory sea-lanes / roads between territories — animated dashed bezier */}
            {territories.map(({ cx, cy, palette }, i) => {
              if (i === 0) return null
              const prev = territories[i - 1]
              const d = organicPath(prev.cx, prev.cy, cx, cy, 0.15)
              const pathLen = Math.hypot(cx - prev.cx, cy - prev.cy) * 1.08
              return (
                <path key={i} d={d}
                  stroke={palette.border} strokeWidth="1.8"
                  strokeDasharray="12 9" fill="none" opacity="0.25"
                  strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset"
                    from={pathLen} to="0"
                    dur={`${8 + i * 3}s`} repeatCount="indefinite" />
                </path>
              )
            })}

            {/* Territories */}
            {territories.map((territory) => (
              <RoadmapTerritory
                key={territory.rm.id}
                territory={territory}
                onHover={handleTreeHover}
                onLeave={handleLeave}
                onTreeClick={handleTreeClick}
                onGroveClick={handleGroveClick}
                zoom={zoom}
              />
            ))}

            {/* World-level empty state */}
            {territories.length === 0 && (
              <text x={SCENE_W / 2} y={SCENE_H / 2}
                textAnchor="middle" fontSize="28"
                fill="rgba(148,163,184,0.25)" fontFamily="sans-serif">
                Create roadmaps to grow your knowledge world…
              </text>
            )}
          </g>
        </svg>

        {/* ── Zoom controls ───────────────────────────────────────────────── */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          <div className="flex flex-col rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,8,10,0.88)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          >
            {[
              { label: '+', fn: () => zoomBy(1.3), title: 'Zoom in' },
              { label: '−', fn: () => zoomBy(0.77), title: 'Zoom out' },
            ].map(({ label, fn, title }) => (
              <button key={label}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); fn() }}
                title={title}
                className="w-8 h-8 text-gray-300 hover:text-white hover:bg-white/10 flex items-center justify-center text-base font-light transition-all"
              >{label}</button>
            ))}
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); fitAll() }}
            title="Fit all territories"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm text-gray-400 hover:text-white transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,8,10,0.88)', backdropFilter: 'blur(12px)' }}
          >⌂</button>
        </div>

        {/* ── Mini-map ─────────────────────────────────────────────────────── */}
        {territories.length > 0 && (
          <MiniMap
            territories={territories}
            zoom={zoom} panX={panX} panY={panY}
            viewW={viewSize.w} viewH={viewSize.h}
            onJump={jumpTo}
          />
        )}

        {/* ── Zoom badge ───────────────────────────────────────────────────── */}
        <div
          className="absolute bottom-2 right-2 text-[9px] font-mono pointer-events-none px-2 py-0.5 rounded-md"
          style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        >
          {Math.round(zoom * 100)}% · drag · scroll
        </div>

        {/* ── Selected skill panel ─────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedTree && (
            <SkillPanel
              key={selectedTree.id}
              skill={selectedTree}
              course={selectedCourse}
              roadmap={selectedRoadmap}
              onClose={() => setSelectedTree(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-1 px-4 py-1.5 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'linear-gradient(0deg, rgba(4,8,10,0.98), rgba(8,14,10,0.90))' }}
      >
        {[
          { emoji: '🌫️', label: 'Unexplored', color: '#6b7280' },
          { emoji: '🌱', label: 'Sprouting',  color: '#cd7f32' },
          { emoji: '🌿', label: 'Growing',    color: '#94a3b8' },
          { emoji: '🌳', label: 'Mature',     color: '#f59e0b' },
          { emoji: '🌲', label: 'Ancient',    color: '#a78bfa' },
        ].map(({ emoji, label, color }, i) => (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-800 mx-1">·</span>}
            <span className="text-[10px] font-medium" style={{ color }}>
              {emoji} {label}
            </span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      <WorldTooltip data={tooltip} pos={tooltipPos} />
    </div>
  )
}
