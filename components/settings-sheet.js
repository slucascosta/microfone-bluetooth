class SettingsSheet extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._touchStartY = 0;
  }

  connectedCallback() {
    this.render();
    this._bindEvents();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 100;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .overlay.open { opacity: 1; pointer-events: all; }

        .sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--sheet);
          border-radius: 22px 22px 0 0;
          border-top: 1px solid var(--border);
          z-index: 101;
          padding: 0 1.5rem calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          max-height: 85dvh;
          overflow-y: auto;
          pointer-events: none;
        }

        .sheet.open { transform: translateY(0); pointer-events: all; }

        @media (min-width: 600px) {
          .sheet {
            bottom: auto;
            left: 50%;
            right: auto;
            top: 50%;
            width: 380px;
            border-radius: 20px;
            border: 1px solid var(--border);
            max-height: 90vh;
            transform: translate(-50%, -40%) scale(0.96);
            opacity: 0;
            transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
            padding: 0 1.8rem 1.8rem;
          }

          .sheet.open {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }

          .handle { display: none; }
        }

        .handle {
          width: 36px;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin: 1rem auto 1.4rem;
        }

        .title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1.3rem;
          padding-top: 1.5rem;
          color: var(--text);
        }

        .section {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 1.2rem 0 0.7rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.1rem;
        }

        .field-label {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--sub);
        }

        select {
          width: 100%;
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 11px 36px 11px 14px;
          font-size: 0.88rem;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23444' d='M5 7L0 2h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        select:focus { outline: none; border-color: var(--red); }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 0.5rem;
        }

        .toggle-info { display: flex; flex-direction: column; gap: 2px; }

        .toggle-name { font-size: 0.88rem; color: var(--text); }
        .toggle-desc { font-size: 0.7rem; color: var(--sub); }

        .toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
        .toggle input { display: none; }

        .toggle-track {
          position: absolute;
          inset: 0;
          background: var(--muted);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .toggle input:checked ~ .toggle-track { background: var(--red); }

        .toggle-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff;
          border-radius: 50%;
          pointer-events: none;
          transition: left 0.2s;
        }

        .toggle input:checked ~ .toggle-track .toggle-thumb { left: 21px; }

        .refresh-btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--sub);
          font-size: 0.8rem;
          padding: 10px 18px;
          border-radius: 10px;
          cursor: pointer;
          width: 100%;
          margin-top: 0.4rem;
          transition: background 0.15s, color 0.15s;
        }

        .refresh-btn:hover  { background: #1a1a1a; color: var(--text); }
        .refresh-btn:active { background: #222; }

        .close-btn {
          background: #222;
          border: none;
          color: var(--text);
          font-size: 0.9rem;
          font-weight: 500;
          padding: 14px;
          border-radius: 14px;
          cursor: pointer;
          width: 100%;
          margin-top: 1rem;
          transition: background 0.15s;
        }

        .close-btn:hover  { background: #2a2a2a; }
        .close-btn:active { background: #333; }
      </style>

      <div class="overlay" id="overlay"></div>

      <div class="sheet" id="sheet">
        <div class="handle"></div>
        <p class="title">Configurações</p>

        <p class="section">Dispositivos</p>

        <div class="field">
          <span class="field-label">Entrada — microfone</span>
          <select id="inputSelect"><option value="">— Toque em Atualizar —</option></select>
        </div>

        <div class="field">
          <span class="field-label">Saída — fone / caixa</span>
          <select id="outputSelect"><option value="">Padrão do sistema</option></select>
        </div>

        <button class="refresh-btn" id="refreshBtn">↺ Atualizar dispositivos</button>

        <p class="section">Redução de loop</p>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">Filtro passa-alta</span>
            <span class="toggle-desc">Corta graves onde o loop se acumula</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggleHP">
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">Gate de ruído</span>
            <span class="toggle-desc">Bloqueia som abaixo do limiar da voz</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggleGate">
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-name">Compressor</span>
            <span class="toggle-desc">Limita picos que alimentam o loop</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggleComp">
            <div class="toggle-track"><div class="toggle-thumb"></div></div>
          </label>
        </div>

        <button class="close-btn" id="closeBtn">Fechar</button>
      </div>
    `;
  }

  _bindEvents() {
    const overlay = this.shadowRoot.getElementById('overlay');
    const closeBtn = this.shadowRoot.getElementById('closeBtn');
    const refreshBtn = this.shadowRoot.getElementById('refreshBtn');
    const sheet = this.shadowRoot.getElementById('sheet');
    const toggleHP   = this.shadowRoot.getElementById('toggleHP');
    const toggleGate = this.shadowRoot.getElementById('toggleGate');
    const toggleComp = this.shadowRoot.getElementById('toggleComp');

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    refreshBtn.addEventListener('click', () => this._loadDevices());

    // Fechar arrastando para baixo
    sheet.addEventListener('touchstart', e => {
      this._touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sheet.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - this._touchStartY > 80) this.close();
    }, { passive: true });

    // Fechar com Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });

    // Emite evento quando toggle muda
    [toggleHP, toggleGate, toggleComp].forEach(t => {
      t.addEventListener('change', () => {
        this.dispatchEvent(new CustomEvent('settings-change', {
          detail: this.getSettings(),
          bubbles: true,
          composed: true
        }));
      });
    });
  }

  open() {
    this.shadowRoot.getElementById('overlay').classList.add('open');
    this.shadowRoot.getElementById('sheet').classList.add('open');
    this._loadDevices();
  }

  close() {
    this.shadowRoot.getElementById('overlay').classList.remove('open');
    this.shadowRoot.getElementById('sheet').classList.remove('open');
  }

  async _loadDevices() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs  = devices.filter(d => d.kind === 'audioinput');
      const outputs = devices.filter(d => d.kind === 'audiooutput');

      const inputSel  = this.shadowRoot.getElementById('inputSelect');
      const outputSel = this.shadowRoot.getElementById('outputSelect');
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
      console.warn('Não foi possível listar dispositivos:', e);
    }
  }

  getSettings() {
    return {
      inputId:   this.shadowRoot.getElementById('inputSelect').value,
      outputId:  this.shadowRoot.getElementById('outputSelect').value,
      outputLabel: this.shadowRoot.getElementById('outputSelect').selectedOptions[0]?.text || 'saída padrão',
      highpass:  this.shadowRoot.getElementById('toggleHP').checked,
      gate:      this.shadowRoot.getElementById('toggleGate').checked,
      compressor: this.shadowRoot.getElementById('toggleComp').checked,
    };
  }
}

customElements.define('settings-sheet', SettingsSheet);
