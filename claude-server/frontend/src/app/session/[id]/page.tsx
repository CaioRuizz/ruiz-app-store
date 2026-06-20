'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Terminal } from '@/components/Terminal'
import { api, type Session } from '@/lib/api'

export default function SessionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [token, setToken] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) { router.replace('/login'); return }
    setToken(t)
    api.sessions.get(id).then(setSession).catch(() => router.replace('/'))
  }, [id, router])

  if (!token || !session) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
        >
          ← Sessions
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-200">{session.name}</span>
        <span className="text-gray-600 text-xs font-mono hidden sm:block">{session.workspace}</span>
      </div>

      {/* Terminal fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <Terminal sessionId={id} token={token} />
      </div>
    </div>
  )
}
