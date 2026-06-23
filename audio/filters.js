// ── Filtros de áudio ───────────────────────────────────────
// Cada função recebe um AudioNode de entrada,
// conecta o filtro e retorna o nó de saída.

export function applyGain(ctx, node, value) {
  const gainNode = ctx.createGain();
  gainNode.gain.value = value;
  node.connect(gainNode);
  return gainNode;
}

export function applyHighpass(ctx, node) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 120;
  filter.Q.value = 0.7;
  node.connect(filter);
  return filter;
}

export function applyGate(ctx, node, onGateNode) {
  const gateAnalyser = ctx.createAnalyser();
  gateAnalyser.fftSize = 256;
  const gateGain = ctx.createGain();
  gateGain.gain.value = 1;
  node.connect(gateAnalyser);
  node.connect(gateGain);

  // Inicia o loop de controle do gate
  const buf = new Uint8Array(gateAnalyser.fftSize);
  const threshold = 0.015;
  const attack = 0.008, release = 0.12;
  let open = false;

  const interval = setInterval(() => {
    gateAnalyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs((buf[i] - 128) / 128);
      if (v > peak) peak = v;
    }
    const shouldOpen = peak > threshold;
    if (shouldOpen !== open) {
      open = shouldOpen;
      const now = ctx.currentTime;
      gateGain.gain.cancelScheduledValues(now);
      gateGain.gain.setTargetAtTime(open ? 1 : 0, now, open ? attack : release);
    }
  }, 16);

  // Passa o interval para o caller poder limpar
  onGateNode({ gateAnalyser, gateGain, interval });

  return gateGain;
}

export function applyCompressor(ctx, node) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  node.connect(comp);
  return comp;
}
