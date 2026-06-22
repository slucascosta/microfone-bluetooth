class VolumeControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: clamp(0.7rem, 2vh, 1rem) 1.2rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          width: 100%;
        }

        .icon {
          font-size: 0.95rem;
          flex-shrink: 0;
          pointer-events: none;
          user-select: none;
        }

        input[type=range] {
          flex: 1;
          accent-color: var(--red);
          cursor: pointer;
          height: 20px;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
        }

        input[type=range]::-webkit-slider-runnable-track {
          height: 3px;
          background: var(--border);
          border-radius: 2px;
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--red);
          margin-top: -7.5px;
          cursor: pointer;
        }

        input[type=range]::-moz-range-track {
          height: 3px;
          background: var(--border);
          border-radius: 2px;
        }

        input[type=range]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--red);
          border: none;
          cursor: pointer;
        }

        .value {
          font-size: 0.75rem;
          color: var(--sub);
          font-variant-numeric: tabular-nums;
          width: 36px;
          text-align: right;
          flex-shrink: 0;
        }
      </style>

      <span class="icon">🔈</span>
      <input type="range" id="slider" min="0" max="300" value="100" step="1">
      <span class="value" id="value">100%</span>
    `;

    this.shadowRoot.getElementById('slider').addEventListener('input', (e) => {
      this.shadowRoot.getElementById('value').textContent = e.target.value + '%';
      this.dispatchEvent(new CustomEvent('volume-change', {
        detail: { value: e.target.value / 100 },
        bubbles: true,
        composed: true
      }));
    });
  }

  getValue() {
    return this.shadowRoot.getElementById('slider').value / 100;
  }
}

customElements.define('volume-control', VolumeControl);
