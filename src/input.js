// Reward City — keyboard, mouse and touch pads → { left, right, jump, beam, start, restart }
// (jump / start / restart are presses). Each pad tracks its own pointers, so two thumbs work at once; only a real
// mouse beams by holding the button, so pad taps never fire the beam.
export class Input {
  constructor(target = window) {
    this.keys = new Set(); this.pressed = new Set(); this.mouse = false; this.pads = {}; this.touch = false;
    target.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => { this.keys.clear(); this.mouse = false; for (const s of Object.values(this.pads)) s.clear(); });
    target.addEventListener('pointerdown', (e) => {
      this.pressed.add('Click');                                      // start / wander on
      if (e.pointerType === 'mouse') { if (e.button === 0) this.mouse = true; } else this.setTouch();
    });
    target.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.mouse = false; });
    if (window.matchMedia?.('(pointer: coarse)').matches) this.setTouch();
  }

  // on-screen pads: elements with data-pad = left | right | jump | beam
  bindPads(root = document) {
    for (const el of root.querySelectorAll('[data-pad]')) {
      const k = el.dataset.pad, ids = this.pads[k] = new Set();
      const up = (e) => { ids.delete(e.pointerId); if (!ids.size) el.classList.remove('on'); };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();                     // a pad press is not a "tap to start"
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointers can't be captured */ }
        ids.add(e.pointerId); el.classList.add('on');
        if (k === 'jump') this.pressed.add('PadJump');
        this.setTouch();
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
  setTouch() { if (!this.touch) { this.touch = true; document.body.classList.add('touch'); } }
  pad(k) { return (this.pads[k]?.size || 0) > 0; }

  has(...codes) { return codes.some(c => this.keys.has(c)); }
  took(...codes) { return codes.some(c => this.pressed.has(c)); }
  read() {
    return {
      left: this.has('ArrowLeft', 'KeyA') || this.pad('left'),
      right: this.has('ArrowRight', 'KeyD') || this.pad('right'),
      jump: this.took('Space', 'ArrowUp', 'KeyW', 'PadJump'),
      beam: this.has('KeyJ', 'ShiftLeft', 'ShiftRight', 'KeyX') || this.mouse || this.pad('beam'),
      start: this.took('Enter', 'Click'),
      restart: this.took('KeyR'),
    };
  }
  endFrame() { this.pressed.clear(); }
}
