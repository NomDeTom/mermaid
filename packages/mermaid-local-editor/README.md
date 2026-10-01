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

## Optional sync to an Irate-Box hub

By default, diagrams are saved to the browser's `localStorage` only. To also keep them on an
[Irate-Box](https://github.com/NomDeTom/irate-box) hub, so they survive across browsers and
machines, point the editor at it once:

```
…/mermaid-local-editor/?storageUrl=http://<hub address>
```

The address is remembered in `localStorage`. When the editor is served by the hub itself, no
parameter is needed: it uses its own origin. Diagrams go into the hub's named-save gallery
(`/api/saves`, kind `mermaid-local`), the same store its Excalidraw and Mermaid live editor
save into. There is no separate storage server to run.

`localStorage` always stays the fast, offline-first read/write path — the hub is a mirror that's
synced to opportunistically (on load, then every 15 s while unreachable), with last-write-wins by
age. The hub has no wall clock, so it reports each save's age in its own powered-on seconds, and
the editor compares ages rather than absolute times: correct however wrong either clock is. If
the hub is unreachable, the editor works exactly as before, with no errors or blocking. The
toolbar's status dot shows the state: grey **Local only**, amber **Syncing…**, green **Synced**.

Diagram names longer than 64 characters are truncated by the hub's store.
