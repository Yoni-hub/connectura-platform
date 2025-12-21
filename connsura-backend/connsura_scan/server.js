// Simple local server to host the scanner and accept mobile uploads.
// Uses only open-source packages (express, multer) already in the repo.

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const PORT = process.env.PORT || 5080;
const HOST = process.env.HOST || '127.0.0.1';

let lastUpload = null;

function getLanHosts() {
  const nets = os.networkInterfaces();
  const addrs = [];
  Object.values(nets).forEach((ifaces = []) => {
    ifaces.forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        addrs.push(net.address);
      }
    });
  });
  return addrs;
}

app.use(express.static(path.join(__dirname)));

app.post('/api/upload', upload.single('license'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });
  lastUpload = {
    buffer: req.file.buffer,
    mimetype: req.file.mimetype || 'image/jpeg',
    originalname: req.file.originalname || 'license.jpg',
    receivedAt: new Date().toISOString(),
  };
  res.json({ ok: true, receivedAt: lastUpload.receivedAt });
});

app.get('/api/last-upload', (req, res) => {
  if (!lastUpload) return res.json({ ok: true, hasImage: false });
  const base64 = lastUpload.buffer.toString('base64');
  const dataUrl = `data:${lastUpload.mimetype};base64,${base64}`;
  res.json({
    ok: true,
    hasImage: true,
    mimetype: lastUpload.mimetype,
    filename: lastUpload.originalname,
    receivedAt: lastUpload.receivedAt,
    dataUrl,
  });
});

app.get('/api/host-info', (req, res) => {
  res.json({ ok: true, port: PORT, hosts: getLanHosts() });
});

app.listen(PORT, HOST, () => {
  console.log(`Connsura Scan server running at http://${HOST}:${PORT}`);
  console.log('Open this URL on PC, then scan the QR code with your phone to upload a photo.');
});
