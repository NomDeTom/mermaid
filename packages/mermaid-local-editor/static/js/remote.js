// Optional mirror of this editor's diagrams on an Irate-Box hub's store.py, through its
// named-save API (/api/saves) -- the same gallery the hub's Excalidraw and Mermaid live
// editor save into. There is no separate storage server to run.
//
// Where the hub is: ?storageUrl=http://<hub> (remembered), else this page's own origin when
// it is served over HTTP (as on the hub itself), else nowhere -- the editor stays local-only.
//
// Device locks (the hub's store.py "locks", js/hublock.js): a diagram can be locked so that
// only this browser can change or delete it on the hub. No password: the browser keeps a seed
// and the hub a hash chain, so nothing reusable crosses the network. A diagram locked by
// another device still edits here, but is no longer pushed to the hub.

const STORAGE_URL_KEY = 'mermaid-storage-url';
const KIND = 'mermaid-local';

function resolveBackendUrl() {
  const fromQuery = new URLSearchParams(location.search).get('storageUrl');
  if (fromQuery) {
    localStorage.setItem(STORAGE_URL_KEY, fromQuery);
    return fromQuery.replace(/\/$/, '');
  }
  const remembered = localStorage.getItem(STORAGE_URL_KEY);
  if (remembered) {
    return remembered.replace(/\/$/, '');
  }
  return location.protocol.startsWith('http') ? location.origin : '';
}

// store.py ids are [A-Za-z0-9_-]{1,64}; diagram names are free text. A stable hash of the
// name means saving the same diagram again replaces its entry instead of adding another.
function idFor(name) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of name) {
    const c = ch.codePointAt(0);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return `mle-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export class LockedError extends Error {
  constructor(name) {
    super(`"${name}" is locked by another device on the hub`);
    this.locked = true;
  }
}

const LOCKS = 'saves'; // HubLock's kind for gallery saves, shared with the hub's other editors

export function createRemote() {
  const baseUrl = resolveBackendUrl();
  const savesUrl = `${baseUrl}/api/saves`;
  // What the hub last said about each diagram's lock: { locked, n }.
  const lockInfo = {};
  const HubLock = globalThis.HubLock;

  function noteLock(name, meta) {
    if (meta && typeof meta.locked === 'boolean') {
      lockInfo[name] = { locked: meta.locked, n: meta.lock_n };
    }
  }

  // 'none' | 'mine' (this browser holds the key) | 'other'
  function lockState(name) {
    const info = lockInfo[name];
    if (!info?.locked) {
      return 'none';
    }
    return HubLock?.has(LOCKS, idFor(name)) ? 'mine' : 'other';
  }

  // One request to change a diagram on the hub, with the lock headers it needs. On a 403
  // the hub says where the chain is (lock_n): catch up and try once more.
  async function changing(name, send, { lockNew = false } = {}) {
    const id = idFor(name);
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = {};
      let change = null;
      let fresh = null;
      if (lockInfo[name]?.locked) {
        change = HubLock?.change(LOCKS, id, lockInfo[name].n);
        if (!change) {
          throw new LockedError(name);
        }
        Object.assign(headers, change.headers);
      } else if (lockNew && HubLock) {
        fresh = HubLock.create();
        headers['X-Lock-New'] = fresh.header;
      }
      const res = await send(headers);
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.locked && typeof body.lock_n === 'number') {
          lockInfo[name] = { locked: true, n: body.lock_n };
          if (HubLock?.has(LOCKS, id) && attempt === 0) {
            continue;
          }
        }
        throw new LockedError(name);
      }
      if (res.ok) {
        change?.done();
        if (fresh) {
          HubLock.keep(LOCKS, id, fresh.seed);
        }
      }
      return res;
    }
    throw new LockedError(name);
  }

  async function ping() {
    if (!baseUrl) {
      return false;
    }
    try {
      const res = await fetch(savesUrl, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  // The hub has no wall clock, so it dates saves in its own powered-on seconds (`created`)
  // and sends its current reading (`now`). `now - created` is a true age on any clock, so
  // each is placed on this browser's timeline as `Date.now() - age`: comparable with local
  // `updatedAt` values however wrong either clock is in absolute terms.
  async function fetchAll() {
    const res = await fetch(`${savesUrl}?full=1`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      throw new Error(`fetchAll failed: ${res.status}`);
    }
    const { now, saves } = await res.json();
    const received = Date.now();
    const diagrams = {};
    for (const save of saves) {
      if (save.kind !== KIND || !save.state || typeof save.state.src !== 'string') {
        continue;
      }
      noteLock(save.name, save);
      diagrams[save.name] = {
        src: save.state.src,
        view: save.state.view ?? { scale: 1, panX: 0, panY: 0 },
        updatedAt: received - Math.max(0, now - save.created) * 1000,
      };
    }
    return diagrams;
  }

  async function put(name, entry, { lock = false } = {}) {
    const res = await changing(
      name,
      (headers) =>
        fetch(savesUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            id: idFor(name),
            kind: KIND,
            name,
            state: { src: entry.src, view: entry.view },
          }),
          signal: AbortSignal.timeout(4000),
        }),
      { lockNew: lock }
    );
    if (!res.ok) {
      throw new Error(`put failed: ${res.status}`);
    }
    noteLock(name, await res.json().catch(() => null));
  }

  async function del(name) {
    const res = await changing(name, (headers) =>
      fetch(`${savesUrl}/${idFor(name)}`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(4000),
      })
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`delete failed: ${res.status}`);
    }
    delete lockInfo[name];
    HubLock?.forget(LOCKS, idFor(name));
  }

  // Lock a diagram to this browser (saving it, so the hub has it), or unlock one it holds.
  async function setLocked(name, entry, on) {
    if (on) {
      if (lockState(name) === 'none') {
        await put(name, entry, { lock: true });
      }
      return lockState(name);
    }
    if (lockState(name) !== 'mine') {
      return lockState(name);
    }
    const res = await changing(name, (headers) =>
      fetch(`${savesUrl}/${idFor(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ unlock: true }),
        signal: AbortSignal.timeout(4000),
      })
    );
    if (!res.ok) {
      throw new Error(`unlock failed: ${res.status}`);
    }
    noteLock(name, await res.json().catch(() => null));
    HubLock?.forget(LOCKS, idFor(name));
    return lockState(name);
  }

  return { baseUrl, ping, fetchAll, put, del, lockState, setLocked };
}
