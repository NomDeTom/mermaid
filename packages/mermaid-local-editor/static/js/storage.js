import { createRemote } from './remote.js';

// Local storage is always the source of truth for instant reads/writes.
// The remote backend (if reachable) is a durable mirror: pushed to in the
// background on every change, and merged in on sync using last-write-wins
// by `updatedAt`, so it never blocks or flickers the UI.
export function createStorage({ onStatusChange } = {}) {
  let diagrams = JSON.parse(localStorage.getItem('mermaid-diagrams') || '{}');
  let current = localStorage.getItem('mermaid-current') || 'main';
  const remote = createRemote();
  let status = 'offline'; // 'offline' | 'syncing' | 'synced' | 'locked' (another device holds a lock)

  function setStatus(next) {
    status = next;
    onStatusChange?.(status);
  }

  if (!diagrams[current]) {
    diagrams[current] = {
      src: `flowchart LR\n  UI --> RuntimeBus --> Orchestrator --> Agents`,
      view: { scale: 1, panX: 0, panY: 0 },
      updatedAt: 0,
    };
  }

  function persistLocal() {
    localStorage.setItem('mermaid-diagrams', JSON.stringify(diagrams));
    localStorage.setItem('mermaid-current', current);
  }

  function pushRemote(name) {
    if (status === 'offline') {
      return;
    }
    remote.put(name, diagrams[name]).then(
      () => setStatus('synced'),
      (err) => setStatus(err?.locked ? 'locked' : 'offline')
    );
  }

  function deleteRemote(name) {
    if (status === 'offline') {
      return;
    }
    remote.del(name).then(
      () => setStatus('synced'),
      (err) => setStatus(err?.locked ? 'locked' : 'offline')
    );
  }

  async function syncFromRemote(onMerged) {
    setStatus('syncing');

    if (!(await remote.ping())) {
      setStatus('offline');
      return;
    }

    try {
      const remoteDiagrams = await remote.fetchAll();
      let changed = false;

      for (const [name, remoteEntry] of Object.entries(remoteDiagrams)) {
        const localEntry = diagrams[name];
        if (!localEntry || (remoteEntry.updatedAt ?? 0) > (localEntry.updatedAt ?? 0)) {
          diagrams[name] = remoteEntry;
          changed = true;
        }
      }

      setStatus('synced');

      // Anything newer locally (including diagrams the remote has never seen)
      // gets pushed up now that we know the backend is reachable.
      for (const [name, localEntry] of Object.entries(diagrams)) {
        const remoteEntry = remoteDiagrams[name];
        if (!remoteEntry || (localEntry.updatedAt ?? 0) > (remoteEntry.updatedAt ?? 0)) {
          pushRemote(name);
        }
      }

      if (changed) {
        if (!diagrams[current]) {
          current = Object.keys(diagrams)[0] || 'main';
        }
        persistLocal();
        onMerged?.();
      }
    } catch {
      setStatus('offline');
    }
  }

  return {
    get diagrams() {
      return diagrams;
    },
    get current() {
      return current;
    },
    get status() {
      return status;
    },

    setCurrent(name) {
      current = name;
      persistLocal();
    },

    updateCurrent(data) {
      diagrams[current] = { ...diagrams[current], ...data, updatedAt: Date.now() };
      persistLocal();
      pushRemote(current);
    },

    deleteCurrent() {
      const name = current;
      delete diagrams[name];
      current = Object.keys(diagrams)[0] || 'main';
      persistLocal();
      deleteRemote(name);
    },

    create(name) {
      diagrams[name] = {
        src: 'flowchart LR\n  A --> B',
        view: { scale: 1, panX: 0, panY: 0 },
        updatedAt: Date.now(),
      };
      current = name;
      persistLocal();
      pushRemote(name);
    },

    syncFromRemote,

    // The current diagram's lock on the hub: 'none' | 'mine' | 'other'.
    lockState(name = current) {
      return remote.lockState(name);
    },

    // Lock or unlock a diagram on the hub. Needs the hub; resolves to the new lock state.
    async setLocked(name, on) {
      if (status === 'offline' || !diagrams[name]) {
        throw new Error('the hub is not reachable');
      }
      const result = await remote.setLocked(name, diagrams[name], on);
      setStatus('synced');
      return result;
    },
  };
}
