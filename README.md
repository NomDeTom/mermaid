# zim-build

This branch holds only `.github/workflows/docs-zim.yml`, which builds the mermaid.js.org
documentation into a Kiwix ZIM with [docusaurus2zim](https://github.com/NomDeTom/docusaurus2zim)
(VitePress recipe in its `examples/README.md`). It shares no history with `develop`, so pushing
here runs none of upstream's workflows.

- **Test:** push to this branch. It builds `mermaid@12.0.0` and uploads the ZIM as a run artifact.
- **Build another version or publish:** Actions → "Mermaid docs ZIM" → Run workflow, with a
  `mermaid_ref` (e.g. `mermaid@12.1.0`) and `publish` ticked. That attaches `mermaid-docs.zim`
  to a release tagged `mermaid-docs-<version>`, which an Irate-Box hub installs with
  `sudo ./install.sh --zim <asset URL>`.
