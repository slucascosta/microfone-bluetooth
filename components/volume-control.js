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
        :host { display: block; width: 100%; }

        .container {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: clamp(0.7rem, 2vh, 1rem) 1.2rem;
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 14px;
          width: 100%;
          box-sizing: border-box;
        }

        .icon {
          font-size: 0.95rem;
          flex-shrink: 0;
          pointer-events: none;
          user-select: none;
        }

        .slider-wrap {
          flex: 1;
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .track {
          position: absolute;
          left: 0; right: 0;
          height: 3px;
          background: #2a2a2a;
          border-radius: 2px;
          pointer-events: none;
        }

        .fill {
          position: absolute;
          left: 0;
          height: 3px;
          background: #ff2d2d;
          border-radius: 2px;
          pointer-events: none;
          width: 33.3%;
        }

        .thumb {
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ff2d2d;
          pointer-events: none;
          transform: translateX(-50%);
          left: 33.3%;
          box-shadow: 0 0 4px rgba(255,45,45,0.4);
        }

        input[type=range] {
          position: absolute;
          left: 0; right: 0;
          width: 100%;
          margin: 0;
          opacity: 0;
          height: 20px;
          cursor: pointer;
        }

        .value {
          font-size: 0.75rem;
          color: #606060;
          font-variant-numeric: tabular-nums;
          width: 36px;
          text-align: right;
          flex-shrink: 0;
        }
      </style>

      <div class="container">
        <span class="icon">🔈</span>
        <div class="slider-wrap">
          <div class="track"></div>
          <div class="fill" id="fill"></div>
          <div class="thumb" id="thumb"></div>
          <input type="range" id="slider" min="0" max="300" value="100" step="1">
        </div>
        <span class="value" id="value">100%</span>
      </div>
    `;

    const slider = this.shadowRoot.getElementById('slider');
    const fill   = this.shadowRoot.getElementById('fill');
    const thumb  = this.shadowRoot.getElementById('thumb');
    const value  = this.shadowRoot.getElementById('value');

    const update = (val) => {
      const pct = (val / 300) * 100;
      fill.style.width = pct + '%';
      thumb.style.left = pct + '%';
      value.textContent = Math.round(val / 3) + '%';
    };

    slider.addEventListener('input', (e) => {
      update(e.target.value);
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
