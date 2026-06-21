'use client';

import { useState } from 'react';
import { VM } from '@/lib/api';

interface Props {
  vm: VM;
  onClose: () => void;
}

export default function SSHInstructions({ vm, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const host = typeof window !== 'undefined' ? window.location.hostname : 'umbrel.local';
  const sshCmd = `ssh ${vm.username}@${host} -p ${vm.ssh_port}`;

  const copy = async () => {
    await navigator.clipboard.writeText(sshCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <h2 className="font-semibold text-slate-100">{vm.name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* SSH command */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">SSH Command</p>
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-3">
              <code className="flex-1 text-sm text-green-400 font-mono break-all">{sshCmd}</code>
              <button
                onClick={copy}
                className="flex-shrink-0 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Username</p>
              <code className="text-sm text-slate-200 font-mono">{vm.username}</code>
            </div>
            <div className="bg-slate-800 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Password</p>
              <code className="text-sm text-slate-200 font-mono">{vm.password}</code>
            </div>
          </div>

          {/* Info */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 space-y-1.5 text-sm text-slate-400">
            <p><span className="text-slate-300 font-medium">Port:</span> {vm.ssh_port} (mapped to guest port 22)</p>
            <p><span className="text-slate-300 font-medium">Note:</span> Allow ~60 s after starting for cloud-init to finish. SSH will refuse connections until then.</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
