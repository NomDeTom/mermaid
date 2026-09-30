import { createRemote } from './remote.js';

// Local storage is always the source of truth for instant reads/writes.
// The remote backend (if reachable) is a durable mirror: pushed to in the
// background on every change, and merged in on sync using last-write-wins
// by `updatedAt`, so it never blocks or flickers the UI.
export function createStorage({ onStatusChange } = {}) {
  let diagrams = JSON.parse(localStorage.getItem('mermaid-diagrams') || '{}');
  let current = localStorage.getItem('mermaid-current') || 'main';
  const remote = createRemote();
  let status = 'offline'; // 'offline' | 'syncing' | 'synced'

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
      () => setStatus('offline')
    );
  }

  function deleteRemote(name) {
    if (status === 'offline') {
      return;
    }
    remote.del(name).then(
      () => setStatus('synced'),
      () => setStatus('offline')
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
  };
}
