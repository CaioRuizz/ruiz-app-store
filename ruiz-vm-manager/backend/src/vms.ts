import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import WebSocket from 'ws';
import net from 'net';
import { getDB } from './db';

const DATA_DIR = process.env.DATA_DIR || './data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const VMS_DIR = path.join(DATA_DIR, 'vms');

export interface OSDef {
  id: string;
  name: string;
  version: string;
  url: string;
  format: 'qcow2' | 'img';
  sizeBytes: number;
  defaultUser: string;
}

export const OS_LIST: OSDef[] = [
  {
    id: 'ubuntu-2404',
    name: 'Ubuntu',
    version: '24.04 LTS',
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
    format: 'img',
    sizeBytes: 650 * 1024 * 1024,
    defaultUser: 'ubuntu',
  },
  {
    id: 'ubuntu-2204',
    name: 'Ubuntu',
    version: '22.04 LTS',
    url: 'https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img',
    format: 'img',
    sizeBytes: 620 * 1024 * 1024,
    defaultUser: 'ubuntu',
  },
  {
    id: 'debian-12',
    name: 'Debian',
    version: '12 (Bookworm)',
    url: 'https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2',
    format: 'qcow2',
    sizeBytes: 350 * 1024 * 1024,
    defaultUser: 'debian',
  },
  {
    id: 'fedora-40',
    name: 'Fedora',
    version: '40',
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/40/Cloud/x86_64/images/Fedora-Cloud-Base-Generic.x86_64-40-1.14.qcow2',
    format: 'qcow2',
    sizeBytes: 450 * 1024 * 1024,
    defaultUser: 'fedora',
  },
  {
    id: 'alpine-319',
    name: 'Alpine Linux',
    version: '3.19',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.1-x86_64-uefi-cloudinit-r0.qcow2',
    format: 'qcow2',
    sizeBytes: 55 * 1024 * 1024,
    defaultUser: 'alpine',
  },
];

const downloadProgress: Record<string, number> = {};

export function getImagePath(osId: string): string {
  const os = OS_LIST.find(o => o.id === osId);
  if (!os) throw new Error(`Unknown OS: ${osId}`);
  return path.join(IMAGES_DIR, `${osId}.${os.format === 'img' ? 'img' : 'qcow2'}`);
}

export function isImageDownloaded(osId: string): boolean {
  try {
    return fs.existsSync(getImagePath(osId));
  } catch {
    return false;
  }
}

export function getDownloadProgress(osId: string): number {
  return downloadProgress[osId] ?? (isImageDownloaded(osId) ? 100 : 0);
}

export async function downloadImage(osId: string): Promise<void> {
  const os = OS_LIST.find(o => o.id === osId);
  if (!os) throw new Error(`Unknown OS: ${osId}`);

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const dest = getImagePath(osId);
  if (fs.existsSync(dest)) return;

  downloadProgress[osId] = 0;

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest + '.tmp');
    let received = 0;

    const get = (url: string) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location!);
        }
        const total = parseInt(res.headers['content-length'] || String(os.sizeBytes), 10);
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          downloadProgress[osId] = Math.min(99, Math.round((received / total) * 100));
          file.write(chunk);
        });
        res.on('end', () => {
          file.end(() => {
            fs.renameSync(dest + '.tmp', dest);
            downloadProgress[osId] = 100;
            resolve();
          });
        });
        res.on('error', reject);
      }).on('error', reject);
    };

    get(os.url);
  });
}

function allocatePorts(): { vncDisplay: number; wsPort: number } {
  const db = getDB();
  const used = db.prepare('SELECT vnc_display, ws_port FROM vms WHERE status != ?').all('deleted') as {
    vnc_display: number | null;
    ws_port: number | null;
  }[];
  const usedDisplays = new Set(used.map(r => r.vnc_display).filter(Boolean));
  const usedWs = new Set(used.map(r => r.ws_port).filter(Boolean));

  let vncDisplay = 1;
  while (usedDisplays.has(vncDisplay)) vncDisplay++;

  let wsPort = 5700 + vncDisplay;
  while (usedWs.has(wsPort)) wsPort++;

  return { vncDisplay, wsPort };
}

function createCloudInitDisk(vmDir: string, username: string, password: string, hostname: string): void {
  const userData = `#cloud-config
hostname: ${hostname}
users:
  - name: ${username}
    plain_text_passwd: "${password}"
    lock_passwd: false
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
ssh_pwauth: true
disable_root: false
runcmd:
  - echo "root:${password}" | chpasswd
`;
  const metaData = `instance-id: ${hostname}\nlocal-hostname: ${hostname}\n`;

  fs.writeFileSync(path.join(vmDir, 'user-data'), userData);
  fs.writeFileSync(path.join(vmDir, 'meta-data'), metaData);

  execSync(
    `genisoimage -output ${path.join(vmDir, 'seed.img')} -volid cidata -joliet -rock ` +
    `${path.join(vmDir, 'user-data')} ${path.join(vmDir, 'meta-data')}`,
    { stdio: 'ignore' }
  );
}

export async function createVM(opts: {
  id: string;
  name: string;
  osId: string;
  cpus: number;
  ram: number;
  storage: number;
  username: string;
  password: string;
}): Promise<void> {
  const vmDir = path.join(VMS_DIR, opts.id);
  fs.mkdirSync(vmDir, { recursive: true });

  const baseImage = getImagePath(opts.osId);
  const diskPath = path.join(vmDir, 'disk.qcow2');

  // Create a disk backed by the base cloud image, resized to desired storage
  execSync(
    `qemu-img create -f qcow2 -b ${baseImage} -F qcow2 ${diskPath} ${opts.storage}G`,
    { stdio: 'ignore' }
  );

  createCloudInitDisk(vmDir, opts.username, opts.password, `vm-${opts.id.slice(0, 8)}`);
}

export function startVM(vmId: string): void {
  const db = getDB();
  const vm = db.prepare('SELECT * FROM vms WHERE id = ?').get(vmId) as {
    id: string; cpus: number; ram: number; vnc_display: number | null; ws_port: number | null;
    pid: number | null; status: string;
  } | undefined;

  if (!vm) throw new Error('VM not found');
  if (vm.status === 'running') throw new Error('VM already running');

  const vmDir = path.join(VMS_DIR, vmId);
  const diskPath = path.join(vmDir, 'disk.qcow2');
  const seedPath = path.join(vmDir, 'seed.img');

  const { vncDisplay, wsPort } = vm.vnc_display
    ? { vncDisplay: vm.vnc_display, wsPort: vm.ws_port! }
    : allocatePorts();

  const kvmAvailable = fs.existsSync('/dev/kvm');
  const args = [
    '-machine', kvmAvailable ? 'type=q35,accel=kvm' : 'type=q35',
    '-cpu', kvmAvailable ? 'host' : 'qemu64',
    '-smp', String(vm.cpus),
    '-m', String(vm.ram),
    '-drive', `file=${diskPath},format=qcow2,if=virtio`,
    '-drive', `file=${seedPath},format=raw,if=virtio`,
    '-netdev', 'user,id=net0',
    '-device', 'virtio-net-pci,netdev=net0',
    '-vnc', `127.0.0.1:${vncDisplay},websocket=${wsPort}`,
    '-no-reboot',
  ];

  const logFile = fs.openSync(path.join(vmDir, 'qemu.log'), 'w');
  const errFile = fs.openSync(path.join(vmDir, 'qemu.err'), 'w');

  const proc = spawn('qemu-system-x86_64', args, {
    detached: true,
    stdio: ['ignore', logFile, errFile],
  });
  proc.unref();

  db.prepare(`
    UPDATE vms SET status='running', pid=?, vnc_display=?, ws_port=? WHERE id=?
  `).run(proc.pid, vncDisplay, wsPort, vmId);
}

export function stopVM(vmId: string, force = false): void {
  const db = getDB();
  const vm = db.prepare('SELECT pid FROM vms WHERE id = ?').get(vmId) as { pid: number | null } | undefined;
  if (!vm?.pid) throw new Error('VM not running');

  try {
    process.kill(vm.pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    // process already gone
  }

  db.prepare("UPDATE vms SET status='stopped', pid=NULL WHERE id=?").run(vmId);
}

export function isVMRunning(vmId: string): boolean {
  const db = getDB();
  const vm = db.prepare('SELECT pid FROM vms WHERE id = ?').get(vmId) as { pid: number | null } | undefined;
  if (!vm?.pid) return false;
  try {
    process.kill(vm.pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function deleteVM(vmId: string): void {
  const db = getDB();
  const vm = db.prepare('SELECT pid, status FROM vms WHERE id = ?').get(vmId) as {
    pid: number | null; status: string;
  } | undefined;

  if (!vm) throw new Error('VM not found');
  if (vm.status === 'running' && vm.pid) {
    try { process.kill(vm.pid, 'SIGKILL'); } catch { /* already gone */ }
  }

  const vmDir = path.join(VMS_DIR, vmId);
  if (fs.existsSync(vmDir)) fs.rmSync(vmDir, { recursive: true });

  db.prepare('DELETE FROM vms WHERE id=?').run(vmId);
}

export function proxyConsole(vmId: string, clientWs: WebSocket): void {
  const db = getDB();
  const vm = db.prepare('SELECT ws_port, status FROM vms WHERE id = ?').get(vmId) as {
    ws_port: number | null; status: string;
  } | undefined;

  if (!vm?.ws_port || vm.status !== 'running') {
    clientWs.close(1011, 'VM not running');
    return;
  }

  // QEMU exposes a WebSocket VNC server; proxy frames directly
  const qemuWs = new WebSocket(`ws://127.0.0.1:${vm.ws_port}`);

  qemuWs.on('open', () => {
    clientWs.on('message', (data, isBinary) => {
      if (qemuWs.readyState === WebSocket.OPEN) qemuWs.send(data, { binary: isBinary });
    });
    qemuWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary });
    });
  });

  const cleanup = () => {
    if (qemuWs.readyState === WebSocket.OPEN) qemuWs.close();
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  };

  qemuWs.on('close', cleanup);
  qemuWs.on('error', cleanup);
  clientWs.on('close', cleanup);
  clientWs.on('error', cleanup);
}
