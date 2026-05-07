import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/:id" element={<MeetingDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="motions" element={<Motions />} />
          <Route path="minutes" element={<Minutes />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="coi" element={<COI />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
