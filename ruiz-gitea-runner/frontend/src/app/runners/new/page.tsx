'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const DEFAULT_LABELS = 'ubuntu-latest:docker://ubuntu:22.04,ubuntu-22.04:docker://ubuntu:22.04,ubuntu-20.04:docker://ubuntu:20.04'

const inputClass = 'w-full rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#6e7681] outline-none transition-all'
const inputStyle = { background: '#21262d', border: '1px solid #30363d' }
const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#609926' }
const inputBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#30363d' }

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
    <div className="min-h-screen bg-[#0d1117] p-6">
      <div className="max-w-md mx-auto">

        {/* Back nav */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-[#6e7681] hover:text-[#e6edf3] transition-colors mb-8 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-base font-semibold text-[#e6edf3]">Add Runner</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">Register a new runner with your Gitea instance</p>
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
                className={inputClass}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
                autoFocus
                required
              />
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
                className={`${inputClass} font-mono`}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
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
                className={inputClass}
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
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
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
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

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: '#609926' }}
                onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#6aaa28') }}
                onMouseLeave={e => { (e.currentTarget.style.background = '#609926') }}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Registering…
                  </>
                ) : 'Register & Start'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-5 py-2.5 rounded-md text-sm text-[#8b949e] hover:text-[#e6edf3] transition-all"
                style={{ border: '1px solid #30363d' }}
                onMouseEnter={e => { (e.currentTarget.style.borderColor = '#484f58') }}
                onMouseLeave={e => { (e.currentTarget.style.borderColor = '#30363d') }}
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
