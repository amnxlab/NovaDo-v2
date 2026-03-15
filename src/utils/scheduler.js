import { allocatedMins, resolveMode } from '../store/roadmapsStore'
import { compareDateKeys, diffCalendarDays, getDateKeyFromDate, parseDateKey } from './localDate'

/**
 * Topological sort of modules with prerequisite support.
 * Returns the sorted list or throws if a cycle is detected.
 */
function topoSort(nodes, getPrereqs) {
  const visited = new Set()
  const result = []

  const visit = (node, ancestors = new Set()) => {
    if (ancestors.has(node.id)) return // cycle — skip gracefully
    if (visited.has(node.id)) return
    ancestors.add(node.id)
    for (const prereqId of getPrereqs(node)) {
      const prereqNode = nodes.find((n) => n.id === prereqId)
      if (prereqNode) visit(prereqNode, new Set(ancestors))
    }
    visited.add(node.id)
    result.push(node)
  }

  for (const node of nodes) visit(node)
  return result
}

/**
 * Compute a schedule for all roadmaps.
 *
 * @param {Array}  roadmaps   — full array from roadmapsStore
 * @param {string} startDate  — 'YYYY-MM-DD', defaults to today
 * @param {number} globalCapMins — optional hard cap across ALL roadmaps per day (0 = no global cap)
 * @returns {{ assignments: Array, conflicts: Array }}
 *   assignments: [{ roadmapId, courseId, moduleId, scheduledDate }]
 *   conflicts:   [{ roadmapId, courseId, moduleId, title, deadline, scheduledDate, message }]
 */
export function computeSchedule(roadmaps, startDate = null, globalCapMins = 0) {
  const start = startDate ? (parseDateKey(startDate) ?? new Date(startDate)) : new Date()
  start.setHours(0, 0, 0, 0)

  const dateKey = (d) => getDateKeyFromDate(d)
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

  // dailyUsed: Map<'YYYY-MM-DD', number> — total mins scheduled that day across all roadmaps
  const dailyUsed = new Map()
  const dailyUsedPerRoadmap = new Map() // Map<roadmapId, Map<date, mins>>

  const getUsed = (date) => dailyUsed.get(date) || 0
  const getRoadmapUsed = (rid, date) => (dailyUsedPerRoadmap.get(rid) || new Map()).get(date) || 0

  const scheduleMinutes = (rid, date, mins) => {
    dailyUsed.set(date, getUsed(date) + mins)
    if (!dailyUsedPerRoadmap.has(rid)) dailyUsedPerRoadmap.set(rid, new Map())
    const m = dailyUsedPerRoadmap.get(rid)
    m.set(date, (m.get(date) || 0) + mins)
  }

  const assignments = []
  const conflicts = []

  // Process roadmaps — nearest deadline first
  const sortedRoadmaps = [...roadmaps].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return compareDateKeys(a.deadline, b.deadline)
  })

  for (const roadmap of sortedRoadmaps) {
    const roadmapCap = roadmap.dailyCapMins || 120

    // Flatten all incomplete modules across courses, respecting course prerequisites
    // Step 1: sort courses by prerequisite chain
    const sortedCourses = topoSort(
      roadmap.courses.filter((c) => !c.completed),
      (c) => c.prerequisiteCourseIds || []
    )

    // Step 2: for each course, sort modules by prerequisite chain
    const unlockedModuleQueue = []
    const completedModuleIds = new Set(
      roadmap.courses.flatMap((c) => c.modules.filter((m) => m.completedAt).map((m) => m.id))
    )

    for (const course of sortedCourses) {
      const incompleteModules = course.modules.filter((m) => !m.completedAt)
      const sorted = topoSort(
        incompleteModules,
        (m) => (m.prerequisiteModuleIds || []).filter((pid) => !completedModuleIds.has(pid))
      )

      for (const mod of sorted) {
        unlockedModuleQueue.push({ module: mod, course, roadmap })
      }
    }

    // Step 3: compute effective daily cap — auto-raise it when a deadline exists and
    // the user's configured cap isn't enough to finish on time.
    let effectiveDailyCap = roadmapCap
    if (roadmap.deadline && unlockedModuleQueue.length > 0) {
      const deadlineDate = parseDateKey(roadmap.deadline)
      const availableDays = Math.max(1, diffCalendarDays(deadlineDate, start) + 1)
      const totalMins = unlockedModuleQueue.reduce(
        (sum, { module: m, course: c }) => sum + allocatedMins(m, c, roadmap),
        0
      )
      const requiredDailyMins = Math.ceil(totalMins / availableDays)
      effectiveDailyCap = Math.max(roadmapCap, requiredDailyMins)
    }

    // Step 4: assign dates
    let cursor = new Date(start)
    let pathLastDate = null // track the latest scheduled date across all modules in this roadmap

    for (const { module: mod, course } of unlockedModuleQueue) {
      const mins = allocatedMins(mod, course, roadmap)

      // Find next day that has capacity.
      // Soft-cap rule: a module that is larger than the effective daily cap is still allowed
      // on a day where nothing else for this roadmap has been scheduled yet
      // (it gets the day to itself). This prevents oversized modules from causing
      // the cursor to drift years into the future.
      let attempts = 0
      let scheduled = false
      while (attempts < 730) {
        const dk = dateKey(cursor)

        const roadmapUsedToday = getRoadmapUsed(roadmap.id, dk)
        const globalUsedToday = getUsed(dk)

        const roadmapHasSpace =
          roadmapUsedToday + mins <= effectiveDailyCap || // normal fit
          roadmapUsedToday === 0                          // soft-cap: oversized gets its own day

        const globalHasSpace = globalCapMins <= 0 || globalUsedToday + mins <= globalCapMins

        if (roadmapHasSpace && globalHasSpace) {
          scheduleMinutes(roadmap.id, dk, mins)
          assignments.push({
            roadmapId: roadmap.id,
            courseId: course.id,
            moduleId: mod.id,
            scheduledDate: dk,
          })
          if (!pathLastDate || dk > pathLastDate) pathLastDate = dk

          // Per-course deadline check: only fires when the course has its OWN explicit deadline.
          // The roadmap (path) deadline is checked once at path level below — it must NOT be
          // applied per-course, because the path deadline is for the entire sequence to finish,
          // not a constraint on any individual course.
          if (course.deadline && dk > course.deadline) {
            conflicts.push({
              type: 'course',
              roadmapId: roadmap.id,
              courseId: course.id,
              moduleId: mod.id,
              title: mod.title,
              courseName: course.name,
              roadmapName: roadmap.name,
              deadline: course.deadline,
              scheduledDate: dk,
              message: `"${mod.title}" in ${course.name} can't fit before the course deadline ${course.deadline} — scheduled ${dk}`,
            })
          }
          scheduled = true
          break
        }

        cursor = addDays(cursor, 1)
        attempts++
      }

      // Safety fallback: if still unscheduled (e.g. global cap is very tight),
      // force it on the current cursor day so the cursor doesn't drift further.
      if (!scheduled) {
        const dk = dateKey(cursor)
        scheduleMinutes(roadmap.id, dk, mins)
        assignments.push({
          roadmapId: roadmap.id,
          courseId: course.id,
          moduleId: mod.id,
          scheduledDate: dk,
        })
        if (!pathLastDate || dk > pathLastDate) pathLastDate = dk

        if (course.deadline && dk > course.deadline) {
          conflicts.push({
            type: 'course',
            roadmapId: roadmap.id,
            courseId: course.id,
            moduleId: mod.id,
            title: mod.title,
            courseName: course.name,
            roadmapName: roadmap.name,
            deadline: course.deadline,
            scheduledDate: dk,
            message: `"${mod.title}" in ${course.name} can't fit before the course deadline ${course.deadline} — scheduled ${dk}`,
          })
        }
      }
    }

    // Path-level deadline check: one consolidated conflict if the entire roadmap
    // won't complete before its deadline. This is separate from per-course deadlines.
    // (This can only still happen when a single module's allocated time exceeds an entire
    // day's worth of effective cap — i.e. physically impossible to schedule sooner.)
    if (roadmap.deadline && pathLastDate && pathLastDate > roadmap.deadline) {
      conflicts.push({
        type: 'path',
        roadmapId: roadmap.id,
        courseId: null,
        moduleId: null,
        title: roadmap.name,
        courseName: null,
        roadmapName: roadmap.name,
        deadline: roadmap.deadline,
        scheduledDate: pathLastDate,
        message: `Path "${roadmap.name}" can't finish by ${roadmap.deadline} — some modules are too large to fit. Last module falls on ${pathLastDate}. Try increasing the daily cap or extending the deadline.`,
      })
    }
  }

  return { assignments, conflicts }
}
