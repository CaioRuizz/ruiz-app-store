'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type AuthMode = 'api_key' | 'subscription'

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.setup.status().then(s => { if (s.configured) router.replace('/login') })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    if (authMode === 'api_key' && !apiKey.startsWith('sk-ant-')) return setError('API key must start with sk-ant-')

    setLoading(true)
    try {
      await api.setup.complete(password, authMode, authMode === 'api_key' ? apiKey : undefined)
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-3xl font-bold text-white">Claude Server</h1>
          <p className="text-gray-400 mt-1">One-time setup</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Admin password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            {/* Auth mode toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Authentication</label>
              <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAuthMode('api_key')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authMode === 'api_key'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  API Key
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('subscription')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    authMode === 'subscription'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Claude Pro / Max
                </button>
              </div>
            </div>

            {authMode === 'api_key' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Anthropic API key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-600 mt-1">Stored encrypted on your server — never leaves it</p>
              </div>
            )}

            {authMode === 'subscription' && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-400 leading-relaxed">
                Uses your Claude Pro or Max subscription — no API tokens consumed.<br />
                <span className="text-gray-500">You will be prompted to log in when you open your first session.</span>
              </div>
            )}

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-300 px-3 py-2.5 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors mt-2"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
