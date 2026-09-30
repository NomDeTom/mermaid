export function computeFitTransform({ svgEl, containerWidth, containerHeight, margin = 0.92 }) {
  const vb = svgEl.viewBox?.baseVal;
  let contentWidth = vb?.width;
  let contentHeight = vb?.height;

  if (!contentWidth || !contentHeight) {
    const bbox = svgEl.getBBox();
    contentWidth = bbox.width;
    contentHeight = bbox.height;
  }

  if (!contentWidth || !contentHeight || !containerWidth || !containerHeight) {
    return { scale: 1, panX: 0, panY: 0 };
  }

  const scale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight) * margin;

  return {
    scale,
    panX: (containerWidth - contentWidth * scale) / 2,
    panY: (containerHeight - contentHeight * scale) / 2,
  };
}

// A diagram whose view has never been fit or manually adjusted still has the
// storage-default {scale:1, panX:0, panY:0}. Once fitToView (or a user zoom/pan)
// runs, the scale essentially never lands back on exactly 1 with no pan, so this
// stays a reliable one-shot trigger with no extra persisted flag needed.
export function isUnsetView({ scale, panX, panY }) {
  return scale === 1 && panX === 0 && panY === 0;
}

export function fitToView({ state, preview, applyTransform }) {
  const svgEl = state.iframeRef?.contentDocument?.querySelector('svg');
  if (!svgEl) {
    return;
  }

  const rect = preview.getBoundingClientRect();
  const fit = computeFitTransform({
    svgEl,
    containerWidth: rect.width,
    containerHeight: rect.height,
  });

  state.scale = fit.scale;
  state.panX = fit.panX;
  state.panY = fit.panY;

  applyTransform();
}

export function zoomBy({ state, preview, applyTransform, factor, min = 0.02, max = 8 }) {
  if (!state.iframeRef) {
    return;
  }

  const rect = preview.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const nextScale = Math.min(Math.max(state.scale * factor, min), max);

  // Keep the pane's center point fixed in content-space while scaling around it.
  state.panX = cx - (cx - state.panX) * (nextScale / state.scale);
  state.panY = cy - (cy - state.panY) * (nextScale / state.scale);
  state.scale = nextScale;

  applyTransform();
}
