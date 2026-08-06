import { useMemo } from 'react'
import { Users, Video, MapPin, Check, X } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate } from '../lib/format'
import { Avatar, Card, CardHeader, DataState, PageHeader, StatTile } from '../components/ui'

export default function Attendance() {
  const { data, loading, error, refetch } = useApi(endpoints.attendance())
  const records = data || []

  // Group by meeting so each meeting reads as its own attendance sheet.
  const byMeeting = useMemo(() => {
    const map = new Map()
    records.forEach((r) => {
      const key = r.meeting?.id || 'unknown'
      if (!map.has(key)) map.set(key, { meeting: r.meeting, rows: [] })
      map.get(key).rows.push(r)
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.meeting?.date || 0) - new Date(a.meeting?.date || 0)
    )
  }, [records])

  const present = records.filter((r) => r.present).length
  const rate = records.length ? Math.round((present / records.length) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" subtitle="Presence and quorum across meetings" />

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && records.length === 0}
        emptyLabel="No attendance recorded"
        onRetry={refetch}
      />

      {!loading && !error && records.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Records" value={records.length} sub="Across all meetings" icon={Users} tone="info" />
            <StatTile label="Present" value={present} sub={`${records.length - present} absent`} icon={Check} tone="success" />
            <StatTile label="Attendance rate" value={`${rate}%`} sub="All-time" icon={Users} tone="primary" />
          </div>

          <div className="space-y-4">
            {byMeeting.map(({ meeting, rows }) => (
              <Card key={meeting?.id || 'unknown'}>
                <CardHeader
                  title={meeting?.title || 'Unknown meeting'}
                  action={
                    <span className="text-xs bp-muted">
                      {fmtDate(meeting?.date)} · {rows.filter((r) => r.present).length}/{rows.length} present
                    </span>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="bp-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Mode</th>
                        <th>Present</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="flex items-center gap-2.5">
                              <Avatar name={r.user?.name} initials={r.user?.initials} size={28} />
                              <span className="font-medium">{r.user?.name || 'Unknown'}</span>
                            </span>
                          </td>
                          <td className="bp-muted">
                            <span className="inline-flex items-center gap-1.5">
                              {r.mode === 'VIDEO' ? <Video size={13} /> : <MapPin size={13} />}
                              {r.mode === 'VIDEO' ? 'Video' : 'In person'}
                            </span>
                          </td>
                          <td>
                            {r.present ? (
                              <span className="bp-badge bp-badge--success"><Check size={11} className="mr-1" />Present</span>
                            ) : (
                              <span className="bp-badge bp-badge--danger"><X size={11} className="mr-1" />Apology</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
