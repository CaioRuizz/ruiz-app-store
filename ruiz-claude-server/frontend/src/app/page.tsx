'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Session, type FileListing } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [listing, setListing] = useState<FileListing | null>(null)
  const [selectedDir, setSelectedDir] = useState('/workspaces')

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.sessions.list())
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        router.replace('/login')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) { router.replace('/login'); return }

    api.setup.status().then(s => {
      if (!s.configured) { router.replace('/setup'); return }
      loadSessions()
    }).catch(() => router.replace('/login'))
  }, [router, loadSessions])

  async function openCreate() {
    setShowCreate(true)
    setNewName('')
    setError('')
    try {
      const data = await api.files.list()
      setListing(data)
      setSelectedDir(data.current)
    } catch {}
  }

  async function browseDir(path: string) {
    try {
      const data = await api.files.list(path)
      setListing(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function createSession() {
    if (!newName.trim()) { setError('Name is required'); return }
    setCreating(true)
    setError('')
    try {
      const { id } = await api.sessions.create(newName.trim(), selectedDir)
      router.push(`/session/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setCreating(false)
    }
  }

  async function startSession(id: string) {
    setStartingId(id)
    try {
      await api.sessions.start(id)
      router.push(`/session/${id}`)
    } catch (err) {
      console.error(err)
      setStartingId(null)
    }
  }

  async function deleteSession(id: string) {
    await api.sessions.delete(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-bold text-white">Claude Server</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSessions}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              + New Session
            </button>
            <button
              onClick={() => { localStorage.removeItem('token'); router.push('/login') }}
              className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Session list */}
        {sessions.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-1">No sessions yet</p>
            <p className="text-sm">Create a new session to start using Claude Code on your server</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => (
              <div
                key={session.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-gray-700 transition-colors group"
              >
                <button
                  onClick={() => session.status === 'active' && router.push(`/session/${session.id}`)}
                  disabled={session.status !== 'active'}
                  className="flex-1 text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.status === 'active' ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <span className="font-medium text-white">{session.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${session.status === 'active' ? 'bg-green-950 text-green-400 border border-green-900' : 'bg-gray-800 text-gray-500'}`}>
                      {session.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs font-mono mt-1.5 ml-4.5">{session.workspace}</p>
                  <p className="text-gray-700 text-xs mt-0.5 ml-4.5">
                    Active {new Date(session.last_active).toLocaleString()}
                  </p>
                </button>

                {session.status === 'stopped' && (
                  <button
                    onClick={() => startSession(session.id)}
                    disabled={startingId === session.id}
                    className="text-gray-500 hover:text-green-400 disabled:opacity-50 transition-colors text-xs px-2.5 py-1 border border-gray-700 hover:border-green-800 rounded-lg"
                  >
                    {startingId === session.id ? '...' : 'Start'}
                  </button>
                )}

                <button
                  onClick={() => deleteSession(session.id)}
                  className="text-gray-700 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                  title="Kill session"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-lg font-bold mb-5">New Session</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Session name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createSession()}
                  placeholder="My project"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace directory</label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {listing && (
                    <>
                      <div className="px-3 py-2 border-b border-gray-700 font-mono text-xs text-orange-400 truncate">
                        {listing.current}
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {listing.parent && (
                          <button
                            onClick={() => browseDir(listing.parent!)}
                            className="w-full text-left px-3 py-2 text-gray-400 hover:bg-gray-700 text-sm flex items-center gap-2"
                          >
                            <span className="text-xs">📁</span> ..
                          </button>
                        )}
                        {listing.entries.length === 0 ? (
                          <p className="px-3 py-2 text-gray-600 text-sm italic">No subdirectories</p>
                        ) : (
                          listing.entries.map(dir => (
                            <button
                              key={dir.path}
                              onClick={() => browseDir(dir.path)}
                              className="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 text-sm flex items-center gap-2"
                            >
                              <span className="text-xs">📁</span> {dir.name}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-gray-700 flex items-center justify-between">
                        <button
                          onClick={() => { setSelectedDir(listing.current) }}
                          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${selectedDir === listing.current ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                        >
                          {selectedDir === listing.current ? '✓ Selected' : 'Use this dir'}
                        </button>
                        <span className="text-gray-600 text-xs font-mono truncate ml-2 max-w-[200px]">{selectedDir}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-300 px-3 py-2.5 rounded-lg text-sm mt-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={createSession}
                disabled={creating}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors"
              >
                {creating ? 'Starting...' : 'Create Session'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
