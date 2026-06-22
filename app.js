import './components/mic-button.js';
import './components/audio-visualizer.js';
import './components/volume-control.js';
import './components/settings-sheet.js';

// ── Elementos ──────────────────────────────────────────────
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

// ── Estado de áudio ────────────────────────────────────────
let audioCtx    = null;
let sourceNode  = null;
let gainNode    = null;
let analyser    = null;
let stream      = null;
let animId      = null;
let audioEl     = null;
let running     = false;
let hpFilter    = null;
let compressor  = null;
let gateNode    = null;
let gateGain    = null;
let gateInterval = null;

// ── Eventos dos componentes ────────────────────────────────
micBtn.addEventListener('mic-click', async () => {
  running ? stopMonitor() : (await ensureStream() && startMonitor());
});

volumeControl.addEventListener('volume-change', (e) => {
  if (gainNode) gainNode.gain.value = e.detail.value;
});

advBtn.addEventListener('click', () => settingsSheet.open());

settingsSheet.addEventListener('settings-change', () => {
  if (running) rebuildChain();
});

// ── Wake Lock ──────────────────────────────────────────────
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

document.addEventListener('visibilitychange', async () => {
  if (running && document.visibilityState === 'visible') await requestWakeLock();
});

// ── Stream do microfone ────────────────────────────────────
async function ensureStream() {
  if (stream) return true;
  try {
    setStatus('Solicitando permissão...', '');
    const { inputId } = settingsSheet.getSettings();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: inputId ? { deviceId: { exact: inputId } } : true
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
    await audioCtx.resume();
    sourceNode = audioCtx.createMediaStreamSource(stream);
    visualizer.setActive(true);
    return true;
  } catch (err) {
    setStatus(
      err.name === 'NotAllowedError'
        ? 'Permissão negada — libere o microfone nas configurações.'
        : 'Erro: ' + err.message,
      'err'
    );
    return false;
  }
}

// ── Cadeia de processamento ────────────────────────────────
function buildProcessingChain() {
  const { highpass, gate, compressor: useComp } = settingsSheet.getSettings();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = volumeControl.getValue();

  hpFilter = audioCtx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 120;
  hpFilter.Q.value = 0.7;

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  gateGain = audioCtx.createGain();
  gateGain.gain.value = 1;

  gateNode = audioCtx.createAnalyser();
  gateNode.fftSize = 256;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;

  // source → [hp?] → [gate?] → gain → [comp?] → saída
  let node = sourceNode;

  if (highpass) {
    node.connect(hpFilter);
    node = hpFilter;
  }

  if (gate) {
    node.connect(gateNode);
    node.connect(gateGain);
    node = gateGain;
    startGate();
  }

  node.connect(gainNode);
  gainNode.connect(analyser);

  if (useComp) {
    gainNode.connect(compressor);
    return compressor;
  }

  return gainNode;
}

// ── Gate de ruído ──────────────────────────────────────────
function startGate() {
  const buf = new Uint8Array(gateNode.fftSize);
  const threshold = 0.015;
  const attack = 0.008, release = 0.12;
  let open = false;

  if (gateInterval) clearInterval(gateInterval);

  gateInterval = setInterval(() => {
    if (!gateNode || !gateGain) return;
    gateNode.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs((buf[i] - 128) / 128);
      if (v > peak) peak = v;
    }
    const shouldOpen = peak > threshold;
    if (shouldOpen !== open) {
      open = shouldOpen;
      const now = audioCtx.currentTime;
      gateGain.gain.cancelScheduledValues(now);
      gateGain.gain.setTargetAtTime(open ? 1 : 0, now, open ? attack : release);
    }
  }, 16);
}

// ── Iniciar monitoramento ──────────────────────────────────
async function startMonitor() {
  const outputNode = buildProcessingChain();
  const { outputId, outputLabel } = settingsSheet.getSettings();

  const dest = audioCtx.createMediaStreamDestination();
  outputNode.connect(dest);
  outputNode.connect(audioCtx.destination);

  audioEl = new Audio();
  audioEl.srcObject = dest.stream;
  audioEl.muted = false;

  if (outputId && typeof audioEl.setSinkId === 'function') {
    try { await audioEl.setSinkId(outputId); } catch (e) {}
  }

  await audioEl.play();
  await requestWakeLock();

  running = true;
  micBtn.setActive(true);
  setStatus('Monitorando — ' + outputLabel, 'on');
  drawBars();
}

// ── Reconstruir cadeia ─────────────────────────────────────
function rebuildChain() {
  if (gateInterval) { clearInterval(gateInterval); gateInterval = null; }
  if (audioEl) { audioEl.pause(); audioEl.srcObject = null; audioEl = null; }
  try { sourceNode.disconnect(); } catch (e) {}
  startMonitor();
}

// ── Parar monitoramento ────────────────────────────────────
function stopMonitor() {
  if (gateInterval) { clearInterval(gateInterval); gateInterval = null; }
  if (audioEl) { audioEl.pause(); audioEl.srcObject = null; audioEl = null; }
  if (animId) cancelAnimationFrame(animId);
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();

  releaseWakeLock();

  stream = null; audioCtx = null; sourceNode = null;
  gainNode = null; analyser = null; gateNode = null; gateGain = null;
  running = false;

  micBtn.setActive(false);
  visualizer.setActive(false);
  setStatus('Toque para começar', '');
}

// ── Helpers ────────────────────────────────────────────────
function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = 'status-text' + (cls ? ' ' + cls : '');
}

function drawBars() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  visualizer.update(data);
  animId = requestAnimationFrame(drawBars);
}

// ── Service Worker (PWA) ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/microfone-bluetooth/service-worker.js')
      .catch(() => {});
  });
}
