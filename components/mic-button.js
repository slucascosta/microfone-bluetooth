class MicButton extends HTMLElement {
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
          flex-direction: column;
          align-items: center;
          gap: clamp(0.6rem, 2vh, 1rem);
        }

        button {
          width: clamp(110px, 28vw, 160px);
          height: clamp(110px, 28vw, 160px);
          border-radius: 50%;
          border: 1.5px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-size: clamp(2.2rem, 7vw, 3.2rem);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          outline: none;
          transition: transform 0.12s, background 0.2s, box-shadow 0.2s;
          -webkit-user-select: none;
          user-select: none;
          padding: 0;
        }

        button * { pointer-events: none; }

        @media (min-width: 600px) {
          button { width: 150px; height: 150px; font-size: 3rem; }
        }

        button:hover { box-shadow: 0 0 0 6px rgba(255,45,45,0.08); }
        button:active { transform: scale(0.93); }

        button.active { background: var(--red); border-color: var(--red); }
        button.active:hover { box-shadow: 0 0 0 8px rgba(255,45,45,0.15); }

        .pulse-ring {
          position: absolute;
          inset: -1px;
          border-radius: 50%;
          border: 2px solid var(--red);
          opacity: 0;
          pointer-events: none;
        }

        button.active .pulse-ring {
          animation: pulse 1.6s ease-out infinite;
        }

        @keyframes pulse {
          0%   { transform: scale(1);    opacity: 0.5; }
          100% { transform: scale(1.55); opacity: 0;   }
        }

        .label {
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--muted);
        }
      </style>

      <button id="btn">
        <span class="pulse-ring"></span>
        <span class="icon">🎤</span>
      </button>
      <span class="label" id="label">Monitorar</span>
    `;

    this.shadowRoot.getElementById('btn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('mic-click', { bubbles: true, composed: true }));
    });
  }

  setActive(active) {
    const btn = this.shadowRoot.getElementById('btn');
    const label = this.shadowRoot.getElementById('label');
    const icon = this.shadowRoot.querySelector('.icon');

    btn.classList.toggle('active', active);
    icon.textContent = active ? '⏹' : '🎤';
    label.textContent = active ? 'Parar' : 'Monitorar';
  }
}

customElements.define('mic-button', MicButton);
