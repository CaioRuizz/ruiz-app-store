import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { initDB } from './db';
import vmRoutes from './routes/vms';
import imageRoutes from './routes/images';
import { proxyConsole } from './vms';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => protocols.has('binary') ? 'binary' : false,
});

app.use(cors());
app.use(express.json());
app.use('/api/vms', vmRoutes);
app.use('/api/images', imageRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

server.on('upgrade', (req, socket, head) => {
  const match = req.url?.match(/^\/api\/vms\/([^/]+)\/console$/);
  if (match) {
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      proxyConsole(match[1], ws);
    });
  } else {
    socket.destroy();
  }
});

initDB();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`VM Manager backend running on port ${PORT}`);
});
