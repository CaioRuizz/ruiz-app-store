'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const DEFAULT_LABELS = 'ubuntu-latest:docker://ubuntu:22.04,ubuntu-22.04:docker://ubuntu:22.04,ubuntu-20.04:docker://ubuntu:20.04'

function GiteaLogo({ size = 32 }: { size?: number }) {
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d1117]">
      <div className="w-full max-w-md">

        {/* Logo / hero — properly sized, no giant box */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <GiteaLogo size={40} />
          </div>
          <h1 className="text-xl font-semibold text-[#e6edf3] tracking-tight">Gitea Runner</h1>
          <p className="text-[#8b949e] text-sm mt-1">Connect your first Gitea instance to get started</p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#161b22', border: '1px solid #30363d' }}
        >
          <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, #609926, transparent)' }} />

          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">
                Gitea Instance URL
              </label>
              <input
                type="url"
                value={giteaUrl}
                onChange={e => setGiteaUrl(e.target.value)}
                placeholder="https://gitea.example.com"
                className="w-full rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#6e7681] outline-none transition-all"
                style={{ background: '#21262d', border: '1px solid #30363d' }}
                onFocus={e => (e.target.style.borderColor = '#609926')}
                onBlur={e => (e.target.style.borderColor = '#30363d')}
                autoFocus
                required
              />
              <p className="text-xs text-[#6e7681] mt-1.5">Without trailing slash</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">
                Registration Token
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste token from Gitea settings"
                className="w-full rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#6e7681] font-mono outline-none transition-all"
                style={{ background: '#21262d', border: '1px solid #30363d' }}
                onFocus={e => (e.target.style.borderColor = '#609926')}
                onBlur={e => (e.target.style.borderColor = '#30363d')}
                required
              />
              <p className="text-xs text-[#6e7681] mt-1.5">Gitea → Settings → Actions → Runners</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">
                Runner Name <span className="text-[#6e7681] normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="umbrel-runner"
                className="w-full rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#6e7681] outline-none transition-all"
                style={{ background: '#21262d', border: '1px solid #30363d' }}
                onFocus={e => (e.target.style.borderColor = '#609926')}
                onBlur={e => (e.target.style.borderColor = '#30363d')}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[#6e7681] hover:text-[#8b949e] transition-colors"
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
                <label className="block text-xs font-medium text-[#8b949e] mb-1.5 uppercase tracking-wider">Labels</label>
                <textarea
                  value={labels}
                  onChange={e => setLabels(e.target.value)}
                  rows={3}
                  className="w-full rounded-md px-3 py-2 text-xs text-[#e6edf3] placeholder-[#6e7681] font-mono outline-none transition-all resize-none"
                  style={{ background: '#21262d', border: '1px solid #30363d' }}
                  onFocus={e => (e.target.style.borderColor = '#609926')}
                  onBlur={e => (e.target.style.borderColor = '#30363d')}
                />
                <p className="text-xs text-[#6e7681] mt-1.5">
                  Comma-separated, e.g. ubuntu-latest:docker://ubuntu:22.04
                </p>
              </div>
            )}

            {error && (
              <div
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[#f85149]"
                style={{ background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)' }}
              >
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#609926' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#6aaa28') }}
              onMouseLeave={e => { (e.currentTarget.style.background = '#609926') }}
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
