import cors from 'cors';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const PORT = Number(process.env.MERMAID_STORAGE_PORT) || 8082;
const DATA_DIR = process.env.MERMAID_STORAGE_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'diagrams.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '{}');
  }
}

// Serializes reads/writes so concurrent requests can't interleave a
// read-modify-write and corrupt the file.
let writeQueue = Promise.resolve();
function withLock(fn) {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readAll() {
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(raw || '{}');
}

async function writeAll(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/diagrams', async (_req, res, next) => {
  try {
    res.json(await withLock(readAll));
  } catch (err) {
    next(err);
  }
});

app.put('/api/diagrams/:name', async (req, res, next) => {
  const { name } = req.params;
  const { src, view, updatedAt } = req.body ?? {};

  if (typeof src !== 'string') {
    return res.status(400).json({ error: 'src must be a string' });
  }

  const entry = {
    src,
    view: view ?? { scale: 1, panX: 0, panY: 0 },
    updatedAt: updatedAt ?? Date.now(),
  };

  try {
    await withLock(async () => {
      const data = await readAll();
      data[name] = entry;
      await writeAll(data);
    });
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/diagrams/:name', async (req, res, next) => {
  const { name } = req.params;

  try {
    const existed = await withLock(async () => {
      const data = await readAll();
      const had = name in data;
      delete data[name];
      await writeAll(data);
      return had;
    });
    res.status(existed ? 204 : 404).end();
  } catch (err) {
    next(err);
  }
});

await ensureStore();
app.listen(PORT, () => {
  console.log(`Mermaid storage backend listening on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
