'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type AuthMode = 'api_key' | 'subscription'
type LoginState = 'idle' | 'running' | 'success' | 'failed'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [loginOutput, setLoginOutput] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    api.setup.status().then(s => { if (s.configured) router.replace('/login') })
  }, [router])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [loginOutput])

  function startClaudeLogin() {
    setLoginState('running')
    setLoginOutput('')
    setLoginUrl('')

    const es = new EventSource(`${BASE}/api/setup/claude-login`)

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { text?: string; done?: boolean; success?: boolean }
      if (msg.text) {
        setLoginOutput(prev => prev + msg.text)
        const match = msg.text.match(/https?:\/\/\S+/)
        if (match) setLoginUrl(match[0])
      }
      if (msg.done) {
        es.close()
        setLoginState(msg.success ? 'success' : 'failed')
      }
    }

    es.onerror = () => {
      es.close()
      setLoginState('failed')
      setLoginOutput(prev => prev + '\nConnection lost.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    if (authMode === 'api_key') {
      if (!apiKey.startsWith('sk-ant-')) return setError('API key must start with sk-ant-')
    } else {
      if (loginState !== 'success') return setError('Complete the Claude login first')
    }

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
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  Uses your Claude Pro or Max subscription — no API tokens consumed.
                </p>

                {loginState === 'idle' && (
                  <button
                    type="button"
                    onClick={startClaudeLogin}
                    className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Start Claude Login
                  </button>
                )}

                {loginState === 'running' && (
                  <div className="space-y-2">
                    <pre
                      ref={outputRef}
                      className="bg-black rounded-lg p-3 text-xs text-green-400 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap"
                    >
                      {loginOutput || 'Starting…'}
                    </pre>
                    {loginUrl && (
                      <a
                        href={loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Open Login URL ↗
                      </a>
                    )}
                    <p className="text-xs text-gray-500 text-center">Waiting for you to complete login…</p>
                  </div>
                )}

                {loginState === 'success' && (
                  <div className="flex items-center gap-2 bg-green-950 border border-green-800 text-green-300 px-3 py-2.5 rounded-lg text-sm">
                    <span>✓</span> Logged in successfully
                  </div>
                )}

                {loginState === 'failed' && (
                  <div className="space-y-2">
                    <pre className="bg-black rounded-lg p-3 text-xs text-red-400 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {loginOutput}
                    </pre>
                    <button
                      type="button"
                      onClick={startClaudeLogin}
                      className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
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
