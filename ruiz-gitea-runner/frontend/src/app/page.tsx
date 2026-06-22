'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Runner } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

const STATUS_STYLE: Record<string, string> = {
  running:     'bg-green-950 text-green-400 border border-green-900',
  registered:  'bg-blue-950 text-blue-400 border border-blue-900',
  registering: 'bg-yellow-950 text-yellow-400 border border-yellow-900',
  pending:     'bg-gray-800 text-gray-500',
  stopped:     'bg-gray-800 text-gray-500',
  error:       'bg-red-950 text-red-400 border border-red-900',
}

const DOT_STYLE: Record<string, string> = {
  running:     'bg-green-500',
  registered:  'bg-blue-500',
  registering: 'bg-yellow-500 animate-pulse',
  pending:     'bg-gray-600',
  stopped:     'bg-gray-600',
  error:       'bg-red-500',
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

    es.onmessage = (evt) => {
      setLogs(prev => [...prev, evt.data])
    }
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
    try {
      await api.runners.start(id)
      await loadRunners()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleStop(id: string) {
    setActionLoading(id)
    try {
      await api.runners.stop(id)
      await loadRunners()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      return
    }
    setDeleteConfirm(null)
    if (activeLogs === id) closeLogs()
    await api.runners.delete(id)
    setRunners(prev => prev.filter(r => r.id !== id))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏃</span>
            <h1 className="text-xl font-bold text-white">Gitea Runner</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadRunners}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push('/runners/new')}
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + Add Runner
            </button>
          </div>
        </div>

        {/* Runner list */}
        {runners.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-1">No runners configured</p>
            <p className="text-sm">Add your first runner to start executing Gitea Actions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runners.map(runner => (
              <div
                key={runner.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${DOT_STYLE[runner.status] ?? 'bg-gray-600'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{runner.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[runner.status] ?? ''}`}>
                          {runner.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs font-mono mt-1 truncate">{runner.gitea_url}</p>
                      {runner.labels && (
                        <p className="text-gray-700 text-xs mt-0.5 truncate">Labels: {runner.labels}</p>
                      )}
                      {runner.status === 'error' && runner.error && (
                        <p className="text-red-400 text-xs mt-1 line-clamp-2">{runner.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {runner.running ? (
                      <button
                        onClick={() => handleStop(runner.id)}
                        disabled={actionLoading === runner.id}
                        className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Stop
                      </button>
                    ) : (
                      runner.status !== 'pending' && runner.status !== 'registering' && (
                        <button
                          onClick={() => handleStart(runner.id)}
                          disabled={actionLoading === runner.id}
                          className="text-xs px-3 py-1.5 bg-green-900 hover:bg-green-800 text-green-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Start
                        </button>
                      )
                    )}

                    {runner.running && (
                      <button
                        onClick={() => activeLogs === runner.id ? closeLogs() : openLogs(runner.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          activeLogs === runner.id
                            ? 'bg-blue-900 text-blue-300'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                        }`}
                      >
                        {activeLogs === runner.id ? 'Hide Logs' : 'Logs'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(runner.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        deleteConfirm === runner.id
                          ? 'bg-red-800 text-red-200 hover:bg-red-700'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-600 hover:text-red-400'
                      }`}
                    >
                      {deleteConfirm === runner.id ? 'Confirm?' : 'Remove'}
                    </button>
                  </div>
                </div>

                {/* Inline log panel */}
                {activeLogs === runner.id && (
                  <div className="mt-4 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-mono">Live logs — {runner.name}</span>
                      <button onClick={closeLogs} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
                    </div>
                    <div className="h-56 overflow-y-auto p-3 font-mono text-xs text-gray-400 leading-relaxed">
                      {logs.length === 0 ? (
                        <span className="text-gray-700">Waiting for output…</span>
                      ) : (
                        logs.map((line, i) => (
                          <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {deleteConfirm && (
          <div
            className="fixed inset-0"
            onClick={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    </div>
  )
}
