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

    // Força buffer mínimo possível
    if (audioCtx.baseLatency !== undefined) {
      console.log('Latência base:', Math.round(audioCtx.baseLatency * 1000) + 'ms');
    }
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

// ── Filtros individuais (recebem e retornam nó) ────────────
function applyGain(node) {
  gainNode = audioCtx.createGain();
  gainNode.gain.value = volumeControl.getValue();
  node.connect(gainNode);
  return gainNode;
}

function applyHighpass(node) {
  hpFilter = audioCtx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 120;
  hpFilter.Q.value = 0.7;
  node.connect(hpFilter);
  return hpFilter;
}

function applyGate(node) {
  gateNode = audioCtx.createAnalyser();
  gateNode.fftSize = 256;
  gateGain = audioCtx.createGain();
  gateGain.gain.value = 1;
  node.connect(gateNode);
  node.connect(gateGain);
  startGate();
  return gateGain;
}

function applyCompressor(node) {
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  node.connect(compressor);
  return compressor;
}

// ── Cadeia de processamento ────────────────────────────────
function buildProcessingChain() {
  const { highpass, gate, compressor: useComp } = settingsSheet.getSettings();

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;

  let node = sourceNode;
  if (highpass) node = applyHighpass(node);
  if (gate)     node = applyGate(node);
  node = applyGain(node);
  gainNode.connect(analyser);
  if (useComp)  node = applyCompressor(gainNode);

  return node;
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

// ── Áudio silencioso (mantém contexto ativo no iOS) ───────
let silentSource = null;

function startSilentAudio() {
  if (silentSource || !audioCtx) return;
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  silentSource = audioCtx.createBufferSource();
  silentSource.buffer = buffer;
  silentSource.loop = true;
  silentSource.connect(audioCtx.destination);
  silentSource.start();
}

function stopSilentAudio() {
  if (silentSource) {
    silentSource.stop();
    silentSource.disconnect();
    silentSource = null;
  }
}

// ── Iniciar monitoramento ──────────────────────────────────
async function startMonitor() {
  const outputNode = buildProcessingChain();
  const { outputId, outputLabel } = settingsSheet.getSettings();

  // Se há saída específica selecionada, usa setSinkId via Audio element
  // Senão, conecta direto no audioCtx.destination — menor latência
  if (outputId && typeof HTMLAudioElement.prototype.setSinkId === 'function') {
    const dest = audioCtx.createMediaStreamDestination();
    outputNode.connect(dest);

    audioEl = new Audio();
    audioEl.srcObject = dest.stream;
    audioEl.muted = false;
    try { await audioEl.setSinkId(outputId); } catch (e) {}
    await audioEl.play();
  } else {
    // Caminho direto — sem MediaStreamDestination, sem Audio element
    outputNode.connect(audioCtx.destination);
    audioEl = null;
  }
  await requestWakeLock();
  startSilentAudio();

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
  stopSilentAudio();

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
