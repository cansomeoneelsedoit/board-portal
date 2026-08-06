import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Calendar, MapPin, Video, FileText, Clock, Vote as VoteIcon,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtBytes, fmtDateTime, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, Field, PageHeader } from '../components/ui'

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
  const motions = meeting.motions || []
  const invitations = meeting.invitations || []
  const totalMinutes = agenda.reduce((sum, a) => sum + (a.duration || 0), 0)
  const documents = agenda.flatMap((a) => a.documents || [])

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
          <Card>
            <CardHeader title={`Invitations (${invitations.length})`} />
            {invitations.length === 0 ? (
              <DataState empty emptyLabel="Nobody invited yet" />
            ) : (
              <div className="p-4 space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3">
                    <Avatar name={inv.user?.name} initials={inv.user?.initials} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inv.user?.name || 'Unknown'}</p>
                      <p className="text-xs bp-muted">{humanise(inv.role)}</p>
                    </div>
                    <Badge status={inv.rsvp} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={`Motions (${motions.length})`} />
            {motions.length === 0 ? (
              <DataState empty emptyLabel="No motions tabled" />
            ) : (
              <div className="bp-divide">
                {motions.map((m) => {
                  const forVotes = (m.votes || []).filter((v) => v.vote === 'FOR').length
                  const against = (m.votes || []).filter((v) => v.vote === 'AGAINST').length
                  const abstain = (m.votes || []).filter((v) => v.vote === 'ABSTAIN').length
                  return (
                    <div key={m.id} className="p-4">
                      <div className="flex items-start gap-2">
                        <VoteIcon size={14} className="mt-1 bp-subtle shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{m.number}</p>
                          <p className="text-xs bp-muted mt-0.5">{m.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge status={m.status} />
                            {(m.votes || []).length > 0 && (
                              <span className="text-xs bp-muted">
                                {forVotes} for · {against} against · {abstain} abstain
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {documents.length > 0 && (
            <Card>
              <CardHeader title={`Papers (${documents.length})`} />
              <div className="p-4 space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="bp-subtle shrink-0" />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-xs bp-subtle">{fmtBytes(d.size)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
