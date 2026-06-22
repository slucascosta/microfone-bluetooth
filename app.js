// ── Estado global ──────────────────────────────────────────
let audioCtx = null, sourceNode = null, gainNode = null;
let analyser = null, stream = null, animId = null;
let audioEl = null, running = false;
let hpFilter = null, compressor = null, gateNode = null, gateGain = null;
let gateInterval = null;

// ── Elementos DOM ──────────────────────────────────────────
const btnMic     = document.getElementById('btnMic');
const micLabel   = document.getElementById('micLabel');
const statusEl   = document.getElementById('status');
const gainSlider = document.getElementById('gain');
const gainValEl  = document.getElementById('gainVal');
const inputSel   = document.getElementById('inputSelect');
const outputSel  = document.getElementById('outputSelect');
const refreshBtn = document.getElementById('refreshBtn');
const advBtn     = document.getElementById('advBtn');
const overlay    = document.getElementById('overlay');
const sheet      = document.getElementById('sheet');
const sheetClose = document.getElementById('sheetClose');
const toggleHP   = document.getElementById('toggleHP');
const toggleGate = document.getElementById('toggleGate');
const toggleComp = document.getElementById('toggleComp');
const bars = Array.from({ length: 15 }, (_, i) => document.getElementById('b' + i));

// ── Sheet ──────────────────────────────────────────────────
function openSheet()  { overlay.classList.add('open'); sheet.classList.add('open'); loadDevices(); }
function closeSheet() { overlay.classList.remove('open'); sheet.classList.remove('open'); }

advBtn.addEventListener('click', openSheet);
overlay.addEventListener('click', closeSheet);
sheetClose.addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

let touchStartY = 0;
sheet.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
sheet.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - touchStartY > 80) closeSheet();
}, { passive: true });

// ── Volume ─────────────────────────────────────────────────
gainSlider.addEventListener('input', () => {
  gainValEl.textContent = gainSlider.value + '%';
  if (gainNode) gainNode.gain.value = gainSlider.value / 100;
});

// ── Toggles ────────────────────────────────────────────────
[toggleHP, toggleGate, toggleComp].forEach(t => {
  t.addEventListener('change', () => { if (running) rebuildChain(); });
});

// ── Dispositivos ───────────────────────────────────────────
refreshBtn.addEventListener('click', loadDevices);

async function loadDevices() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs  = devices.filter(d => d.kind === 'audioinput');
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    const pIn = inputSel.value, pOut = outputSel.value;

    inputSel.innerHTML = '';
    inputs.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || 'Microfone ' + (i + 1);
      inputSel.appendChild(o);
    });
    if (pIn) inputSel.value = pIn;

    outputSel.innerHTML = '<option value="">Padrão do sistema</option>';
    outputs.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || 'Saída ' + (i + 1);
      outputSel.appendChild(o);
    });
    if (pOut) outputSel.value = pOut;
  } catch (e) {
    setStatus('Não foi possível listar dispositivos.', 'err');
  }
}

// ── Botão principal ────────────────────────────────────────
btnMic.addEventListener('click', async () => {
  running ? stopMonitor() : (await ensureStream() && startMonitor());
});

// ── Stream do microfone ────────────────────────────────────
async function ensureStream() {
  if (stream) return true;
  try {
    setStatus('Solicitando permissão...', '');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: inputSel.value ? { deviceId: { exact: inputSel.value } } : true
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
    await audioCtx.resume();
    sourceNode = audioCtx.createMediaStreamSource(stream);
    bars.forEach(b => b.classList.add('active'));
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
  gainNode = audioCtx.createGain();
  gainNode.gain.value = gainSlider.value / 100;

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

  if (toggleHP.checked) {
    node.connect(hpFilter);
    node = hpFilter;
  }

  if (toggleGate.checked) {
    node.connect(gateNode);
    node.connect(gateGain);
    node = gateGain;
    startGate();
  }

  node.connect(gainNode);
  gainNode.connect(analyser);

  if (toggleComp.checked) {
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

  const dest = audioCtx.createMediaStreamDestination();
  outputNode.connect(dest);
  outputNode.connect(audioCtx.destination);

  audioEl = new Audio();
  audioEl.srcObject = dest.stream;
  audioEl.muted = false;

  if (outputSel.value && typeof audioEl.setSinkId === 'function') {
    try { await audioEl.setSinkId(outputSel.value); } catch (e) {}
  }

  await audioEl.play();

  running = true;
  btnMic.classList.add('active-mic');
  btnMic.querySelector('.btn-icon').textContent = '⏹';
  micLabel.textContent = 'Parar';

  const out = outputSel.options[outputSel.selectedIndex]?.text || 'saída padrão';
  setStatus('Monitorando — ' + out, 'on');
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

  stream = null; audioCtx = null; sourceNode = null;
  gainNode = null; analyser = null; gateNode = null; gateGain = null;
  running = false;

  btnMic.classList.remove('active-mic');
  btnMic.querySelector('.btn-icon').textContent = '🎤';
  micLabel.textContent = 'Monitorar';
  bars.forEach(b => { b.classList.remove('active'); b.style.height = '3px'; });
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
  const step = Math.floor(data.length / bars.length);
  bars.forEach((bar, i) => {
    const h = Math.max(3, Math.round((data[i * step] / 255) * 45));
    bar.style.height = h + 'px';
  });
  animId = requestAnimationFrame(drawBars);
}

// ── Service Worker (PWA) ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/microfone-bluetooth/service-worker.js')
      .catch(() => {});
  });
}
