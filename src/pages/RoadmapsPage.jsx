import { useOutletContext } from 'react-router-dom'
import RoadmapsPanel from '../components/RoadmapsPanel'

export default function RoadmapsPage() {
  const { setRunningModule } = useOutletContext()

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Roadmaps</h2>
        <p className="text-sm text-gray-500">Plan and track your learning paths.</p>
      </div>
      <RoadmapsPanel onStartModule={setRunningModule} expanded />
    </>
  )
}
