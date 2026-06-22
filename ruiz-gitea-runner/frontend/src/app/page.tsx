'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Runner } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type Status = Runner['status']

/* ─── Gitea color palette ─── */
const G = {
  bg:       '#0d1117',
  surface:  '#161b22',
  elevated: '#21262d',
  border:   '#30363d',
  borderHi: '#484f58',
  text:     '#e6edf3',
  textSec:  '#8b949e',
  textMut:  '#6e7681',
  green:    '#609926',
  greenHi:  '#6aaa28',
}

const STATUS_THEME: Record<Status, {
  dot: string
  badgeBg: string; badgeText: string; badgeBorder: string
  borderLeft: string
}> = {
  running:     { dot: '#3fb950', badgeBg: 'rgba(63,185,80,.1)',   badgeText: '#3fb950', badgeBorder: 'rgba(63,185,80,.3)',   borderLeft: '#238636' },
  registered:  { dot: '#58a6ff', badgeBg: 'rgba(88,166,255,.1)',  badgeText: '#58a6ff', badgeBorder: 'rgba(88,166,255,.3)',  borderLeft: '#1f6feb' },
  registering: { dot: '#e3b341', badgeBg: 'rgba(227,179,65,.1)',  badgeText: '#e3b341', badgeBorder: 'rgba(227,179,65,.3)',  borderLeft: '#9e6a03' },
  pending:     { dot: '#6e7681', badgeBg: 'rgba(110,118,129,.08)', badgeText: '#6e7681', badgeBorder: 'rgba(110,118,129,.2)', borderLeft: '#30363d' },
  stopped:     { dot: '#6e7681', badgeBg: 'rgba(110,118,129,.08)', badgeText: '#6e7681', badgeBorder: 'rgba(110,118,129,.2)', borderLeft: '#30363d' },
  error:       { dot: '#f85149', badgeBg: 'rgba(248,81,73,.1)',   badgeText: '#f85149', badgeBorder: 'rgba(248,81,73,.3)',   borderLeft: '#da3633' },
}

/* ─── Gitea logo — the app's own icon ─── */
function GiteaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="22" fill="#609926" />
      <circle cx="50" cy="46" r="26" fill="white" opacity="0.95" />
      <polygon points="42,35 42,57 63,46" fill="#609926" />
      <circle cx="28" cy="76" r="4" fill="white" opacity="0.8" />
      <circle cx="50" cy="82" r="4" fill="white" opacity="0.8" />
      <circle cx="72" cy="76" r="4" fill="white" opacity="0.8" />
      <line x1="32" y1="76" x2="46" y2="82" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="54" y1="82" x2="68" y2="76" stroke="white" strokeWidth="2" opacity="0.6" />
    </svg>
  )
}

function StatusDot({ status }: { status: Status }) {
  const t = STATUS_THEME[status] ?? STATUS_THEME.stopped
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{
        background: t.dot,
        boxShadow: status === 'running' ? `0 0 6px ${t.dot}` : undefined,
        animation: status === 'registering' ? 'pulse 1.5s ease-in-out infinite' : undefined,
      }}
    />
  )
}

function StatusBadge({ status }: { status: Status }) {
  const t = STATUS_THEME[status] ?? STATUS_THEME.stopped
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: t.badgeBg, color: t.badgeText, border: `1px solid ${t.badgeBorder}` }}
    >
      {status === 'running' && (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {status === 'registering' && (
        <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {status === 'error' && (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {status}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: G.surface, border: `1px solid ${G.border}` }}
    >
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: G.textMut }}>{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [runners, setRunners] = useState<Runner[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLogs, setActiveLogs] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const loadRunners = useCallback(async () => {
    try {
      const data = await api.runners.list()
      setRunners(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    api.setup.status().then(s => {
      if (!s.configured) { router.replace('/setup'); return }
      loadRunners()
    })
    const interval = setInterval(loadRunners, 5000)
    return () => clearInterval(interval)
  }, [router, loadRunners])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  function openLogs(id: string) {
    esRef.current?.close()
    setLogs([])
    setActiveLogs(id)
    const es = new EventSource(`${BASE}/api/runners/${id}/logs`)
    esRef.current = es
    es.onmessage = evt => setLogs(prev => [...prev, evt.data])
    es.onerror = () => es.close()
  }

  function closeLogs() {
    esRef.current?.close()
    esRef.current = null
    setActiveLogs(null)
    setLogs([])
  }

  async function handleStart(id: string) {
    setActionLoading(id)
    try { await api.runners.start(id); await loadRunners() }
    finally { setActionLoading(null) }
  }

  async function handleStop(id: string) {
    setActionLoading(id)
    try { await api.runners.stop(id); await loadRunners() }
    finally { setActionLoading(null) }
  }

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }
    setDeleteConfirm(null)
    if (activeLogs === id) closeLogs()
    await api.runners.delete(id)
    setRunners(prev => prev.filter(r => r.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: G.bg }}>
        <div className="flex items-center gap-3" style={{ color: G.textMut }}>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  const runningCount = runners.filter(r => r.running).length
  const errorCount   = runners.filter(r => r.status === 'error').length
  const stoppedCount = runners.length - runningCount - errorCount

  return (
    <div className="min-h-screen" style={{ background: G.bg }}>

      {/* Top accent line */}
      <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${G.green}, transparent)` }} />

      {/* App header bar */}
      <header
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between"
        style={{ background: G.surface, borderBottom: `1px solid ${G.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <GiteaLogo size={22} />
          <span className="text-sm font-semibold" style={{ color: G.text }}>Gitea Runner</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRunners}
            title="Refresh"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: G.textMut }}
            onMouseEnter={e => { (e.currentTarget.style.background = G.elevated); (e.currentTarget.style.color = G.text) }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = G.textMut) }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>

          <button
            onClick={() => router.push('/runners/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white transition-all"
            style={{ background: G.green }}
            onMouseEnter={e => { (e.currentTarget.style.background = G.greenHi) }}
            onMouseLeave={e => { (e.currentTarget.style.background = G.green) }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Runner
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-7">

        {/* Stats */}
        {runners.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Total"   value={runners.length} color={G.text} />
            <StatCard label="Running" value={runningCount}   color="#3fb950" />
            <StatCard
              label={errorCount > 0 ? 'Errors' : 'Stopped'}
              value={errorCount > 0 ? errorCount : stoppedCount}
              color={errorCount > 0 ? '#f85149' : G.textMut}
            />
          </div>
        )}

        {/* Empty state */}
        {runners.length === 0 ? (
          <div className="text-center py-24">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-5"
              style={{ background: G.surface, border: `1px solid ${G.border}` }}
            >
              <GiteaLogo size={20} />
            </div>
            <p className="font-medium mb-1" style={{ color: G.textSec }}>No runners yet</p>
            <p className="text-sm mb-6" style={{ color: G.textMut }}>Add your first runner to execute Gitea Actions</p>
            <button
              onClick={() => router.push('/runners/new')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition-all"
              style={{ background: G.green }}
              onMouseEnter={e => { (e.currentTarget.style.background = G.greenHi) }}
              onMouseLeave={e => { (e.currentTarget.style.background = G.green) }}
            >
              Add your first runner
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {runners.map(runner => {
              const theme   = STATUS_THEME[runner.status] ?? STATUS_THEME.stopped
              const isActive   = activeLogs === runner.id
              const isDeleting = deleteConfirm === runner.id

              return (
                <div
                  key={runner.id}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{
                    background: G.surface,
                    border: `1px solid ${G.border}`,
                    borderLeft: `3px solid ${theme.borderLeft}`,
                  }}
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-4">

                      {/* Left: runner info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-1.5">
                          <StatusDot status={runner.status} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: G.text }}>{runner.name}</span>
                            <StatusBadge status={runner.status} />
                          </div>
                          <p className="text-xs font-mono mt-1 truncate" style={{ color: G.textMut }}>{runner.gitea_url}</p>
                          {runner.labels && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {runner.labels.split(',').slice(0, 3).map((l, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                                  style={{ background: G.elevated, color: G.textMut, border: `1px solid ${G.border}` }}
                                >
                                  {l.split(':')[0]}
                                </span>
                              ))}
                              {runner.labels.split(',').length > 3 && (
                                <span className="text-xs" style={{ color: G.textMut }}>
                                  +{runner.labels.split(',').length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {runner.status === 'error' && runner.error && (
                            <p
                              className="text-xs mt-2 px-2.5 py-1.5 rounded-lg"
                              style={{ color: '#f85149', background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)' }}
                            >
                              {runner.error}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: action buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {runner.running ? (
                          <button
                            onClick={() => handleStop(runner.id)}
                            disabled={actionLoading === runner.id}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all disabled:opacity-40"
                            style={{ background: G.elevated, color: G.textSec, border: `1px solid ${G.border}` }}
                            onMouseEnter={e => { (e.currentTarget.style.borderColor = G.borderHi) }}
                            onMouseLeave={e => { (e.currentTarget.style.borderColor = G.border) }}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="6" width="12" height="12" rx="1.5" />
                            </svg>
                            Stop
                          </button>
                        ) : (
                          runner.status !== 'pending' && runner.status !== 'registering' && (
                            <button
                              onClick={() => handleStart(runner.id)}
                              disabled={actionLoading === runner.id}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all disabled:opacity-40"
                              style={{
                                background: 'rgba(96,153,38,.15)',
                                color: '#6aaa28',
                                border: '1px solid rgba(96,153,38,.3)',
                              }}
                              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(96,153,38,.25)') }}
                              onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(96,153,38,.15)') }}
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Start
                            </button>
                          )
                        )}

                        {runner.running && (
                          <button
                            onClick={() => isActive ? closeLogs() : openLogs(runner.id)}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all"
                            style={isActive
                              ? { background: 'rgba(88,166,255,.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,.25)' }
                              : { background: G.elevated, color: G.textMut, border: `1px solid ${G.border}` }
                            }
                            onMouseEnter={e => {
                              if (!isActive) (e.currentTarget.style.borderColor = G.borderHi)
                            }}
                            onMouseLeave={e => {
                              if (!isActive) (e.currentTarget.style.borderColor = G.border)
                            }}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="4 17 10 11 4 5" />
                              <line x1="12" y1="19" x2="20" y2="19" />
                            </svg>
                            {isActive ? 'Hide' : 'Logs'}
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(runner.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md transition-all"
                          style={isDeleting
                            ? { background: 'rgba(248,81,73,.15)', color: '#f85149', border: '1px solid rgba(248,81,73,.3)' }
                            : { background: G.elevated, color: G.textMut, border: `1px solid ${G.border}` }
                          }
                          onMouseEnter={e => {
                            if (!isDeleting) e.currentTarget.style.color = '#f85149'
                          }}
                          onMouseLeave={e => {
                            if (!isDeleting) e.currentTarget.style.color = G.textMut
                          }}
                        >
                          {isDeleting ? 'Confirm?' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logs panel */}
                  {isActive && (
                    <div style={{ borderTop: `1px solid ${G.border}` }}>
                      {/* Terminal titlebar */}
                      <div
                        className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: G.bg }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(248,81,73,.5)' }} />
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(227,179,65,.5)' }} />
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(63,185,80,.5)' }} />
                          </div>
                          <span className="text-xs font-mono" style={{ color: G.textMut }}>{runner.name}</span>
                        </div>
                        <button
                          onClick={closeLogs}
                          className="transition-colors"
                          style={{ color: G.textMut }}
                          onMouseEnter={e => { (e.currentTarget.style.color = G.textSec) }}
                          onMouseLeave={e => { (e.currentTarget.style.color = G.textMut) }}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>

                      {/* Log output */}
                      <div
                        className="h-60 overflow-y-auto p-4 font-mono text-xs leading-5"
                        style={{ background: '#010409', color: G.textSec }}
                      >
                        {logs.length === 0 ? (
                          <span className="flex items-center gap-2" style={{ color: G.textMut }}>
                            <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse" style={{ background: G.textMut }} />
                            Waiting for output…
                          </span>
                        ) : (
                          logs.map((line, i) => (
                            <div
                              key={i}
                              className="flex gap-3 group -mx-2 px-2 rounded hover:bg-white/[0.025]"
                            >
                              <span
                                className="select-none w-7 text-right flex-shrink-0 transition-colors"
                                style={{ color: G.textMut }}
                              >
                                {i + 1}
                              </span>
                              <span className="whitespace-pre-wrap break-all flex-1">{line}</span>
                            </div>
                          ))
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {deleteConfirm && (
        <div className="fixed inset-0" onClick={() => setDeleteConfirm(null)} />
      )}
    </div>
  )
}
