import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import {
  createVM, startVM, stopVM, deleteVM, isVMRunning,
  downloadImage, isImageDownloaded,
} from '../vms';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const vms = getDB().prepare('SELECT * FROM vms ORDER BY created_at DESC').all();
  // Sync running status
  const db = getDB();
  (vms as { id: string; pid: number | null; status: string }[]).forEach(vm => {
    if (vm.status === 'running' && !isVMRunning(vm.id)) {
      db.prepare("UPDATE vms SET status='stopped', pid=NULL WHERE id=?").run(vm.id);
      (vm as { status: string }).status = 'stopped';
    }
  });
  res.json(vms);
});

router.get('/:id', (req: Request, res: Response) => {
  const vm = getDB().prepare('SELECT * FROM vms WHERE id=?').get(req.params.id);
  if (!vm) return res.status(404).json({ error: 'Not found' });
  res.json(vm);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, osId, cpus, ram, storage, username = 'admin', password = 'changeme' } = req.body;

  if (!name || !osId || !cpus || !ram || !storage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!isImageDownloaded(osId)) {
    return res.status(400).json({ error: 'OS image not yet downloaded. Download it first.' });
  }

  const id = uuidv4();
  const db = getDB();
  db.prepare(`
    INSERT INTO vms (id, name, os_id, cpus, ram, storage, username, password, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'creating')
  `).run(id, name, osId, cpus, ram, storage, username, password);

  try {
    await createVM({ id, name, osId, cpus, ram, storage, username, password });
    db.prepare("UPDATE vms SET status='stopped' WHERE id=?").run(id);
    res.status(201).json(db.prepare('SELECT * FROM vms WHERE id=?').get(id));
  } catch (err: unknown) {
    db.prepare("UPDATE vms SET status='error' WHERE id=?").run(id);
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/start', (req: Request, res: Response) => {
  try {
    startVM(req.params.id);
    res.json({ status: 'running' });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/stop', (req: Request, res: Response) => {
  try {
    stopVM(req.params.id, req.query.force === '1');
    res.json({ status: 'stopped' });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    deleteVM(req.params.id);
    res.json({ deleted: true });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
