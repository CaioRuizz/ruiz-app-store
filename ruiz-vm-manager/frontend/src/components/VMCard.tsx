'use client';

import { useState } from 'react';
import { VM, startVM, stopVM, deleteVM } from '@/lib/api';

const OS_LABELS: Record<string, { label: string; color: string }> = {
  'ubuntu-2404': { label: 'Ubuntu 24.04', color: 'bg-orange-500' },
  'ubuntu-2204': { label: 'Ubuntu 22.04', color: 'bg-orange-400' },
  'debian-12':   { label: 'Debian 12',    color: 'bg-red-500' },
  'fedora-40':   { label: 'Fedora 40',    color: 'bg-blue-500' },
  'alpine-319':  { label: 'Alpine 3.19',  color: 'bg-teal-500' },
};

const STATUS_DOT: Record<string, string> = {
  running:  'bg-green-400',
  stopped:  'bg-slate-500',
  creating: 'bg-yellow-400 animate-pulse',
  error:    'bg-red-500',
};

interface Props {
  vm: VM;
  onRefresh: () => void;
  onConsole: (vm: VM) => void;
}

export default function VMCard({ vm, onRefresh, onConsole }: Props) {
  const [busy, setBusy] = useState(false);
  const os = OS_LABELS[vm.os_id] ?? { label: vm.os_id, color: 'bg-slate-600' };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); onRefresh(); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[vm.status] ?? 'bg-slate-500'}`} />
          <div>
            <p className="font-semibold text-slate-100 leading-tight">{vm.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{new Date(vm.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${os.color}`}>
          {os.label}
        </span>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="CPU" value={`${vm.cpus} core${vm.cpus > 1 ? 's' : ''}`} />
        <Stat label="RAM" value={formatRam(vm.ram)} />
        <Stat label="Disk" value={`${vm.storage} GB`} />
      </div>

      {/* Credentials */}
      {vm.status === 'running' && (
        <div className="bg-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 space-y-0.5">
          <div>
            <span className="text-slate-500">user: </span>{vm.username}
            {'  '}
            <span className="text-slate-500">pass: </span>{vm.password}
          </div>
          {vm.ssh_port && (
            <div><span className="text-slate-500">ssh port: </span>{vm.ssh_port}</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {vm.status === 'stopped' && (
          <Button onClick={() => run(() => startVM(vm.id))} busy={busy} variant="green">Start</Button>
        )}
        {vm.status === 'running' && (
          <>
            {vm.ssh_port && (
              <Button onClick={() => onConsole(vm)} busy={false} variant="blue">SSH</Button>
            )}
            <Button onClick={() => run(() => stopVM(vm.id))} busy={busy} variant="yellow">Stop</Button>
            <Button onClick={() => run(() => stopVM(vm.id, true))} busy={busy} variant="slate">Force off</Button>
          </>
        )}
        {(vm.status === 'stopped' || vm.status === 'error') && (
          <Button
            onClick={() => { if (confirm(`Delete "${vm.name}"?`)) run(() => deleteVM(vm.id)); }}
            busy={busy} variant="red"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-lg py-2 px-1">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-200 mt-0.5">{value}</p>
    </div>
  );
}

const VARIANT_CLASSES: Record<string, string> = {
  green:  'bg-green-700 hover:bg-green-600 text-white',
  blue:   'bg-blue-700 hover:bg-blue-600 text-white',
  yellow: 'bg-yellow-700 hover:bg-yellow-600 text-white',
  red:    'bg-red-800 hover:bg-red-700 text-white',
  slate:  'bg-slate-700 hover:bg-slate-600 text-slate-200',
};

function Button({
  onClick, busy, variant, children,
}: { onClick: () => void; busy: boolean; variant: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </button>
  );
}

function formatRam(mb: number): string {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}
