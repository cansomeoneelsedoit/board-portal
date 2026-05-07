import { Calendar, FileText, Vote, Users, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const stats = [
  { label: 'Upcoming Meetings', value: '3', icon: Calendar, color: 'bg-blue-500', change: 'Next: May 15' },
  { label: 'Active Documents', value: '24', icon: FileText, color: 'bg-emerald-500', change: '+3 this week' },
  { label: 'Open Motions', value: '7', icon: Vote, color: 'bg-purple-500', change: '2 pending vote' },
  { label: 'Board Members', value: '9', icon: Users, color: 'bg-amber-500', change: '9/9 active' },
]

const upcomingMeetings = [
  { id: 1, title: 'Board Meeting - Q2 Review', date: '2026-05-15', time: '10:00 AM', type: 'Board', status: 'confirmed' },
  { id: 2, title: 'Audit Committee', date: '2026-05-22', time: '2:00 PM', type: 'Committee', status: 'pending' },
  { id: 3, title: 'Special Resolution Meeting', date: '2026-06-01', time: '9:00 AM', type: 'Special', status: 'confirmed' },
]

const recentActivity = [
  { id: 1, action: 'Document uploaded', detail: 'Q1 Financial Report.pdf', time: '2h ago', icon: FileText, color: 'text-blue-500' },
  { id: 2, action: 'Motion passed', detail: 'Resolution 2026-04 approved (7-2)', time: '1d ago', icon: CheckCircle, color: 'text-emerald-500' },
  { id: 3, action: 'Meeting minutes approved', detail: 'March Board Meeting', time: '2d ago', icon: CheckCircle, color: 'text-emerald-500' },
  { id: 4, action: 'COI declaration submitted', detail: 'John Smith - Property Interest', time: '3d ago', icon: AlertCircle, color: 'text-amber-500' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back. Here's what's happening with BOM INC board.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                <p className="text-xs text-slate-400 mt-1">{change}</p>
              </div>
              <div className={`${color} p-2.5 rounded-lg`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Upcoming Meetings */}
        <div className="col-span-3 card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming Meetings</h2>
            <Link to="/meetings" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingMeetings.map(m => (
              <div key={m.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Calendar size={18} className="text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.date} at {m.time}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${m.type === 'Board' ? 'bg-blue-100 text-blue-700' : m.type === 'Committee' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.type}
                  </span>
                  <span className={`badge ${m.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-2 card">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="p-4 space-y-4">
            {recentActivity.map(a => (
              <div key={a.id} className="flex items-start gap-3">
                <a.icon size={16} className={`${a.color} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.action}</p>
                  <p className="text-xs text-slate-500">{a.detail}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock size={11} /> {a.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
