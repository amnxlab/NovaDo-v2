import { useEffect } from 'react'
import useRoadmapsStore, { allocatedMins } from '../store/roadmapsStore'
import useTasksStore from '../store/tasksStore'

/**
 * Automatically creates a medium-priority task for every roadmap module
 * that is scheduled for today AND belongs to a roadmap with autoInjectTasks enabled.
 *
 * Runs on mount and whenever roadmaps change (e.g. after reschedule).
 * Idempotent — skips modules that already have a taskId pointing to a live task.
 */
export default function useRoadmapTaskInjector() {
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const updateModule = useRoadmapsStore((s) => s.updateModule)
  const addTask = useTasksStore((s) => s.addTask)
  const tasks = useTasksStore((s) => s.tasks)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)

    for (const roadmap of roadmaps) {
      if (!roadmap.autoInjectTasks) continue

      for (const course of roadmap.courses) {
        for (const module of course.modules) {
          if (module.scheduledDate !== today) continue
          if (module.completedAt) continue

          // Check if the existing taskId still points to a live task
          const existingTask = module.taskId
            ? tasks.find((t) => t.id === module.taskId && !t.completedAt)
            : null

          if (existingTask) continue // already has an active task

          // Create the task — store the allocated study time (not raw video minutes)
          // so TaskRunner uses the same duration the roadmap displays.
          const taskId = addTask(
            `📚 ${module.title} — ${course.name}`,
            {
              priority: roadmap.priority || 'medium',
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
    // tasks is intentionally excluded from deps to avoid infinite loop
    // (adding a task mutates tasks, which would re-trigger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmaps, addTask, updateModule])
}
