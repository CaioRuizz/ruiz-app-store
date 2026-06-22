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
    <div className="min-h-screen bg-[#04090f] px-4 py-8 sm:px-6 lg:px-10">
      <div className="relative mx-auto flex max-w-2xl flex-col gap-8">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,_rgba(96,153,38,0.18),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(88,166,255,0.1),_transparent_20%)] blur-3xl" />

        <button
          onClick={() => router.push('/')}
          className="relative flex w-max items-center gap-2 text-sm text-[#8b949e] transition hover:text-[#e6edf3]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to dashboard
        </button>

        <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.35em] text-[#6e7681]">Register a runner</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Add a Gitea runner</h1>
            <p className="mt-3 text-sm leading-6 text-[#b7c5d4]">
              Connect your Gitea instance and start running Actions with an elegant runner setup flow.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8b949e]">Gitea Instance URL</label>
              <input
                type="url"
                value={giteaUrl}
                onChange={e => setGiteaUrl(e.target.value)}
                placeholder="https://gitea.example.com"
                className="w-full rounded-3xl border border-white/10 bg-[#10161f] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#609926] focus:ring-2 focus:ring-[#609926]/20"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8b949e]">Registration Token</label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste token from Gitea settings"
                className="w-full rounded-3xl border border-white/10 bg-[#10161f] px-4 py-3 text-sm font-mono text-[#e6edf3] outline-none transition focus:border-[#609926] focus:ring-2 focus:ring-[#609926]/20"
                required
              />
              <p className="text-xs text-[#8b949e]">Gitea → Settings → Actions → Runners</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8b949e]">
                Runner Name <span className="text-[#6e7681] normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="umbrel-runner"
                className="w-full rounded-3xl border border-white/10 bg-[#10161f] px-4 py-3 text-sm text-[#e6edf3] outline-none transition focus:border-[#609926] focus:ring-2 focus:ring-[#609926]/20"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="inline-flex items-center gap-2 text-sm text-[#8b949e] transition hover:text-white"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Advanced options
            </button>

            {showAdvanced && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8b949e]">Labels</label>
                <textarea
                  value={labels}
                  onChange={e => setLabels(e.target.value)}
                  rows={4}
                  className="w-full rounded-3xl border border-white/10 bg-[#10161f] px-4 py-3 text-sm font-mono text-[#e6edf3] outline-none transition focus:border-[#609926] focus:ring-2 focus:ring-[#609926]/20 resize-none"
                />
                <p className="text-xs text-[#8b949e]">
                  Comma-separated, e.g. ubuntu-latest:docker://ubuntu:22.04
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-[#f85149]/20 bg-[#f85149]/10 px-4 py-3 text-sm text-[#f85149]">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-3xl bg-[#609926] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6aaa28] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Registering…
                  </>
                ) : (
                  'Register & Start'
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex min-w-[140px] items-center justify-center rounded-3xl border border-white/10 bg-[#0d1117] px-6 py-3 text-sm font-medium text-[#c9d1d9] transition hover:border-white/20 hover:text-white"
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
