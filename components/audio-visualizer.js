class AudioVisualizer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._bars = [];
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
          height: clamp(32px, 7vh, 52px);
          width: 100%;
          margin-bottom: clamp(0.6rem, 2vh, 1.2rem);
        }

        @media (min-width: 600px) {
          :host { height: 44px; margin-bottom: 0; }
        }

        .bar {
          flex: 1;
          max-width: 14px;
          background: #1c1c1c;
          border-radius: 3px;
          min-height: 3px;
          transition: height 0.06s;
        }

        .bar.active { background: var(--red); opacity: 0.85; }
      </style>

      ${Array.from({ length: 15 }, (_, i) => `<div class="bar" id="b${i}"></div>`).join('')}
    `;

    this._bars = Array.from({ length: 15 }, (_, i) =>
      this.shadowRoot.getElementById('b' + i)
    );
  }

  setActive(active) {
    this._bars.forEach(b => {
      b.classList.toggle('active', active);
      if (!active) b.style.height = '3px';
    });
  }

  update(dataArray) {
    const step = Math.floor(dataArray.length / this._bars.length);
    this._bars.forEach((bar, i) => {
      const h = Math.max(3, Math.round((dataArray[i * step] / 255) * 45));
      bar.style.height = h + 'px';
    });
  }
}

customElements.define('audio-visualizer', AudioVisualizer);
