const BASE = '/api';

export interface VM {
  id: string;
  name: string;
  os_id: string;
  cpus: number;
  ram: number;
  storage: number;
  status: 'creating' | 'stopped' | 'running' | 'error';
  username: string;
  password: string;
  vnc_display: number | null;
  ws_port: number | null;
  ssh_port: number | null;
  created_at: string;
}

export interface OSImage {
  id: string;
  name: string;
  version: string;
  sizeBytes: number;
  defaultUser: string;
  downloaded: boolean;
  downloadProgress: number;
}

export async function listVMs(): Promise<VM[]> {
  const r = await fetch(`${BASE}/vms`);
  return r.json();
}

export async function getVM(id: string): Promise<VM> {
  const r = await fetch(`${BASE}/vms/${id}`);
  return r.json();
}

export async function createVM(data: {
  name: string; osId: string; cpus: number; ram: number; storage: number;
  username: string; password: string;
}): Promise<VM> {
  const r = await fetch(`${BASE}/vms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to create VM');
  return r.json();
}

export async function startVM(id: string): Promise<void> {
  await fetch(`${BASE}/vms/${id}/start`, { method: 'POST' });
}

export async function stopVM(id: string, force = false): Promise<void> {
  await fetch(`${BASE}/vms/${id}/stop?force=${force ? 1 : 0}`, { method: 'POST' });
}

export async function deleteVM(id: string): Promise<void> {
  await fetch(`${BASE}/vms/${id}`, { method: 'DELETE' });
}

export async function listImages(): Promise<OSImage[]> {
  const r = await fetch(`${BASE}/images`);
  return r.json();
}

export async function downloadImage(id: string): Promise<void> {
  await fetch(`${BASE}/images/${id}/download`, { method: 'POST' });
}

export async function getImageProgress(id: string): Promise<{ downloaded: boolean; progress: number }> {
  const r = await fetch(`${BASE}/images/${id}/progress`);
  return r.json();
}
