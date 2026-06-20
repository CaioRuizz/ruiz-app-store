'use client';

import { useState, useEffect, useCallback } from 'react';
import { VM, listVMs } from '@/lib/api';
import VMCard from '@/components/VMCard';
import CreateVMDialog from '@/components/CreateVMDialog';
import VMConsole from '@/components/VMConsole';

export default function Home() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [consoleVM, setConsoleVM] = useState<VM | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVMs(await listVMs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  const running = vms.filter(v => v.status === 'running').length;
  const stopped = vms.filter(v => v.status === 'stopped').length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
              🖥️
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 leading-tight">VM Manager</h1>
              {!loading && (
                <p className="text-xs text-slate-500">
                  {running > 0 && <span className="text-green-400">{running} running</span>}
                  {running > 0 && stopped > 0 && ' · '}
                  {stopped > 0 && `${stopped} stopped`}
                  {vms.length === 0 && 'No virtual machines'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New VM
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
        ) : vms.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vms.map(vm => (
              <VMCard
                key={vm.id}
                vm={vm}
                onRefresh={refresh}
                onConsole={setConsoleVM}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateVMDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {consoleVM && (
        <VMConsole vm={consoleVM} onClose={() => setConsoleVM(null)} />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
      <div className="text-6xl opacity-30">🖥️</div>
      <div>
        <p className="text-slate-400 font-medium">No virtual machines yet</p>
        <p className="text-slate-600 text-sm mt-1">Create your first VM to get started</p>
      </div>
      <button
        onClick={onNew}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Create VM
      </button>
    </div>
  );
}
