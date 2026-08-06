import { Calendar, FileText, Vote, Users, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate, fmtDateTime, fmtRelative } from '../lib/format'
import { Badge, Card, CardHeader, DataState, PageHeader, StatTile } from '../components/ui'

const activityIcon = {
  DOCUMENT_UPLOADED: { icon: FileText,    tone: 'info' },
  MOTION_CARRIED:    { icon: CheckCircle, tone: 'success' },
  MOTION_LOST:       { icon: XCircle,     tone: 'danger' },
  MINUTES_APPROVED:  { icon: CheckCircle, tone: 'success' },
  COI_DECLARED:      { icon: AlertCircle, tone: 'warning' },
}

export default function Dashboard() {
  const { data, loading, error, refetch } = useApi(endpoints.dashboard())

  const state = <DataState loading={loading} error={error} onRetry={refetch} />
  if (loading || error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Board of Management — governance overview" />
        {state}
      </div>
    )
  }

  const { stats, upcomingMeetings = [], activity = [] } = data || {}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Board of Management — governance overview"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Upcoming Meetings"
          value={stats.upcomingMeetings}
          sub={stats.nextMeetingDate ? `Next: ${fmtDate(stats.nextMeetingDate)}` : 'None scheduled'}
          icon={Calendar}
          tone="info"
        />
        <StatTile
          label="Documents"
          value={stats.documents}
          sub="Across all board packs"
          icon={FileText}
          tone="success"
        />
        <StatTile
          label="Open Motions"
          value={stats.openMotions}
          sub={`${stats.motionsPendingVote} pending vote`}
          icon={Vote}
          tone="primary"
        />
        <StatTile
          label="Board Members"
          value={stats.boardMembers}
          sub="Active appointments"
          icon={Users}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Upcoming Meetings"
            action={<Link to="/meetings" className="bp-link text-sm">View all</Link>}
          />
          {upcomingMeetings.length === 0 ? (
            <DataState empty emptyLabel="No meetings scheduled" />
          ) : (
            <div className="bp-divide">
              {upcomingMeetings.map((m) => (
                <Link
                  key={m.id}
                  to={`/meetings/${m.id}`}
                  className="p-4 flex items-center gap-4 transition-colors hover:bg-[var(--bp-neutral-bg)]"
                >
                  <span className="bp-chip bp-chip--primary w-10 h-10 shrink-0">
                    <Calendar size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    <p className="text-xs bp-subtle mt-0.5">{fmtDateTime(m.date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={m.status} />
                    <span className="text-xs bp-muted hidden sm:inline">
                      {m.invitations?.length ?? 0} invited
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent Activity" />
          {activity.length === 0 ? (
            <DataState empty emptyLabel="No recent activity" />
          ) : (
            <div className="p-4 space-y-4">
              {activity.map((a) => {
                const cfg = activityIcon[a.kind] || { icon: Clock, tone: 'neutral' }
                const Icon = cfg.icon
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <span className={`bp-chip bp-chip--${cfg.tone} w-7 h-7 shrink-0`}>
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.action}</p>
                      <p className="text-xs bp-muted break-words">{a.detail}</p>
                      <p className="text-xs bp-subtle mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {fmtRelative(a.at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
