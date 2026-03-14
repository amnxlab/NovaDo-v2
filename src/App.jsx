import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import TasksPage from './pages/TasksPage'
import RoutinesPage from './pages/RoutinesPage'
import RoadmapsPage from './pages/RoadmapsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TasksPage /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'roadmaps', element: <RoadmapsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

