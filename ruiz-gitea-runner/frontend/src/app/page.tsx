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
      <div className="flex items-center justify-center min-h-screen" style={{ background: G.bg }}>
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
  const errorCount = runners.filter(r => r.status === 'error').length
  const stoppedCount = runners.length - runningCount - errorCount

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #05080d 0%, #0c1320 45%, #0d1117 100%)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-72 overflow-hidden pointer-events-none">
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-[#5d9d2f]/20 blur-3xl" />
        <div className="absolute right-16 top-24 h-56 w-56 rounded-full bg-[#4a7bff]/15 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,153,38,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(88,166,255,0.12),_transparent_30%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#609926]/10 ring-1 ring-[#609926]/20">
                  <GiteaLogo size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#6e7681]">Gitea Runner</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Manage your Gitea action runners</h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#b7c5d4]">
                Monitor runner health, start/stop instances, and view live logs from a polished dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={loadRunners}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#c9d1d9] transition hover:border-white/20 hover:bg-white/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => router.push('/runners/new')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#609926] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#6aaa28]"
              >
                <span className="text-lg">+</span>
                Add Runner
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total runners" value={runners.length} color={G.text} />
            <StatCard label="Running" value={runningCount} color="#3fb950" />
            <StatCard
              label={errorCount > 0 ? 'Errors' : 'Stopped'}
              value={errorCount > 0 ? errorCount : stoppedCount}
              color={errorCount > 0 ? '#f85149' : G.textMut}
            />
          </div>
        </header>

        <main className="mt-6 space-y-6">
          {runners.length === 0 ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-12 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#609926]/10 ring-1 ring-[#609926]/20">
                <GiteaLogo size={28} />
              </div>
              <p className="text-xl font-semibold text-white">No runners connected yet</p>
              <p className="mt-3 text-sm text-[#b7c5d4]">Register a runner to begin executing your Gitea Actions workflows.</p>
              <button
                onClick={() => router.push('/runners/new')}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#609926] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6aaa28]"
              >
                Add your first runner
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {runners.map(runner => {
                const theme = STATUS_THEME[runner.status] ?? STATUS_THEME.stopped
                const isActive = activeLogs === runner.id
                const isDeleting = deleteConfirm === runner.id
                const labels = runner.labels?.split(',').filter(Boolean) ?? []

                return (
                  <div
                    key={runner.id}
                    className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-[0_20px_70px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl"
                  >
                    <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="mt-1.5">
                            <StatusDot status={runner.status} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold text-white">{runner.name}</p>
                              <StatusBadge status={runner.status} />
                            </div>
                            <p className="mt-2 truncate text-sm font-mono text-[#9fa8b3]">{runner.gitea_url}</p>
                            {labels.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {labels.slice(0, 4).map((label, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-[#c9d1d9]"
                                  >
                                    {label.split(':')[0]}
                                  </span>
                                ))}
                                {labels.length > 4 && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#8b949e]">
                                    +{labels.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {runner.running ? (
                            <button
                              onClick={() => handleStop(runner.id)}
                              disabled={actionLoading === runner.id}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#10151d] px-4 py-2 text-sm font-medium text-[#c9d1d9] transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span className="h-3.5 w-3.5 rounded-sm bg-[#f85149]" />
                              Stop
                            </button>
                          ) : (
                            runner.status !== 'pending' && runner.status !== 'registering' && (
                              <button
                                onClick={() => handleStart(runner.id)}
                                disabled={actionLoading === runner.id}
                                className="inline-flex items-center gap-2 rounded-2xl border border-[#60a126]/30 bg-[#609926]/10 px-4 py-2 text-sm font-medium text-[#6aaa28] transition hover:bg-[#609926]/15 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span className="h-3.5 w-3.5 rounded-full bg-[#6aaa28]" />
                                Start
                              </button>
                            )
                          )}
                          {runner.running && (
                            <button
                              onClick={() => (isActive ? closeLogs() : openLogs(runner.id))}
                              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${isActive ? 'border border-[#58a6ff]/35 bg-[#58a6ff]/10 text-[#68a5ff]' : 'border border-white/10 bg-[#10151d] text-[#c9d1d9] hover:border-white/20'}`}
                            >
                              <span className="h-3.5 w-3.5 rounded-full bg-[#58a6ff]" />
                              {isActive ? 'Hide Logs' : 'View Logs'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(runner.id)}
                            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${isDeleting ? 'border border-[#f85149]/35 bg-[#f85149]/10 text-[#f85149]' : 'border border-white/10 bg-[#10151d] text-[#c9d1d9] hover:border-[#f85149]/40 hover:text-[#f85149]'}`}
                          >
                            {isDeleting ? 'Confirm remove' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="border-t border-white/10">
                        <div className="flex items-center justify-between gap-3 bg-[#070a0f] px-5 py-3 text-sm text-[#8b949e]">
                          <div className="flex items-center gap-3">
                            <span className="flex h-2.5 w-2.5 rounded-full bg-[#f85149]/70" />
                            <span className="flex h-2.5 w-2.5 rounded-full bg-[#e3b341]/70" />
                            <span className="flex h-2.5 w-2.5 rounded-full bg-[#3fb950]/70" />
                            <span className="font-mono">{runner.name} logs</span>
                          </div>
                          <button onClick={closeLogs} className="text-xs uppercase tracking-[0.2em] text-[#8b949e] transition hover:text-white">
                            CLOSE
                          </button>
                        </div>
                        <div className="h-60 overflow-y-auto bg-[#02050b] p-4 font-mono text-xs leading-5 text-[#c9d1d9]">
                          {logs.length === 0 ? (
                            <div className="flex items-center gap-2 text-[#8b949e]">
                              <span className="inline-block h-3 w-1.5 rounded-full animate-pulse bg-[#6e7681]" />
                              Waiting for output…
                            </div>
                          ) : (
                            logs.map((line, idx) => (
                              <div key={idx} className="flex gap-3 rounded-xl px-3 py-1 transition hover:bg-white/5">
                                <span className="w-8 text-right text-[#8b949e]">{idx + 1}</span>
                                <span className="whitespace-pre-wrap break-all">{line}</span>
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
        </main>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white">Confirm runner removal</p>
            <p className="mt-3 text-sm leading-6 text-[#b7c5d4]">
              This action will remove the runner from the dashboard and stop live log streaming. Continue only if you want to permanently remove it.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-2xl border border-white/10 bg-[#10151d] px-4 py-3 text-sm font-medium text-[#c9d1d9] transition hover:border-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="rounded-2xl bg-[#f85149] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6c6c]"
              >
                Remove runner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
