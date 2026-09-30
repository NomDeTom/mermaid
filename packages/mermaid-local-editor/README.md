# Mermaid Local Editor

Standalone local editor for Mermaid diagrams.
Runs entirely from `dist/` with no external dependencies.

---

## Usage

```sh
pnpm build:mermaid:full
```

---

## Build Pipeline

The `build:mermaid:full` command performs the following steps:

1. **Clean**

   Removes the existing build output:

   ```sh
   pnpm clean
   ```

2. **Build Mermaid**

   Compiles Mermaid using the repository build pipeline:

   ```sh
   pnpm build:mermaid
   ```

3. **Copy Editor**

   Copies the local editor sources into the distribution directory:

   ```sh
   pnpm copy:editor
   ```

4. **Bundle Dependencies**

   Copies required runtime dependencies into the editor bundle:

   ```sh
   pnpm copy:mermaid
   pnpm copy:dompurify
   ```

5. **Serve**

   Starts a local static server:

   ```sh
   pnpm serve:dist
   ```

---

## Output

After build, the editor is available at [`packages/mermaid/dist/mermaid-local-editor/`](../mermaid/dist/mermaid-local-editor):

---

## Notes

- No external CDN dependencies are used
- DOMPurify is bundled locally
- The editor is fully offline-capable
- Designed to run directly from the `dist/` directory

## Optional storage backend

By default, diagrams are saved to the browser's `localStorage` only. To also persist them to disk
(so they survive across browsers/machines), start the optional backend from
[`mermaid-storage-backend`](../mermaid-storage-backend):

```sh
pnpm serve:storage
```

The editor auto-detects it at `http://localhost:8082` on load and in the background afterward
(retried every 15s while offline) — no configuration needed if you run it on the default port.
Point the editor at a different backend with `?storageUrl=http://host:port` (remembered after
the first visit via `localStorage`).

`localStorage` always stays the fast, offline-first read/write path — the backend is a mirror
that's synced to opportunistically, with last-write-wins conflict resolution by timestamp. If the
backend is unreachable, the editor works exactly as it did before, with no errors or blocking.
The toolbar's status dot reflects the current state: grey **Local only**, amber **Syncing…**,
green **Synced**.
