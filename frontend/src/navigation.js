import {
  LayoutDashboard, Calendar, FileText, Vote, ClipboardList,
  Users, AlertTriangle, UserCheck, Settings,
} from 'lucide-react'

/**
 * Navigation for the Mason-View skin.
 *
 * Grouped the way the host product groups sidebar sections, and kept in its own
 * module so the port to a vertical becomes a direct translation into
 * modules/BoardPortal/resources/js/navigation/board.ts — same labels, same
 * icons, same grouping, only `to` becomes a Wayfinder route helper.
 *
 * The classic skin keeps its own flat nav inside Layout.jsx so the original
 * design stays byte-for-byte revertible.
 */
export const navGroups = [
  {
    label: 'Governance',
    items: [
      { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/meetings',  icon: Calendar,        label: 'Meetings' },
      { to: '/documents', icon: FileText,        label: 'Board Packs' },
    ],
  },
  {
    label: 'Proceedings',
    items: [
      { to: '/motions',    icon: Vote,          label: 'Motions' },
      { to: '/minutes',    icon: ClipboardList, label: 'Minutes' },
      { to: '/attendance', icon: Users,         label: 'Attendance' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/coi',     icon: AlertTriangle, label: 'COI Register' },
      { to: '/proxies', icon: UserCheck,     label: 'Proxies' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/integrations', icon: Settings, label: 'Integrations' },
    ],
  },
]

export const allNavItems = navGroups.flatMap((g) => g.items)
