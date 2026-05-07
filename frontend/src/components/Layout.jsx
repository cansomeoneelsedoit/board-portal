import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, FileText, Vote, ClipboardList,
  Users, AlertTriangle, UserCheck, Settings, Building2, Bell, Search
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/meetings',    icon: Calendar,        label: 'Meetings'      },
  { to: '/documents',   icon: FileText,        label: 'Documents'     },
  { to: '/motions',     icon: Vote,            label: 'Motions'       },
  { to: '/minutes',     icon: ClipboardList,   label: 'Minutes'       },
  { to: '/attendance',  icon: Users,           label: 'Attendance'    },
  { to: '/coi',         icon: AlertTriangle,   label: 'COI Register'  },
  { to: '/proxies',     icon: UserCheck,       label: 'Proxies'       },
  { to: '/integrations',icon: Settings,        label: 'Integrations'  },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Board Portal</p>
              <p className="text-slate-400 text-xs">BOM INC</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
              A
            </div>
            <div>
              <p className="text-white text-sm font-medium">Admin</p>
              <p className="text-slate-400 text-xs">Board Secretary</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search meetings, documents, members..."
              className="flex-1 text-sm text-slate-600 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:text-slate-700">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
