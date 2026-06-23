import './components/mic-button.js';
import './components/audio-visualizer.js';
import './components/volume-control.js';
import './components/settings-sheet.js';
import { init, ensureStream, startMonitor, stopMonitor, rebuildChain, setGain, isRunning } from './audio/audio-engine.js';

// ── Elementos DOM ──────────────────────────────────────────
const micBtn        = document.getElementById('micBtn');
const visualizer    = document.getElementById('visualizer');
const volumeControl = document.getElementById('volumeControl');
const advBtn        = document.getElementById('advBtn');
const settingsSheet = document.getElementById('settingsSheet');
const statusEl      = document.getElementById('status');
const appVersion    = document.getElementById('appVersion');

// ── Versão ─────────────────────────────────────────────────
if (appVersion) {
  appVersion.textContent = window.APP_VERSION ? 'v' + window.APP_VERSION : '';
}

// ── Inicializa engine de áudio ─────────────────────────────
init({
  onStart: () => {
    const { outputLabel } = settingsSheet.getSettings();
    micBtn.setActive(true);
    visualizer.setActive(true);
    setStatus('Monitorando — ' + outputLabel, 'on');
  },
  onStop: () => {
    micBtn.setActive(false);
    visualizer.setActive(false);
    setStatus('Toque para começar', '');
  },
  onStatus: (text, cls) => setStatus(text, cls),
  onFrame: (data) => visualizer.update(data),
});

// ── Eventos dos componentes ────────────────────────────────
micBtn.addEventListener('mic-click', async () => {
  if (isRunning()) {
    stopMonitor();
  } else {
    const { inputId } = settingsSheet.getSettings();
    if (await ensureStream(inputId)) {
      visualizer.setActive(true);
      await startMonitor(getSettings());
    }
  }
});

volumeControl.addEventListener('volume-change', (e) => {
  setGain(e.detail.value);
});

advBtn.addEventListener('click', () => settingsSheet.open());

settingsSheet.addEventListener('settings-change', async () => {
  if (isRunning()) await rebuildChain(getSettings());
});

// ── Helpers ────────────────────────────────────────────────
function getSettings() {
  const s = settingsSheet.getSettings();
  return {
    ...s,
    gainValue: volumeControl.getValue(),
  };
}

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status-text' + (cls ? ' ' + cls : '');
}

// ── Service Worker (PWA) ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/microfone-bluetooth/service-worker.js')
      .catch(() => {});
  });
}
