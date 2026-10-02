/* global mermaid */

export const IS_E2E = navigator.webdriver || location.search.includes('graph=');

export function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict',
    deterministicIds: true,
    fontFamily: 'Arial',
    htmlLabels: false,
    flowchart: {
      useMaxWidth: false,
    },
    // Without this, mermaid swallows render-time errors and draws its own
    // generic "Syntax error in text" placeholder instead of throwing, so
    // renderer.js's catch block never sees the real error message.
    suppressErrorRendering: true,
  });
}

export let state = {
  scale: 1,
  panX: 0,
  panY: 0,
  iframeRef: null,
};
