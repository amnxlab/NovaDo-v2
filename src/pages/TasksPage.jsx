import { useOutletContext } from 'react-router-dom'
import TaskInput from '../components/TaskInput'
import TaskList from '../components/TaskList'
import TimelineDock from '../components/TimelineDock'
import useSettingsStore from '../store/settingsStore'

export default function TasksPage() {
  const { setRunningTask, setFocusTask, dailyWins } = useOutletContext()
  const { timelineDockVisible } = useSettingsStore()

  return (
    // pr-72 reserves space on the right so the fixed TimelineDock never overlaps tasks
    <div className={timelineDockVisible ? 'pr-72' : ''}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Tasks</h2>
        <p className="text-sm text-gray-500">Capture, organize, and crush your tasks.</p>
      </div>
      <TaskInput />
      <TaskList onRunTask={setRunningTask} onFocusTask={setFocusTask} dailyWins={dailyWins} />
      <TimelineDock />
    </div>
  )
}
