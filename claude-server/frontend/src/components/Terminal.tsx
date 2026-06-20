'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Terminal as XTerminal } from '@xterm/xterm'
import type { FitAddon as XFitAddon } from '@xterm/addon-fit'

interface TerminalProps {
  sessionId: string
  token: string
}

export function Terminal({ sessionId, token }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let term: XTerminal
    let fitAddon: XFitAddon
    let socket: Socket
    let observer: ResizeObserver
    let disposed = false

    async function init() {
      // Dynamic imports — xterm is browser-only
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])
      // Import CSS side-effect
      await import('@xterm/xterm/css/xterm.css')

      if (disposed || !containerRef.current) return

      term = new XTerm({
        theme: {
          background: '#030712',
          foreground: '#e2e8f0',
          cursor: '#f97316',
          cursorAccent: '#030712',
          selectionBackground: '#1e293b',
          black: '#0f172a',    brightBlack: '#334155',
          red: '#ef4444',      brightRed: '#f87171',
          green: '#22c55e',    brightGreen: '#4ade80',
          yellow: '#eab308',   brightYellow: '#facc15',
          blue: '#3b82f6',     brightBlue: '#60a5fa',
          magenta: '#a855f7',  brightMagenta: '#c084fc',
          cyan: '#06b6d4',     brightCyan: '#22d3ee',
          white: '#cbd5e1',    brightWhite: '#f1f5f9',
        },
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Menlo, monospace',
        fontSize: 14,
        lineHeight: 1.3,
        cursorBlink: true,
        scrollback: 5000,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()

      socket = io(window.location.origin, {
        auth: { token },
        path: '/socket.io/',
        transports: ['websocket'],
      })

      socket.on('connect', () => {
        socket.emit('join', sessionId)
        setTimeout(() => {
          fitAddon.fit()
          socket.emit('resize', { sessionId, cols: term.cols, rows: term.rows })
        }, 80)
      })

      socket.on('output', (data: string) => term.write(data))

      socket.on('session:error', (msg: string) => {
        term.writeln(`\r\n\x1b[31mError: ${msg}\x1b[0m`)
      })

      socket.on('disconnect', () => {
        term.writeln('\r\n\x1b[33m[Disconnected — reconnecting...]\x1b[0m')
      })

      socket.on('reconnect', () => {
        socket.emit('join', sessionId)
      })

      term.onData(data => socket.emit('input', data, sessionId))

      observer = new ResizeObserver(() => {
        fitAddon.fit()
        socket.emit('resize', { sessionId, cols: term.cols, rows: term.rows })
      })
      observer.observe(containerRef.current!)
    }

    init()

    return () => {
      disposed = true
      observer?.disconnect()
      socket?.disconnect()
      term?.dispose()
    }
  }, [sessionId, token])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: '6px 8px', backgroundColor: '#030712' }}
    />
  )
}
