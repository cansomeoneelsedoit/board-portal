import {
  LayoutDashboard, Calendar, FolderOpen, Settings, ShieldCheck, ShieldAlert,
} from 'lucide-react'

/**
 * Navigation for the Mason-View skin.
 *
 * Deliberately shallow. The board's real structure is: a library of meetings,
 * and inside a meeting everything about that meeting — papers, attendance,
 * conflicts, motions, minutes. Those were once top-level pages, which made the
 * portal read as six unrelated registers instead of one board. They now live
 * inside the meeting, where the SharePoint folders put them.
 *
 * `admin: true` items are only shown to a board administrator. This is
 * presentation only — the server enforces the same rule.
 */
export const navGroups = [
  {
    label: 'Board',
    items: [
      { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/meetings',  icon: Calendar,        label: 'Meetings' },
      { to: '/register',  icon: ShieldAlert,    label: 'Register of Interests' },
    ],
  },
  {
    label: 'Administration',
    admin: true,
    items: [
      { to: '/admin',        icon: ShieldCheck, label: 'Board Settings', admin: true },
      { to: '/integrations', icon: Settings,    label: 'Integrations', admin: true },
    ],
  },
]

export const allNavItems = navGroups.flatMap((g) => g.items)

/** Groups this role should see. */
export const navGroupsFor = (isAdmin) =>
  navGroups
    .filter((g) => !g.admin || isAdmin)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.admin || isAdmin) }))
    .filter((g) => g.items.length > 0)
