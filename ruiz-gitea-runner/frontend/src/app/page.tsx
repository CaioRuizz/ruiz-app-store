'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Runner } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type Status = Runner['status']

const STATUS_THEME: Record<Status, { dot: string; badge: string; border: string }> = {
  running:     { dot: 'bg-emerald-400',              badge: 'text-emerald-300 bg-emerald-950/70 ring-1 ring-emerald-700/50', border: 'border-l-emerald-500' },
  registered:  { dot: 'bg-sky-400',                  badge: 'text-sky-300 bg-sky-950/70 ring-1 ring-sky-700/50',             border: 'border-l-sky-500' },
  registering: { dot: 'bg-amber-400 animate-pulse',  badge: 'text-amber-300 bg-amber-950/70 ring-1 ring-amber-700/50',       border: 'border-l-amber-500' },
  pending:     { dot: 'bg-gray-600',                 badge: 'text-gray-400 bg-gray-800/60 ring-1 ring-gray-700/40',           border: 'border-l-gray-700' },
  stopped:     { dot: 'bg-gray-600',                 badge: 'text-gray-400 bg-gray-800/60 ring-1 ring-gray-700/40',           border: 'border-l-gray-700' },
  error:       { dot: 'bg-red-500',                  badge: 'text-red-300 bg-red-950/70 ring-1 ring-red-700/50',              border: 'border-l-red-500' },
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'running') return (
    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
  if (status === 'registering') return (
    <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
  if (status === 'error') return (
    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  )
  return null
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
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
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
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
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-gray-500">
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
    <div className="min-h-screen">
      <div className="h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-sky-500/0" />

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Gitea Runner</h1>
            <p className="text-xs text-gray-600 mt-0.5">Self-hosted Actions runner manager</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadRunners}
              title="Refresh"
              className="p-2 text-gray-600 hover:text-gray-300 hover:bg-gray-800/60 rounded-lg transition-all"
            >
              <RefreshIcon />
            </button>
            <button
              onClick={() => router.push('/runners/new')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-emerald-900/40"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Runner
            </button>
          </div>
        </div>

        {/* Stats */}
        {runners.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Total" value={runners.length} accent="text-white" />
            <StatCard label="Running" value={runningCount} accent="text-emerald-400" />
            <StatCard
              label={errorCount > 0 ? 'Errors' : 'Stopped'}
              value={errorCount > 0 ? errorCount : stoppedCount}
              accent={errorCount > 0 ? 'text-red-400' : 'text-gray-500'}
            />
          </div>
        )}

        {/* Empty state */}
        {runners.length === 0 ? (
          <div className="text-center py-28">
            <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <p className="font-medium text-gray-400 mb-1">No runners yet</p>
            <p className="text-sm text-gray-600 mb-6">Add your first runner to execute Gitea Actions</p>
            <button
              onClick={() => router.push('/runners/new')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              Add your first runner
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {runners.map(runner => {
              const theme = STATUS_THEME[runner.status] ?? STATUS_THEME.stopped
              const isActive = activeLogs === runner.id
              const isDeleting = deleteConfirm === runner.id

              return (
                <div
                  key={runner.id}
                  className={`bg-gray-900/70 border border-gray-800/50 border-l-4 ${theme.border} rounded-xl overflow-hidden transition-all`}
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${theme.dot}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm">{runner.name}</span>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>
                              <StatusIcon status={runner.status} />
                              {runner.status}
                            </span>
                          </div>
                          <p className="text-gray-600 text-xs font-mono mt-1 truncate">{runner.gitea_url}</p>
                          {runner.labels && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {runner.labels.split(',').slice(0, 3).map((l, i) => (
                                <span key={i} className="text-xs bg-gray-800/80 text-gray-500 px-1.5 py-0.5 rounded-md font-mono border border-gray-700/40">
                                  {l.split(':')[0]}
                                </span>
                              ))}
                              {runner.labels.split(',').length > 3 && (
                                <span className="text-xs text-gray-700">+{runner.labels.split(',').length - 3}</span>
                              )}
                            </div>
                          )}
                          {runner.status === 'error' && runner.error && (
                            <p className="text-red-400 text-xs mt-2 bg-red-950/30 border border-red-900/30 rounded-lg px-2.5 py-1.5">
                              {runner.error}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {runner.running ? (
                          <button
                            onClick={() => handleStop(runner.id)}
                            disabled={actionLoading === runner.id}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-lg transition-all disabled:opacity-40 border border-gray-700/40"
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
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 rounded-lg transition-all disabled:opacity-40 border border-emerald-800/40"
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
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all border ${
                              isActive
                                ? 'bg-sky-900/50 text-sky-300 border-sky-800/40'
                                : 'bg-gray-800/80 hover:bg-gray-700 text-gray-400 border-gray-700/40'
                            }`}
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
                          className={`text-xs px-2.5 py-1.5 rounded-lg transition-all border ${
                            isDeleting
                              ? 'bg-red-900/60 text-red-200 border-red-700/50 hover:bg-red-800/60'
                              : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-600 hover:text-red-400 border-gray-700/40'
                          }`}
                        >
                          {isDeleting ? 'Confirm?' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Log panel */}
                  {isActive && (
                    <div className="border-t border-gray-800/50">
                      <div className="bg-gray-950/90 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                          </div>
                          <span className="text-xs text-gray-600 font-mono">{runner.name}</span>
                        </div>
                        <button onClick={closeLogs} className="text-gray-700 hover:text-gray-400 transition-colors">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                      <div className="h-64 overflow-y-auto bg-gray-950/60 p-4 font-mono text-xs text-gray-400 leading-5">
                        {logs.length === 0 ? (
                          <span className="text-gray-700 flex items-center gap-2">
                            <span className="inline-block w-1.5 h-3.5 bg-gray-700 animate-pulse rounded-sm" />
                            Waiting for output…
                          </span>
                        ) : (
                          logs.map((line, i) => (
                            <div key={i} className="flex gap-3 group hover:bg-white/[0.02] -mx-2 px-2 rounded">
                              <span className="text-gray-700 select-none w-7 text-right flex-shrink-0 group-hover:text-gray-600 transition-colors">
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

        {deleteConfirm && (
          <div className="fixed inset-0" onClick={() => setDeleteConfirm(null)} />
        )}
      </div>
    </div>
  )
}
