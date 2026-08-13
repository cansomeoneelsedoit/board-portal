import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'
import Documents from './pages/Documents'
import Motions from './pages/Motions'
import Minutes from './pages/Minutes'
import Attendance from './pages/Attendance'
import COI from './pages/COI'
import Proxies from './pages/Proxies'
import Integrations from './pages/Integrations'
import Admin from './pages/Admin'
import Register from './pages/Register'
import MemberProfile from './pages/MemberProfile'

// Host verticals mount this app under a sub-path (e.g. /board-portal).
const basename =
  (typeof window !== 'undefined' && window.__BOARD_PORTAL__?.basename) || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/:id" element={<MeetingDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="motions" element={<Motions />} />
          <Route path="minutes" element={<Minutes />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="coi" element={<COI />} />
          <Route path="register" element={<Register />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="admin" element={<Admin />} />
          <Route path="people/:id" element={<MemberProfile />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
