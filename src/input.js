// Reward City — keyboard + mouse → { left, right, jump, beam, start, restart } (jump/start/restart are presses).
export class Input {
  constructor(target = window) {
    this.keys = new Set(); this.pressed = new Set(); this.mouse = false;
    target.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => { this.keys.clear(); this.mouse = false; });
    target.addEventListener('pointerdown', (e) => { if (e.button === 0) { this.mouse = true; this.pressed.add('Click'); } });
    target.addEventListener('pointerup', () => { this.mouse = false; });
  }
  has(...codes) { return codes.some(c => this.keys.has(c)); }
  took(...codes) { return codes.some(c => this.pressed.has(c)); }
  read() {
    return {
      left: this.has('ArrowLeft', 'KeyA'),
      right: this.has('ArrowRight', 'KeyD'),
      jump: this.took('Space', 'ArrowUp', 'KeyW'),
      beam: this.has('KeyJ', 'ShiftLeft', 'ShiftRight', 'KeyX') || this.mouse,
      start: this.took('Enter', 'Click'),
      restart: this.took('KeyR'),
    };
  }
  endFrame() { this.pressed.clear(); }
}
