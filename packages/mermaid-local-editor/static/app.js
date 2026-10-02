import { initMermaid, state, IS_E2E } from './js/config.js';
import { createStorage } from './js/storage.js';
import { renderDiagram } from './js/renderer.js';
import { setupUI, refreshList } from './js/ui.js';
import { createNavigation } from './js/navigation.js';
import { fitToView, zoomBy } from './js/viewport.js';

initMermaid();

const srcPanel = document.getElementById('srcPanel');
const preview = document.getElementById('preview');
const diagramsSelect = document.getElementById('diagrams');
const nameInput = document.getElementById('name');
const syncStatusEl = document.getElementById('syncStatus');
const zoomLabelEl = document.getElementById('zoomLabel');

const STATUS_LABELS = {
  offline: 'Local only',
  syncing: 'Syncing…',
  synced: 'Synced',
  locked: 'Locked by another device: kept here only',
};

const lockBtn = document.getElementById('lock');

// The lock button follows the current diagram: can be locked, locked here, or locked elsewhere.
function refreshLock() {
  if (!lockBtn) {
    return;
  }
  const online = storage.status !== 'offline';
  const lock = storage.lockState();
  lockBtn.disabled = !online || lock === 'other';
  lockBtn.textContent =
    lock === 'mine' ? '🔒 Locked' : lock === 'other' ? '🔒 Locked elsewhere' : '🔓 Lock';
  lockBtn.title =
    lock === 'mine'
      ? 'Locked to this browser on the hub: only it can change or delete this diagram there. Click to unlock.'
      : lock === 'other'
        ? 'Another device locked this diagram on the hub: edits stay in this browser.'
        : online
          ? 'Lock this diagram on the hub so only this browser can change or delete it there.'
          : 'Locking needs the hub.';
}

function onStatusChange(status) {
  if (!syncStatusEl) {
    return;
  }
  syncStatusEl.dataset.status = status;
  syncStatusEl.textContent = STATUS_LABELS[status] ?? status;
  refreshLock();
}

const storage = createStorage({ onStatusChange });
const navigation = createNavigation({
  state,
  preview,
  srcPanel,
  applyTransform,
});

function render() {
  void renderDiagram({
    srcValue: srcPanel.value,
    preview,
    state,
    IS_E2E,
    applyTransform,
    rebuildNavNodes: navigation.rebuildNavNodes,
  });
}

function load(name) {
  storage.setCurrent(name);
  const d = storage.diagrams[name];

  srcPanel.value = d.src;

  // restore the view
  state.scale = d.view?.scale ?? 1;
  state.panX = d.view?.panX ?? 0;
  state.panY = d.view?.panY ?? 0;

  refreshList({ diagramsSelect, nameInput, storage });
  render();
  refreshLock();
}

function applyTransform() {
  if (!state.iframeRef) {
    return;
  }

  const svg = state.iframeRef.contentDocument?.querySelector('svg');
  if (!svg) {
    return;
  }

  state.panY = Math.max(-20000, Math.min(20000, state.panY));
  state.panX = Math.max(-20000, Math.min(20000, state.panX));

  svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;

  if (zoomLabelEl) {
    zoomLabelEl.textContent = `${Math.round(state.scale * 100)}%`;
  }

  storage.updateCurrent({
    view: { scale: state.scale, panX: state.panX, panY: state.panY },
  });
}

function fitView() {
  fitToView({ state, preview, applyTransform });
}

function zoomIn() {
  zoomBy({ state, preview, applyTransform, factor: 1.2 });
}

function zoomOut() {
  zoomBy({ state, preview, applyTransform, factor: 1 / 1.2 });
}

setupUI({
  src: srcPanel,
  diagramsSelect,
  nameInput,
  storage,
  state,
  render,
  load,
  fitView,
  zoomIn,
  zoomOut,
  refreshLock,
});

navigation.setupKeyboardNav();
load(storage.current);

function resync() {
  storage.syncFromRemote(() => {
    refreshList({ diagramsSelect, nameInput, storage });
    load(storage.current);
  });
}

resync();
setInterval(() => {
  if (storage.status === 'offline') {
    resync();
  }
}, 15000);
