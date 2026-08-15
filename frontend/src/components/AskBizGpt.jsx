import { useEffect, useRef, useState } from 'react'
import { BrainCircuit, Loader2, Send, Sparkles, X } from 'lucide-react'
import api from '../lib/api'

/**
 * Ask me anything — powered by BizGPT.
 *
 * A chat window scoped to ONE meeting: every answer comes from this
 * meeting's record and the full text of its board pack. The conversation
 * lives in the window; closing it starts fresh.
 */
export default function AskBizGpt({ meeting, focusFile = null, compact = false }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const ask = async (e) => {
    e?.preventDefault()
    const question = draft.trim()
    if (!question || busy) return
    setDraft('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: question }])
    setBusy(true)
    try {
      const { data } = await api.post(`/pack/${meeting.id}/ask`, {
        question,
        history: messages.slice(-8),
        ...(focusFile ? { focusFile: { name: focusFile.name, itemId: focusFile.itemId || null } } : {}),
      })
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.answer,
        provider: data.providerLabel,
        fellBack: data.fellBack,
      }])
    } catch (ex) {
      setError(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bp-btn bp-btn-secondary"
        title={focusFile
          ? `Ask BizGPT about ${focusFile.name}`
          : 'Ask me anything about this meeting — answers come from the board pack itself'}
        style={{ color: '#e8622c', borderColor: '#e8622c' }}
      >
        <BrainCircuit size={15} /> {compact ? 'Ask' : 'Ask BizGPT'}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-[60] p-4 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div
            className="bp-card w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
            style={{ boxShadow: '0 20px 60px rgb(0 0 0 / 0.35)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e8622c' }}>
                <BrainCircuit size={18} color="#fff" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Ask me anything</p>
                <p className="text-xs bp-muted leading-tight truncate">
                  powered by <span style={{ color: '#e8622c', fontWeight: 600 }}>Biz</span><span className="font-semibold">GPT</span>
                  {focusFile ? <> · about <b>{focusFile.name}</b></> : ' · answers from this meeting’s pack'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="bp-subtle hover:text-[var(--bp-fg)] p-1.5" title="Close">
                <X size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--bp-neutral-bg)' }}>
              {messages.length === 0 && !busy && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                  <Sparkles size={22} style={{ color: '#e8622c' }} />
                  {focusFile ? (
                    <p className="text-sm bp-muted max-w-sm">
                      Ask about <b>{focusFile.name}</b> — &ldquo;Summarise this&rdquo;, &ldquo;What is being asked of the board?&rdquo;,
                      &ldquo;What are the key dates and figures?&rdquo;
                    </p>
                  ) : (
                    <p className="text-sm bp-muted max-w-sm">
                      Ask anything about <b>{meeting.title}</b> — &ldquo;What is the Pelligra loan status?&rdquo;,
                      &ldquo;Which papers arrived late?&rdquo;, &ldquo;Do we have quorum if Simon is an apology?&rdquo;
                    </p>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
                    style={m.role === 'user'
                      ? { background: 'var(--bp-primary)', color: '#fff' }
                      : { background: 'var(--bp-card-bg, #fff)', border: '1px solid var(--bp-card-border)' }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.provider && (
                    <span className="text-[11px] bp-subtle mt-1 px-1">
                      {m.fellBack ? '↪ answered by fallback: ' : 'answered by '}{m.provider}
                    </span>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 text-sm bp-muted inline-flex items-center gap-2"
                    style={{ background: 'var(--bp-card-bg, #fff)', border: '1px solid var(--bp-card-border)' }}>
                    <Loader2 size={14} className="animate-spin" /> Reading the pack…
                  </div>
                </div>
              )}
              {error && (
                <div className="text-sm px-1 space-y-1">
                  <p style={{ color: 'var(--bp-danger-fg)' }} className="whitespace-pre-wrap">{error}</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const last = [...messages].reverse().find((m) => m.role === 'user')
                        if (last) { setMessages((m) => m.slice(0, -1)); setDraft(last.content) }
                        setError(null)
                      }}
                      className="bp-link text-xs"
                    >
                      Try again
                    </button>
                    <a href={`${window.location.pathname.replace(/\/meetings\/.*$/, '')}/integrations`.replace('//', '/')}
                       className="bp-link text-xs">
                      Manage AI providers under Integrations →
                    </a>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={ask} className="p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask a question of the pack…"
                className="bp-input flex-1"
                disabled={busy}
              />
              <button type="submit" disabled={busy || !draft.trim()} className="bp-btn bp-btn-primary" title="Ask">
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
