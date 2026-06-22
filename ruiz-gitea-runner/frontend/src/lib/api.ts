const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
  },
  runners: {
    list: () => req<Runner[]>('/api/runners'),
    create: (data: { gitea_url: string; token: string; name?: string; labels?: string }) =>
      req<{ id: string }>('/api/runners', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req(`/api/runners/${id}`, { method: 'DELETE' }),
    start: (id: string) => req(`/api/runners/${id}/start`, { method: 'POST' }),
    stop: (id: string) => req(`/api/runners/${id}/stop`, { method: 'POST' }),
  },
}

export interface Runner {
  id: string
  name: string
  gitea_url: string
  token: string
  labels: string
  status: 'pending' | 'registering' | 'registered' | 'running' | 'stopped' | 'error'
  error: string | null
  created_at: number
  running: boolean
}
