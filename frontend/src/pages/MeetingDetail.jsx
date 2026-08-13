import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Calendar, MapPin, Video, FileText, Clock,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtBytes, fmtDateTime, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, Field, PageHeader } from '../components/ui'
import MeetingTabs from '../components/MeetingTabs'
import MeetingInvitations from '../components/MeetingInvitations'

export default function MeetingDetail() {
  const { id } = useParams()
  const { data: meeting, loading, error, refetch } = useApi(endpoints.meeting(id))

  if (loading || error || !meeting) {
    return (
      <div className="space-y-6">
        <Link to="/meetings" className="bp-link text-sm inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to meetings
        </Link>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && !meeting}
          emptyLabel="Meeting not found"
          onRetry={refetch}
        />
      </div>
    )
  }

  const agenda = meeting.agendaItems || []
  const invitations = meeting.invitations || []
  const totalMinutes = agenda.reduce((sum, a) => sum + (a.duration || 0), 0)

  return (
    <div className="space-y-6">
      <Link to="/meetings" className="bp-link text-sm inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Back to meetings
      </Link>

      <PageHeader
        title={meeting.title}
        subtitle={meeting.board?.name}
        actions={<Badge status={meeting.status} />}
      />

      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date & time">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} /> {fmtDateTime(meeting.date)}
            </span>
          </Field>
          <Field label="Location">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} /> {meeting.location || '—'}
            </span>
          </Field>
          <Field label="Video">
            {meeting.videoUrl ? (
              <a href={meeting.videoUrl} target="_blank" rel="noreferrer"
                 className="bp-link inline-flex items-center gap-1.5">
                <Video size={14} /> Join link
              </a>
            ) : '—'}
          </Field>
          <Field label="Scheduled duration">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> {totalMinutes} min
            </span>
          </Field>
        </div>
      </Card>

      {/* Everything about this meeting lives here — the pack, who attended,
          what was declared, what was resolved. These used to be separate
          top-level registers, which made one meeting read as six unrelated
          lists. */}
      <MeetingTabs meeting={meeting} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`Agenda (${agenda.length})`} />
          {agenda.length === 0 ? (
            <DataState empty emptyLabel="No agenda items" />
          ) : (
            <div className="bp-divide">
              {agenda.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="bp-chip bp-chip--primary w-8 h-8 shrink-0 text-xs font-semibold">
                      {item.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs bp-muted mt-0.5">
                        {item.presenter || 'No presenter'}
                        {item.duration ? ` · ${item.duration} min` : ''}
                      </p>
                      {item.notes && <p className="text-xs bp-muted mt-1">{item.notes}</p>}

                      {(item.documents || []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.documents.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 text-xs bp-muted">
                              <FileText size={12} className="shrink-0" />
                              <span className="truncate">{d.name}</span>
                              <span className="bp-subtle">{fmtBytes(d.size)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <MeetingInvitations meetingId={meeting.id} />

        </div>
      </div>
    </div>
  )
}
