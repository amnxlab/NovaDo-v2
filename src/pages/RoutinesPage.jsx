import { useOutletContext } from 'react-router-dom'
import RoutinesPanel from '../components/RoutinesPanel'

export default function RoutinesPage() {
  const { setRunningRoutine } = useOutletContext()

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Routines</h2>
        <p className="text-sm text-gray-500">Build habits with daily routines and streaks.</p>
      </div>
      <RoutinesPanel onStart={setRunningRoutine} expanded />
    </>
  )
}
