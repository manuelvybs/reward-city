// Reward City — DOM overlays: title, the row of 8 card slots, the coin meter, hints, card flights and the end card.
import { CARDS, GAME } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.slots = CARDS.map(b => {
      const d = document.createElement('div'); d.className = 'slot';
      const img = document.createElement('img'); img.src = `assets/cards/${b}.webp`; img.alt = b;
      d.appendChild(img); $('slots').appendChild(d);
      return d;
    });
    for (const b of CARDS) { const img = document.createElement('img'); img.src = `assets/cards/${b}.webp`; img.alt = b; $('endCards').appendChild(img); }
    $('endLine').textContent = GAME.endLine;
    this.hintText = ''; this.hintUntil = 0; this.flashUntil = 0;
  }

  ready() { $('loading').style.display = 'none'; $('press').style.display = ''; }
  start() {
    $('title').classList.add('hidden'); $('hud').classList.add('on');
    this.hint(document.body.classList.contains('touch') ? 'walk up to a gift card and hold REDEEM' : 'walk up to a gift card and hold J or Shift to redeem your coins', 6);
  }
  end() { $('end').classList.add('on'); $('hud').classList.remove('on'); }
  restart() { $('end').classList.remove('on'); $('hud').classList.add('on'); }

  hint(text, sec = 3, now = performance.now() / 1000) {
    this.hintText = text; this.hintUntil = now + sec;
    $('hint').textContent = text; $('hint').classList.add('on');
  }

  // a card image flies from its place in the world (screen px) into its slot
  fly(i, sx, sy) {
    const slot = this.slots[i], r = slot.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = slot.firstChild.src; img.className = 'flying';
    img.style.left = sx + 'px'; img.style.top = sy + 'px';
    document.body.appendChild(img);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      img.style.left = (r.left + r.width / 2) + 'px'; img.style.top = (r.top + r.height / 2) + 'px';
      img.style.width = r.width + 'px'; img.style.transform = 'translate(-50%,-50%) rotate(0deg)';
    }));
    setTimeout(() => { img.remove(); slot.classList.add('on', 'pop'); setTimeout(() => slot.classList.remove('pop'), 600); }, 950);
  }

  pulseMissing(game) {
    this.slots.forEach((s, i) => { if (game.cards[i].state === 'locked') { s.classList.remove('pulse'); void s.offsetWidth; s.classList.add('pulse'); } });
  }

  update(game, now = performance.now() / 1000) {
    $('meterFill').style.height = game.meter.value + '%';
    $('meter').classList.toggle('low', game.meter.value < 15);
    if (this.hintText && now > this.hintUntil) { $('hint').classList.remove('on'); this.hintText = ''; }
  }

  syncSlots(game) { this.slots.forEach((s, i) => s.classList.toggle('on', game.cards[i].state !== 'locked')); }
}
