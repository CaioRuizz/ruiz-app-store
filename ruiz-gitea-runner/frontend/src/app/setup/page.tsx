'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const DEFAULT_LABELS = 'ubuntu-latest:docker://ubuntu:22.04,ubuntu-22.04:docker://ubuntu:22.04,ubuntu-20.04:docker://ubuntu:20.04'

export default function SetupPage() {
  const router = useRouter()
  const [giteaUrl, setGiteaUrl] = useState('')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.setup.status().then(s => { if (s.configured) router.replace('/') })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!giteaUrl.trim()) return setError('Gitea URL is required')
    if (!token.trim()) return setError('Registration token is required')
    try { new URL(giteaUrl.trim()) } catch {
      return setError('Gitea URL must be a valid URL (e.g. https://gitea.example.com)')
    }
    setLoading(true)
    try {
      await api.runners.create({
        gitea_url: giteaUrl.trim(),
        token: token.trim(),
        name: name.trim() || undefined,
        labels: labels.trim() || undefined,
      })
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-xl shadow-emerald-900/40 mb-4">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gitea Runner</h1>
          <p className="text-gray-500 text-sm mt-1">Connect your first Gitea instance to get started</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 border border-gray-800/60 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Gitea Instance URL
              </label>
              <input
                type="url"
                value={giteaUrl}
                onChange={e => setGiteaUrl(e.target.value)}
                placeholder="https://gitea.example.com"
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50 transition-all text-sm"
                autoFocus
                required
              />
              <p className="text-xs text-gray-600 mt-1.5">Without trailing slash</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Registration Token
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste token from Gitea settings"
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50 transition-all font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-600 mt-1.5">
                Gitea → Settings → Actions → Runners
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Runner Name <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="umbrel-runner"
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50 transition-all text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Advanced options
            </button>

            {showAdvanced && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Labels</label>
                <textarea
                  value={labels}
                  onChange={e => setLabels(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50 transition-all font-mono text-xs"
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  Comma-separated, e.g. ubuntu-latest:docker://ubuntu:22.04
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-800/50 text-red-300 px-3.5 py-3 rounded-xl text-sm">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-900/40 mt-2 text-sm"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Registering runner…
                </>
              ) : 'Register & Start Runner'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
