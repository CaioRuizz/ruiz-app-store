'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const DEFAULT_LABELS = 'ubuntu-latest:docker://ubuntu:22.04,ubuntu-22.04:docker://ubuntu:22.04,ubuntu-20.04:docker://ubuntu:20.04'

export default function NewRunnerPage() {
  const router = useRouter()
  const [giteaUrl, setGiteaUrl] = useState('')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!giteaUrl.trim()) return setError('Gitea URL is required')
    if (!token.trim()) return setError('Registration token is required')

    try {
      new URL(giteaUrl.trim())
    } catch {
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
    <div className="min-h-screen p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-white">Add Runner</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Gitea instance URL
              </label>
              <input
                type="url"
                value={giteaUrl}
                onChange={e => setGiteaUrl(e.target.value)}
                placeholder="https://gitea.example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Registration token
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste token from Gitea settings"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-600 mt-1">
                Found in Gitea → Settings → Actions → Runners
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Runner name <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="umbrel-runner"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              {showAdvanced ? '▾' : '▸'} Advanced options
            </button>

            {showAdvanced && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Labels</label>
                <textarea
                  value={labels}
                  onChange={e => setLabels(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent font-mono text-xs"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Comma-separated. e.g. ubuntu-latest:docker://ubuntu:22.04
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-300 px-3 py-2.5 rounded-lg text-sm whitespace-pre-wrap">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors"
              >
                {loading ? 'Registering…' : 'Register & Start'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-5 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
