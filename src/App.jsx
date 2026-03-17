import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import TasksPage from './pages/TasksPage'
import RoutinesPage from './pages/RoutinesPage'
import RoadmapsPage from './pages/RoadmapsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import AchievementsPage from './pages/AchievementsPage'
import useAuthStore from './store/authStore'
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
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  const { user, _hasHydrated: authHydrated, setAuth, setHasHydrated } = useAuthStore()
  // Track whether we have finished the cookie-resume check
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    // If authStore already has a user (from sessionStorage), skip the check.
    if (!authHydrated) return
    if (user) { setSessionChecked(true); return }

    // No user in sessionStorage — check if the browser has a valid auth cookie
    // by calling /api/auth/me. If it succeeds, restore the session silently.
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const userData = await res.json()
          setAuth(userData)
        }
      })
      .catch(() => { /* server unreachable — show login page */ })
      .finally(() => {
        setSessionChecked(true)
      })
  }, [authHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for both the store to hydrate and the session check to complete
  if (!authHydrated || !sessionChecked) return null

  if (!user) return <AuthPage />

  return <RouterProvider router={router} />
}
