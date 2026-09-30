const DEFAULT_BACKEND_URL = 'http://localhost:8082';
const STORAGE_URL_KEY = 'mermaid-storage-url';

function resolveBackendUrl() {
  const fromQuery = new URLSearchParams(location.search).get('storageUrl');
  if (fromQuery) {
    localStorage.setItem(STORAGE_URL_KEY, fromQuery);
    return fromQuery;
  }
  return localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_BACKEND_URL;
}

export function createRemote() {
  const baseUrl = resolveBackendUrl();

  async function ping() {
    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function fetchAll() {
    const res = await fetch(`${baseUrl}/api/diagrams`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      throw new Error(`fetchAll failed: ${res.status}`);
    }
    return res.json();
  }

  async function put(name, entry) {
    const res = await fetch(`${baseUrl}/api/diagrams/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      throw new Error(`put failed: ${res.status}`);
    }
  }

  async function del(name) {
    const res = await fetch(`${baseUrl}/api/diagrams/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`delete failed: ${res.status}`);
    }
  }

  return { baseUrl, ping, fetchAll, put, del };
}
