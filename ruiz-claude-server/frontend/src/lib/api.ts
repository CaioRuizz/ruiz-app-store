// All API calls use relative paths — nginx routes /api/* to the backend.
// In dev, set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

function token(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null
}

async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Request failed')
  return body as T
}

export const api = {
  setup: {
    status: () => req<{ configured: boolean }>('/api/setup/status'),
    complete: (password: string, authMode: 'api_key' | 'subscription', apiKey?: string) =>
      req('/api/setup/complete', { method: 'POST', body: JSON.stringify({ password, authMode, apiKey }) }),
  },
  auth: {
    login: (password: string) =>
      req<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  },
  sessions: {
    list: () => req<Session[]>('/api/sessions'),
    get: (id: string) => req<Session>(`/api/sessions/${id}`),
    create: (name: string, workspace: string) =>
      req<{ id: string }>('/api/sessions', { method: 'POST', body: JSON.stringify({ name, workspace }) }),
    start: (id: string) => req(`/api/sessions/${id}/start`, { method: 'POST' }),
    delete: (id: string) => req(`/api/sessions/${id}`, { method: 'DELETE' }),
  },
  files: {
    list: (path?: string) =>
      req<FileListing>(`/api/files${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  },
}

export interface Session {
  id: string
  name: string
  workspace: string
  status: 'active' | 'stopped'
  created_at: number
  last_active: number
}

export interface FileListing {
  current: string
  parent: string | null
  entries: { name: string; path: string }[]
}
