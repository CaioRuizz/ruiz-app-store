'use client';

import { useState, useEffect, useCallback } from 'react';
import { OSImage, listImages, downloadImage, getImageProgress, createVM } from '@/lib/api';

const CPU_OPTIONS = [1, 2, 4, 8];
const RAM_OPTIONS = [512, 1024, 2048, 4096, 8192, 16384];
const STORAGE_OPTIONS = [10, 20, 50, 100, 200];

const OS_ICONS: Record<string, string> = {
  'ubuntu-2404': '🟠',
  'ubuntu-2204': '🟠',
  'debian-12':   '🔴',
  'fedora-40':   '🔵',
  'alpine-319':  '🩵',
};

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  return `${Math.round(b / 1e6)} MB`;
}

function formatRam(mb: number) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateVMDialog({ onClose, onCreated }: Props) {
  const [images, setImages] = useState<OSImage[]>([]);
  const [selectedOS, setSelectedOS] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('changeme');
  const [cpus, setCpus] = useState(2);
  const [ram, setRam] = useState(2048);
  const [storage, setStorage] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    const imgs = await listImages();
    setImages(imgs);
    if (!selectedOS && imgs.length) setSelectedOS(imgs[0].id);
  }, [selectedOS]);

  useEffect(() => { loadImages(); }, []);

  // Poll download progress
  useEffect(() => {
    if (!downloading) return;
    const iv = setInterval(async () => {
      const { downloaded, progress } = await getImageProgress(downloading);
      setImages(prev => prev.map(img =>
        img.id === downloading ? { ...img, downloadProgress: progress, downloaded } : img
      ));
      if (downloaded) { setDownloading(null); clearInterval(iv); }
    }, 1500);
    return () => clearInterval(iv);
  }, [downloading]);

  const handleDownload = async (osId: string) => {
    await downloadImage(osId);
    setDownloading(osId);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!selectedOS) { setError('Select an OS'); return; }
    const img = images.find(i => i.id === selectedOS);
    if (!img?.downloaded) { setError('Download the OS image first'); return; }

    setCreating(true);
    setError('');
    try {
      await createVM({ name: name.trim(), osId: selectedOS, cpus, ram, storage, username, password });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const selectedImg = images.find(i => i.id === selectedOS);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Virtual Machine</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* OS Selection */}
          <section>
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 block">
              Operating System
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {images.map(img => (
                <button
                  key={img.id}
                  onClick={() => setSelectedOS(img.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    selectedOS === img.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl">{OS_ICONS[img.id] ?? '💿'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200">{img.name}</p>
                    <p className="text-xs text-slate-500">{img.version} · {formatBytes(img.sizeBytes)}</p>
                  </div>
                  {img.downloaded ? (
                    <span className="text-xs text-green-400 font-medium">Ready</span>
                  ) : img.downloadProgress > 0 && img.downloadProgress < 100 ? (
                    <div className="text-right">
                      <p className="text-xs text-yellow-400">{img.downloadProgress}%</p>
                      <div className="w-16 h-1 bg-slate-700 rounded mt-1">
                        <div className="h-1 bg-yellow-400 rounded" style={{ width: `${img.downloadProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(img.id); }}
                      className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-lg"
                    >
                      Download
                    </button>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* VM Details */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">VM Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="my-server"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-400 block mb-1">Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </section>

          {/* Resources */}
          <section>
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 block">
              Resources
            </label>
            <div className="space-y-4">
              <ResourceRow label="CPU Cores" value={`${cpus} core${cpus > 1 ? 's' : ''}`}>
                {CPU_OPTIONS.map(v => (
                  <Chip key={v} active={cpus === v} onClick={() => setCpus(v)}>{v}</Chip>
                ))}
              </ResourceRow>

              <ResourceRow label="Memory" value={formatRam(ram)}>
                {RAM_OPTIONS.map(v => (
                  <Chip key={v} active={ram === v} onClick={() => setRam(v)}>{formatRam(v)}</Chip>
                ))}
              </ResourceRow>

              <ResourceRow label="Storage" value={`${storage} GB`}>
                {STORAGE_OPTIONS.map(v => (
                  <Chip key={v} active={storage === v} onClick={() => setStorage(v)}>{v} GB</Chip>
                ))}
              </ResourceRow>
            </div>
          </section>

          {/* Summary */}
          <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 space-y-1">
            <p><span className="text-slate-500">OS:</span> {selectedImg ? `${selectedImg.name} ${selectedImg.version}` : '—'}</p>
            <p><span className="text-slate-500">Resources:</span> {cpus} vCPU · {formatRam(ram)} RAM · {storage} GB disk</p>
            {selectedImg && !selectedImg.downloaded && (
              <p className="text-yellow-400">Download the image before creating this VM.</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !selectedImg?.downloaded}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create VM'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ label, value, children }: {
  label: string; value: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 flex-shrink-0">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-xs text-slate-500 font-mono">{value}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
