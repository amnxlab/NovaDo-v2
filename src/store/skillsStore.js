/**
 * skillsStore — derives skill mastery from roadmapsStore.
 * This store does NOT persist state; it recomputes on demand.
 * All data comes from course.skills[] + course.completed status.
 */

import { create } from 'zustand'
import useRoadmapsStore from './roadmapsStore'

// ── Tier config ───────────────────────────────────────────────────────────────
export const SKILL_TIERS = {
  unexplored:   { label: 'Unexplored',   medal: null,       color: '#6b7280', glowColor: null,      treeStage: 0 },
  initiate:     { label: 'Initiate',     medal: 'bronze',   color: '#cd7f32', glowColor: '#cd7f32', treeStage: 1 },
  practitioner: { label: 'Practitioner', medal: 'silver',   color: '#94a3b8', glowColor: '#94a3b8', treeStage: 2 },
  master:       { label: 'Master',       medal: 'gold',     color: '#f59e0b', glowColor: '#f59e0b', treeStage: 3 },
  legend:       { label: 'Legend',       medal: 'diamond',  color: '#a78bfa', glowColor: '#c4b5fd', treeStage: 4 },
}

export function getTier(completedCourses, totalCourses) {
  if (totalCourses === 0 || completedCourses === 0) return 'unexplored'
  if (completedCourses >= totalCourses && completedCourses >= 5) return 'legend'
  if (completedCourses >= 3) return 'master'
  if (completedCourses >= 2) return 'practitioner'
  return 'initiate'
}

/**
 * Derive all skill mastery data from the current roadmaps.
 * Returns an array of skill objects sorted by treeStage desc, then name asc.
 */
export function deriveSkills(roadmaps) {
  // Map: skillName → { totalCourses, completedCourses, roadmapIds, courseNames, firstUnlockedAt }
  const map = {}

  for (const roadmap of roadmaps) {
    for (const course of roadmap.courses) {
      const skills = course.skills || []
      if (skills.length === 0) continue
      const isComplete = !!course.completed

      for (const rawSkill of skills) {
        const skill = rawSkill.trim()
        if (!skill) continue
        const key = skill.toLowerCase()
        if (!map[key]) {
          map[key] = {
            name: skill, // preserve original casing of first occurrence
            totalCourses: 0,
            completedCourses: 0,
            roadmapIds: new Set(),
            roadmapNames: {},
            firstUnlockedAt: null,
          }
        }
        map[key].totalCourses += 1
        if (isComplete) {
          map[key].completedCourses += 1
          // Track earliest completion
          const completedAt = course.modules.reduce((latest, m) => {
            if (!m.completedAt) return latest
            return !latest || m.completedAt > latest ? m.completedAt : latest
          }, null)
          if (completedAt && (!map[key].firstUnlockedAt || completedAt < map[key].firstUnlockedAt)) {
            map[key].firstUnlockedAt = completedAt
          }
        }
        map[key].roadmapIds.add(roadmap.id)
        map[key].roadmapNames[roadmap.id] = roadmap.name
      }
    }
  }

  return Object.values(map)
    .map((entry) => {
      const tier = getTier(entry.completedCourses, entry.totalCourses)
      const tierMeta = SKILL_TIERS[tier]
      return {
        name: entry.name,
        key: entry.name.toLowerCase(),
        totalCourses: entry.totalCourses,
        completedCourses: entry.completedCourses,
        pct: entry.totalCourses ? Math.round((entry.completedCourses / entry.totalCourses) * 100) : 0,
        tier,
        treeStage: tierMeta.treeStage,
        medal: tierMeta.medal,
        color: tierMeta.color,
        glowColor: tierMeta.glowColor,
        roadmapIds: [...entry.roadmapIds],
        roadmapNames: entry.roadmapNames,
        firstUnlockedAt: entry.firstUnlockedAt,
      }
    })
    .sort((a, b) => {
      if (b.treeStage !== a.treeStage) return b.treeStage - a.treeStage
      return a.name.localeCompare(b.name)
    })
}

/**
 * Generate dynamic achievement keys for a given skill+tier combo.
 * These are injected at runtime into the achievements system.
 */
export function makeDynamicAchievements(skills) {
  const achievements = {}
  for (const skill of skills) {
    if (skill.tier === 'unexplored') continue
    const tiers = ['initiate', 'practitioner', 'master', 'legend']
    const reachedIdx = tiers.indexOf(skill.tier)
    for (let i = 0; i <= reachedIdx; i++) {
      const t = tiers[i]
      const key = `skill_${t}_${skill.key}`
      achievements[key] = {
        label: `${skill.name} ${SKILL_TIERS[t].label}`,
        emoji: t === 'initiate' ? '🌱' : t === 'practitioner' ? '🌿' : t === 'master' ? '🌳' : '🌲',
        desc: `Completed enough courses to reach ${SKILL_TIERS[t].label} in ${skill.name}.`,
        category: 'learning',
        medal: SKILL_TIERS[t].medal || 'bronze',
        rarity: t === 'legend' ? 'legendary' : t === 'master' ? 'epic' : t === 'practitioner' ? 'rare' : 'common',
        xpBonus: t === 'legend' ? 500 : t === 'master' ? 200 : t === 'practitioner' ? 100 : 50,
        dynamic: true,
        skillName: skill.name,
        tier: t,
      }
    }
  }
  return achievements
}

// ── Lightweight reactive hook (recomputes from roadmapsStore) ─────────────────
const useSkillsStore = create(() => ({}))

export function useSkills() {
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  return deriveSkills(roadmaps)
}

export default useSkillsStore
