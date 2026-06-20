'use client';

import { VM } from '@/lib/api';

interface Props {
  vm: VM;
  onClose: () => void;
}

export default function VMConsole({ vm, onClose }: Props) {
  // noVNC is served as static files by nginx from /novnc/
  // The WebSocket path is proxied by nginx to the backend console endpoint
  const consoleSrc =
    `/novnc/vnc.html` +
    `?path=api/vms/${vm.id}/console` +
    `&autoconnect=true` +
    `&resize=scale` +
    `&show_dot=true` +
    `&logging=warn`;

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
        <p className="text-slate-600 text-xs ml-2">
          Boot takes ~60 s — wait for the login prompt
        </p>
        <div className="ml-auto">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Close console
          </button>
        </div>
      </div>

      {/* noVNC iframe */}
      <iframe
        src={consoleSrc}
        className="flex-1 border-0 bg-black"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
