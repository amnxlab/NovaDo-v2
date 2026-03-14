/**
 * MindForest — SVG forest visualization of skill mastery.
 * Each skill is procedurally placed as a tree based on its tier:
 *   Stage 0: fog/mist patch  (unexplored)
 *   Stage 1: sapling          (initiate)
 *   Stage 2: young tree       (practitioner)
 *   Stage 3: full tree        (master)
 *   Stage 4: ancient glowing  (legend)
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

// ── Deterministic hash for stable x-positions ────────────────────────────────
function strHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Map skill key → x position (0–100 pct of scene width)
function skillX(key, index, total) {
  const hash = strHash(key)
  // Spread evenly with jitter from hash
  const base = (index / Math.max(total - 1, 1)) * 80 + 10
  const jitter = ((hash % 100) / 100 - 0.5) * (80 / Math.max(total, 1))
  return Math.max(4, Math.min(96, base + jitter))
}

// ── Tree shape components ────────────────────────────────────────────────────

function FogPatch({ cx, baseY, skill, onHover, onLeave, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(skill)}
    >
      <ellipse cx={cx} cy={baseY - 8} rx={14} ry={7} fill="rgba(148,163,184,0.12)" style={{ filter: 'blur(4px)' }} />
      <ellipse cx={cx - 5} cy={baseY - 4} rx={9} ry={4} fill="rgba(148,163,184,0.08)" style={{ filter: 'blur(3px)' }} />
      <ellipse cx={cx + 6} cy={baseY - 6} rx={10} ry={5} fill="rgba(148,163,184,0.10)" style={{ filter: 'blur(4px)' }} />
      {/* Subtle question mark */}
      <text x={cx} y={baseY - 6} textAnchor="middle" fontSize="7" fill="rgba(148,163,184,0.3)" fontFamily="sans-serif">?</text>
    </g>
  )
}

function Sapling({ cx, baseY, color, skill, onHover, onLeave, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(skill)}
    >
      {/* Stem */}
      <line x1={cx} y1={baseY} x2={cx} y2={baseY - 14} stroke="#6b5c3e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Two small leaves */}
      <ellipse cx={cx - 4} cy={baseY - 14} rx={4} ry={2.5} fill={color} opacity="0.85" transform={`rotate(-30,${cx - 4},${baseY - 14})`} />
      <ellipse cx={cx + 4} cy={baseY - 16} rx={4} ry={2.5} fill={color} opacity="0.85" transform={`rotate(30,${cx + 4},${baseY - 16})`} />
      <ellipse cx={cx} cy={baseY - 18} rx={3.5} ry={2} fill={color} opacity="0.9" />
    </g>
  )
}

function YoungTree({ cx, baseY, color, skill, onHover, onLeave, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(skill)}
    >
      {/* Trunk */}
      <rect x={cx - 1.5} y={baseY - 24} width={3} height={24} rx={1.5} fill="#7a6148" />
      {/* Branches */}
      <line x1={cx} y1={baseY - 18} x2={cx - 8} y2={baseY - 22} stroke="#7a6148" strokeWidth="1.2" />
      <line x1={cx} y1={baseY - 18} x2={cx + 7} y2={baseY - 21} stroke="#7a6148" strokeWidth="1.2" />
      {/* Canopy layers */}
      <ellipse cx={cx - 7} cy={baseY - 23} rx={6} ry={4} fill={color} opacity="0.8" />
      <ellipse cx={cx + 6} cy={baseY - 22} rx={5.5} ry={3.5} fill={color} opacity="0.8" />
      <ellipse cx={cx} cy={baseY - 30} rx={8} ry={5} fill={color} opacity="0.9" />
    </g>
  )
}

function FullTree({ cx, baseY, color, skill, onHover, onLeave, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(skill)}
    >
      {/* Trunk */}
      <rect x={cx - 2.5} y={baseY - 36} width={5} height={36} rx={2} fill="#6b5040" />
      {/* Branches */}
      <line x1={cx} y1={baseY - 24} x2={cx - 12} y2={baseY - 30} stroke="#6b5040" strokeWidth="1.5" />
      <line x1={cx} y1={baseY - 24} x2={cx + 11} y2={baseY - 29} stroke="#6b5040" strokeWidth="1.5" />
      <line x1={cx} y1={baseY - 30} x2={cx - 7} y2={baseY - 36} stroke="#6b5040" strokeWidth="1.2" />
      {/* Canopy */}
      <ellipse cx={cx - 11} cy={baseY - 31} rx={8} ry={5.5} fill={color} opacity="0.75" />
      <ellipse cx={cx + 10} cy={baseY - 30} rx={7.5} ry={5} fill={color} opacity="0.75" />
      <ellipse cx={cx - 5} cy={baseY - 38} rx={9} ry={6} fill={color} opacity="0.85" />
      <ellipse cx={cx + 4} cy={baseY - 40} rx={8} ry={5.5} fill={color} opacity="0.85" />
      <ellipse cx={cx} cy={baseY - 46} rx={10} ry={7} fill={color} opacity="0.95" />
    </g>
  )
}

function AncientTree({ cx, baseY, color, glowColor, skill, onHover, onLeave, onClick }) {
  return (
    <g
      className="cursor-pointer"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(skill)}
    >
      {/* Glow aura */}
      <ellipse cx={cx} cy={baseY - 32} rx={20} ry={28} fill={glowColor} opacity="0.06" style={{ filter: 'blur(8px)' }} />
      {/* Trunk */}
      <rect x={cx - 3.5} y={baseY - 52} width={7} height={52} rx={3.5} fill="#5c3e28" />
      {/* Roots */}
      <line x1={cx} y1={baseY} x2={cx - 8} y2={baseY + 3} stroke="#5c3e28" strokeWidth="2" strokeLinecap="round" />
      <line x1={cx} y1={baseY} x2={cx + 7} y2={baseY + 3} stroke="#5c3e28" strokeWidth="2" strokeLinecap="round" />
      {/* Branches */}
      <line x1={cx} y1={baseY - 32} x2={cx - 16} y2={baseY - 40} stroke="#5c3e28" strokeWidth="2" />
      <line x1={cx} y1={baseY - 32} x2={cx + 15} y2={baseY - 38} stroke="#5c3e28" strokeWidth="2" />
      <line x1={cx} y1={baseY - 42} x2={cx - 10} y2={baseY - 50} stroke="#5c3e28" strokeWidth="1.5" />
      <line x1={cx} y1={baseY - 42} x2={cx + 9} y2={baseY - 49} stroke="#5c3e28" strokeWidth="1.5" />
      {/* Canopy layers */}
      <ellipse cx={cx - 14} cy={baseY - 41} rx={10} ry={7} fill={color} opacity="0.7" />
      <ellipse cx={cx + 13} cy={baseY - 39} rx={10} ry={7} fill={color} opacity="0.7" />
      <ellipse cx={cx - 8} cy={baseY - 51} rx={11} ry={7.5} fill={color} opacity="0.8" />
      <ellipse cx={cx + 7} cy={baseY - 50} rx={11} ry={7.5} fill={color} opacity="0.8" />
      <ellipse cx={cx} cy={baseY - 60} rx={13} ry={9} fill={color} opacity="0.9" />
      <ellipse cx={cx} cy={baseY - 67} rx={9} ry={6} fill={color} opacity="1" />
      {/* Glowing crown */}
      <ellipse cx={cx} cy={baseY - 67} rx={9} ry={6} fill={glowColor} opacity="0.3" style={{ filter: 'blur(3px)' }} />
      {/* Firefly particles */}
      {[[-5, -58], [8, -48], [-10, -44], [12, -62], [3, -70]].map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx} cy={baseY + dy} r={1.2} fill={glowColor} opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur={`${1.4 + i * 0.4}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" values={`0,0;${i % 2 === 0 ? 2 : -2},-3;0,0`} dur={`${1.8 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function ForestTooltip({ skill, pos }) {
  if (!skill) return null
  const TIER_LABELS = { unexplored: '🌫️ Unexplored', initiate: '🌱 Initiate', practitioner: '🌿 Practitioner', master: '🌳 Master', legend: '🌲 Legend' }
  const roadmapList = Object.values(skill.roadmapNames || {}).join(', ')
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed z-[200] pointer-events-none"
      style={{ left: pos.x + 12, top: pos.y - 10 }}
    >
      <div className="bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 shadow-2xl min-w-[160px]">
        <p className="text-white text-sm font-bold">{skill.name}</p>
        <p className="text-xs mt-0.5" style={{ color: skill.color }}>{TIER_LABELS[skill.tier]}</p>
        <p className="text-xs text-gray-400 mt-1">{skill.completedCourses}/{skill.totalCourses} courses</p>
        {roadmapList && <p className="text-[10px] text-gray-600 mt-0.5 max-w-[180px] truncate">📍 {roadmapList}</p>}
      </div>
    </motion.div>
  )
}

// ── Main MindForest ──────────────────────────────────────────────────────────
const SCENE_W = 860
const SCENE_H = 200
const GROUND_Y = 160

export default function MindForest({ skills = [], onSkillClick }) {
  const [hoveredSkill, setHoveredSkill] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const trees = useMemo(() => {
    // Filter to skills that actually appear (total courses > 0)
    const visible = skills.filter((s) => s.totalCourses > 0)
    return visible.map((skill, i) => ({
      ...skill,
      cx: (skillX(skill.key, i, visible.length) / 100) * SCENE_W,
    }))
  }, [skills])

  const handleHover = (skill, e) => {
    setHoveredSkill(skill)
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }
  const handleLeave = () => setHoveredSkill(null)
  const handleClick = (skill) => onSkillClick?.(skill)

  const emptyForest = trees.length === 0

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-700/50 bg-[#0a0e1a]">
      <svg
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        className="w-full"
        style={{ height: 'clamp(140px, 22vw, 220px)' }}
        aria-label="Mind Forest — your skill landscape"
      >
        <defs>
          {/* Sky gradient */}
          <linearGradient id="mf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f0c29" />
            <stop offset="100%" stopColor="#1a1040" />
          </linearGradient>
          {/* Ground gradient */}
          <linearGradient id="mf-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2e1a" />
            <stop offset="100%" stopColor="#0d1a0d" />
          </linearGradient>
          {/* Moon glow */}
          <radialGradient id="mf-moon">
            <stop offset="0%" stopColor="#e8e8ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8080ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect width={SCENE_W} height={SCENE_H} fill="url(#mf-sky)" />

        {/* Stars */}
        {Array.from({ length: 30 }, (_, i) => {
          const sx = ((strHash(`star-${i}`) % 1000) / 1000) * SCENE_W
          const sy = ((strHash(`star-y-${i}`) % 1000) / 1000) * (GROUND_Y - 20)
          const sr = ((strHash(`star-r-${i}`) % 10) / 10) * 0.8 + 0.3
          return <circle key={i} cx={sx} cy={sy} r={sr} fill="white" opacity={0.3 + sr * 0.4} />
        })}

        {/* Moon */}
        <circle cx={SCENE_W * 0.88} cy={28} r={18} fill="url(#mf-moon)" />
        <circle cx={SCENE_W * 0.88} cy={28} r={12} fill="#d4d4f8" opacity="0.18" />

        {/* Far hills */}
        <path
          d={`M0 ${GROUND_Y + 10} Q${SCENE_W * 0.15} ${GROUND_Y - 20} ${SCENE_W * 0.3} ${GROUND_Y + 5} Q${SCENE_W * 0.45} ${GROUND_Y + 20} ${SCENE_W * 0.6} ${GROUND_Y - 15} Q${SCENE_W * 0.75} ${GROUND_Y - 30} ${SCENE_W * 0.9} ${GROUND_Y} L${SCENE_W} ${GROUND_Y} L${SCENE_W} ${SCENE_H} L0 ${SCENE_H} Z`}
          fill="#111d11"
          opacity="0.7"
        />

        {/* Ground */}
        <rect x={0} y={GROUND_Y} width={SCENE_W} height={SCENE_H - GROUND_Y} fill="url(#mf-ground)" />

        {/* Grass line */}
        <path
          d={`M0 ${GROUND_Y} Q${SCENE_W * 0.25} ${GROUND_Y - 4} ${SCENE_W * 0.5} ${GROUND_Y} Q${SCENE_W * 0.75} ${GROUND_Y + 4} ${SCENE_W} ${GROUND_Y}`}
          fill="none"
          stroke="#2a4a2a"
          strokeWidth="1.5"
        />

        {/* Trees */}
        {trees.map((skill) => {
          const props = {
            cx: skill.cx,
            baseY: GROUND_Y,
            color: skill.color,
            glowColor: skill.glowColor,
            skill,
            onHover: handleHover,
            onLeave: handleLeave,
            onClick: handleClick,
          }
          if (skill.treeStage === 0) return <FogPatch key={skill.key} {...props} />
          if (skill.treeStage === 1) return <Sapling key={skill.key} {...props} />
          if (skill.treeStage === 2) return <YoungTree key={skill.key} {...props} />
          if (skill.treeStage === 3) return <FullTree key={skill.key} {...props} />
          return <AncientTree key={skill.key} {...props} />
        })}

        {/* Empty state overlay */}
        {emptyForest && (
          <text x={SCENE_W / 2} y={GROUND_Y - 10} textAnchor="middle" fontSize="11" fill="rgba(148,163,184,0.35)" fontFamily="sans-serif">
            Tag skills on your courses to grow this forest…
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-800 flex-wrap">
        {[
          { stage: 0, label: '🌫️ Unexplored', color: '#6b7280' },
          { stage: 1, label: '🌱 Initiate', color: '#cd7f32' },
          { stage: 2, label: '🌿 Practitioner', color: '#94a3b8' },
          { stage: 3, label: '🌳 Master', color: '#f59e0b' },
          { stage: 4, label: '🌲 Legend', color: '#a78bfa' },
        ].map(({ label, color }) => (
          <span key={label} className="text-[10px] font-medium" style={{ color }}>{label}</span>
        ))}
        <span className="ml-auto text-[10px] text-gray-600">{trees.length} skill{trees.length !== 1 ? 's' : ''} mapped</span>
      </div>

      {/* Tooltip */}
      {hoveredSkill && <ForestTooltip skill={hoveredSkill} pos={tooltipPos} />}
    </div>
  )
}
