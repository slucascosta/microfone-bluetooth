import { applyGain, applyHighpass, applyGate, applyCompressor } from './filters.js';

// ── Estado interno ─────────────────────────────────────────
let audioCtx    = null;
let sourceNode  = null;
let gainNode    = null;
let analyser    = null;
let stream      = null;
let animId      = null;
let audioEl     = null;
let gateInterval = null;
let gateNodes   = null;
let silentSource = null;
let wakeLock    = null;

// ── Callbacks para o app.js ────────────────────────────────
let onStart  = null;
let onStop   = null;
let onStatus = null;
let onFrame  = null;

export function init({ onStart: s, onStop: p, onStatus: st, onFrame: f }) {
  onStart  = s;
  onStop   = p;
  onStatus = st;
  onFrame  = f;
}

// ── Wake Lock ──────────────────────────────────────────────
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

document.addEventListener('visibilitychange', async () => {
  if (isRunning() && document.visibilityState === 'visible') await requestWakeLock();
});

// ── Áudio silencioso (mantém iOS ativo) ───────────────────
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

// ── Stream do microfone ────────────────────────────────────
export async function ensureStream(inputId) {
  if (stream) return true;
  try {
    onStatus?.('Solicitando permissão...', '');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: inputId ? { deviceId: { exact: inputId } } : true
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
    await audioCtx.resume();
    sourceNode = audioCtx.createMediaStreamSource(stream);
    return true;
  } catch (err) {
    onStatus?.(
      err.name === 'NotAllowedError'
        ? 'Permissão negada — libere o microfone nas configurações.'
        : 'Erro: ' + err.message,
      'err'
    );
    return false;
  }
}

// ── Cadeia de processamento ────────────────────────────────
function buildProcessingChain(settings) {
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;

  let node = sourceNode;
  if (settings.highpass) node = applyHighpass(audioCtx, node);
  if (settings.gate)     node = applyGate(audioCtx, node, (g) => { gateNodes = g; gateInterval = g.interval; });
  node = applyGain(audioCtx, node, settings.gainValue);
  gainNode = node;
  gainNode.connect(analyser);
  if (settings.compressor) node = applyCompressor(audioCtx, gainNode);

  return node;
}

// ── Iniciar monitoramento ──────────────────────────────────
export async function startMonitor(settings) {
  const outputNode = buildProcessingChain(settings);

  if (settings.outputId && typeof HTMLAudioElement.prototype.setSinkId === 'function') {
    const dest = audioCtx.createMediaStreamDestination();
    outputNode.connect(dest);
    audioEl = new Audio();
    audioEl.srcObject = dest.stream;
    audioEl.muted = false;
    try { await audioEl.setSinkId(settings.outputId); } catch (e) {}
    await audioEl.play();
  } else {
    outputNode.connect(audioCtx.destination);
    audioEl = null;
  }

  await requestWakeLock();
  startSilentAudio();
  onStart?.();
  drawBars();
}

// ── Reconstruir cadeia ─────────────────────────────────────
export async function rebuildChain(settings) {
  clearGate();
  if (audioEl) { audioEl.pause(); audioEl.srcObject = null; audioEl = null; }
  try { sourceNode.disconnect(); } catch (e) {}
  await startMonitor(settings);
}

// ── Parar monitoramento ────────────────────────────────────
export function stopMonitor() {
  clearGate();
  if (audioEl) { audioEl.pause(); audioEl.srcObject = null; audioEl = null; }
  if (animId)  cancelAnimationFrame(animId);
  if (stream)  stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();

  releaseWakeLock();
  stopSilentAudio();

  stream = null; audioCtx = null; sourceNode = null;
  gainNode = null; analyser = null; gateNodes = null;
  animId = null; audioEl = null;

  onStop?.();
}

// ── Atualizar gain em tempo real ───────────────────────────
export function setGain(value) {
  if (gainNode) gainNode.gain.value = value;
}

export function isRunning() {
  return !!stream;
}

// ── Helpers internos ───────────────────────────────────────
function clearGate() {
  if (gateInterval) { clearInterval(gateInterval); gateInterval = null; }
  gateNodes = null;
}

function drawBars() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  onFrame?.(data);
  animId = requestAnimationFrame(drawBars);
}
