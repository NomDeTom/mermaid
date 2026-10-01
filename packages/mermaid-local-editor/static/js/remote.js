// Optional mirror of this editor's diagrams on an Irate-Box hub's store.py, through its
// named-save API (/api/saves) -- the same gallery the hub's Excalidraw and Mermaid live
// editor save into. There is no separate storage server to run.
//
// Where the hub is: ?storageUrl=http://<hub> (remembered), else this page's own origin when
// it is served over HTTP (as on the hub itself), else nowhere -- the editor stays local-only.

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

export function createRemote() {
  const baseUrl = resolveBackendUrl();
  const savesUrl = `${baseUrl}/api/saves`;

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
      diagrams[save.name] = {
        src: save.state.src,
        view: save.state.view ?? { scale: 1, panX: 0, panY: 0 },
        updatedAt: received - Math.max(0, now - save.created) * 1000,
      };
    }
    return diagrams;
  }

  async function put(name, entry) {
    const res = await fetch(savesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: idFor(name),
        kind: KIND,
        name,
        state: { src: entry.src, view: entry.view },
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      throw new Error(`put failed: ${res.status}`);
    }
  }

  async function del(name) {
    const res = await fetch(`${savesUrl}/${idFor(name)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`delete failed: ${res.status}`);
    }
  }

  return { baseUrl, ping, fetchAll, put, del };
}
