import { useEffect } from 'react'
import useRoadmapsStore, { allocatedMins } from '../store/roadmapsStore'
import useTasksStore from '../store/tasksStore'
import { getTodayDateKey } from '../utils/localDate'

/**
 * Automatically creates a medium-priority task for every roadmap module
 * that is scheduled for today AND belongs to a roadmap with autoInjectTasks enabled.
 *
 * Runs on mount and whenever roadmaps change (e.g. after reschedule).
 * Idempotent — skips modules that already have a taskId pointing to a live task.
 */
export default function useRoadmapTaskInjector() {
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const roadmapsHydrated = useRoadmapsStore((s) => s._hasHydrated)
  const updateModule = useRoadmapsStore((s) => s.updateModule)
  const addTask = useTasksStore((s) => s.addTask)
  const tasks = useTasksStore((s) => s.tasks)
  const tasksHydrated = useTasksStore((s) => s._hasHydrated)

  useEffect(() => {
    if (!roadmapsHydrated || !tasksHydrated) return

    const today = getTodayDateKey()

    for (const roadmap of roadmaps) {
      if (!roadmap.autoInjectTasks) continue

      for (const course of roadmap.courses) {
        for (const module of course.modules) {
          if (module.scheduledDate !== today) continue
          if (module.completedAt) continue

          const generatedTaskText = `📚 ${module.title} — ${course.name}`
          const expectedPriority = roadmap.priority || 'medium'

          const existingTask = tasks.find((task) => {
            if (task.completedAt) return false
            if (module.taskId && task.id === module.taskId) return true

            return (
              task.text === generatedTaskText &&
              task.dueDate === today &&
              task.priority === expectedPriority &&
              (task.tags ?? []).includes('roadmap') &&
              (task.tags ?? []).includes(roadmap.name)
            )
          })

          if (existingTask) {
            if (module.taskId !== existingTask.id) {
              updateModule(roadmap.id, course.id, module.id, { taskId: existingTask.id })
            }
            continue
          }

          // Create the task — store the allocated study time (not raw video minutes)
          // so TaskRunner uses the same duration the roadmap displays.
          const taskId = addTask(
            generatedTaskText,
            {
              priority: expectedPriority,
              dueDate: today,
              tags: ['roadmap', roadmap.name],
              durationMins: module.durationMins
                ? allocatedMins(module, course, roadmap)
                : null,
            }
          )

          // Link the task back to the module
          if (taskId) {
            updateModule(roadmap.id, course.id, module.id, { taskId })
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmaps, roadmapsHydrated, tasksHydrated, addTask, updateModule])
}
