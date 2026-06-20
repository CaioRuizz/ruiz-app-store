'use client';

import { useEffect, useRef } from 'react';
import { VM } from '@/lib/api';

interface Props {
  vm: VM;
  onClose: () => void;
}

// noVNC is loaded from CDN at runtime to avoid SSR/webpack issues
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RFB?: any;
  }
}

function loadNoVNC(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.RFB) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js';
    s.type = 'module';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function VMConsole({ vm, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfbRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/api/vms/${vm.id}/console`;

    loadNoVNC()
      .then(() => {
        if (!window.RFB || !container) return;
        const rfb = new window.RFB(container, wsUrl, { wsProtocols: ['binary'] });
        rfb.scaleViewport = true;
        rfbRef.current = rfb;
      })
      .catch(err => console.error('Failed to load noVNC:', err));

    return () => {
      rfbRef.current?.disconnect?.();
    };
  }, [vm.id]);

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="font-medium text-slate-200">{vm.name}</span>
        <span className="text-slate-500 text-sm font-mono">
          {vm.username} / {vm.password}
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500 text-xs">
          {vm.cpus} vCPU · {vm.ram >= 1024 ? `${vm.ram / 1024} GB` : `${vm.ram} MB`} RAM
        </span>
        <div className="ml-auto">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Close console
          </button>
        </div>
      </div>

      {/* noVNC container */}
      <div ref={containerRef} className="flex-1 bg-black overflow-hidden" />
    </div>
  );
}
