import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, FileText, Vote, ClipboardList,
  Users, AlertTriangle, UserCheck, Settings, ChevronsUpDown,
  Search, PanelLeft, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'
import SkinToggle from './SkinToggle'
import { Avatar } from './ui'

/**
 * Mason-View / HotelView styled shell.
 *
 * Mirrors the host product's structure so the module reads as native once
 * embedded: entity switcher at the top of a light sidebar, ⌘K search affordance,
 * grouped nav, and a 4rem header carrying a breadcrumb + user menu.
 *
 * The original design is untouched in Layout.jsx and reachable at any time via
 * the palette toggle or ?skin=classic.
 */

const navGroups = [
  {
    label: 'Governance',
    items: [
      { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/meetings',   icon: Calendar,        label: 'Meetings' },
      { to: '/documents',  icon: FileText,        label: 'Board Packs' },
    ],
  },
  {
    label: 'Proceedings',
    items: [
      { to: '/motions',    icon: Vote,            label: 'Motions' },
      { to: '/minutes',    icon: ClipboardList,   label: 'Minutes' },
      { to: '/attendance', icon: Users,           label: 'Attendance' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/coi',        icon: AlertTriangle,   label: 'COI Register' },
      { to: '/proxies',    icon: UserCheck,       label: 'Proxies' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/integrations', icon: Settings,      label: 'Integrations' },
    ],
  },
]

const allItems = navGroups.flatMap((g) => g.items)

function useBreadcrumb() {
  const { pathname } = useLocation()
  if (pathname === '/') return [{ label: 'Dashboard' }]
  const match = allItems.find((i) => i.to !== '/' && pathname.startsWith(i.to))
  const crumbs = [{ label: 'Board Portal', to: '/' }]
  if (match) crumbs.push({ label: match.label, to: match.to })
  // Detail routes (/meetings/:id) get a third crumb.
  if (match && pathname !== match.to) crumbs.push({ label: 'Detail' })
  return crumbs
}

export default function LayoutMasonsView() {
  const [collapsed, setCollapsed] = useState(false)
  const crumbs = useBreadcrumb()

  return (
    <div className="flex h-screen" style={{ background: 'var(--bp-bg)' }}>
      <aside
        className={clsx('bp-sidebar flex flex-col shrink-0 transition-[width] duration-200')}
        style={{ width: collapsed ? '4rem' : 'var(--bp-sidebar-width)' }}
      >
        {/* Entity switcher — the host product's TeamSwitcher slot */}
        <div className="p-2">
          <button
            className="w-full flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-[var(--bp-sidebar-accent)]"
            title="AFAM Incorporated"
          >
            <span
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: 'var(--bp-primary)', color: 'var(--bp-primary-fg)' }}
            >
              BP
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold truncate">AFAM Incorporated</span>
                  <span className="block text-xs bp-muted truncate">Board of Management</span>
                </span>
                <ChevronsUpDown size={14} className="bp-subtle shrink-0" />
              </>
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="px-2 pb-2">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm bp-muted transition-colors hover:bg-[var(--bp-sidebar-accent)]"
              style={{ borderColor: 'var(--bp-sidebar-border)' }}>
              <Search size={14} />
              <span className="flex-1 text-left">Search…</span>
              <kbd
                className="text-[10px] px-1.5 py-0.5 rounded border font-sans"
                style={{ borderColor: 'var(--bp-sidebar-border)' }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider bp-subtle">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      clsx('bp-sidebar-item', isActive && 'bp-sidebar-item--active', collapsed && 'justify-center')
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2" style={{ borderTop: '1px solid var(--bp-sidebar-border)' }}>
          <button className={clsx(
            'w-full flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-[var(--bp-sidebar-accent)]',
            collapsed && 'justify-center'
          )}>
            <Avatar name="Boyd Sparrow" initials="BS" size={32} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium truncate">Boyd Sparrow</span>
                  <span className="block text-xs bp-muted truncate">Chair</span>
                </span>
                <ChevronsUpDown size={14} className="bp-subtle shrink-0" />
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="flex shrink-0 items-center justify-between gap-2 px-6"
          style={{
            height: 'var(--bp-header-height)',
            background: 'var(--bp-header-bg)',
            borderBottom: '1px solid var(--bp-header-border)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded-md bp-muted transition-colors hover:bg-[var(--bp-neutral-bg)]"
              title="Toggle sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <nav className="flex items-center gap-1 text-sm min-w-0">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight size={14} className="bp-subtle shrink-0" />}
                  {c.to && i < crumbs.length - 1 ? (
                    <Link to={c.to} className="bp-muted hover:text-[var(--bp-fg)] truncate">{c.label}</Link>
                  ) : (
                    <span className="font-medium truncate">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SkinToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
