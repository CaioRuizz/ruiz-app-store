import { Router, Request, Response } from 'express';
import { OS_LIST, isImageDownloaded, getDownloadProgress, downloadImage } from '../vms';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const list = OS_LIST.map(os => ({
    ...os,
    downloaded: isImageDownloaded(os.id),
    downloadProgress: getDownloadProgress(os.id),
  }));
  res.json(list);
});

router.post('/:id/download', async (req: Request, res: Response) => {
  const os = OS_LIST.find(o => o.id === req.params.id);
  if (!os) return res.status(404).json({ error: 'Unknown OS' });

  if (isImageDownloaded(os.id)) {
    return res.json({ status: 'already_downloaded' });
  }

  // Start download in background
  downloadImage(os.id).catch(err => console.error(`Download failed for ${os.id}:`, err));
  res.json({ status: 'downloading' });
});

router.get('/:id/progress', (req: Request, res: Response) => {
  const os = OS_LIST.find(o => o.id === req.params.id);
  if (!os) return res.status(404).json({ error: 'Unknown OS' });
  res.json({
    downloaded: isImageDownloaded(os.id),
    progress: getDownloadProgress(os.id),
  });
});

export default router;
