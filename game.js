'use strict';

/* ------------------------------------------------------------------
   Pixel Dash — a tiny top-down arena game.
   Everything is drawn procedurally; there are no image or audio files.
------------------------------------------------------------------ */

const W = 320;
const H = 180;
const TAU = Math.PI * 2;
const ARENA = { x: 7, y: 7, w: W - 14, h: H - 14 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const len = (x, y) => Math.hypot(x, y);

/* ------------------------------ tiny 3x5 font ------------------------------ */

const GLYPHS = {
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['###', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '..#', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  ' ': ['...', '...', '...', '...', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

const textWidth = (str, scale = 1) => (str.length * 4 - 1) * scale;

function text(str, x, y, color, scale = 1, align = 'left') {
  const s = String(str).toUpperCase();
  let px = Math.round(align === 'center' ? x - textWidth(s, scale) / 2 : align === 'right' ? x - textWidth(s, scale) : x);
  const py = Math.round(y);
  ctx.fillStyle = color;
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g) {
      for (let row = 0; row < 5; row++) {
        const line = g[row];
        for (let col = 0; col < 3; col++) {
          if (line[col] === '#') ctx.fillRect(px + col * scale, py + row * scale, scale, scale);
        }
      }
    }
    px += 4 * scale;
  }
}

function textShadow(str, x, y, color, scale = 1, align = 'left', shadow = '#000') {
  text(str, x + scale, y + scale, shadow, scale, align);
  text(str, x, y, color, scale, align);
}

/* ------------------------------ sound ------------------------------ */

const Sound = {
  ac: null,
  muted: false,
  unlock() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ac = new AC();
    } catch (e) {
      this.ac = null;
    }
  },
  blip(freq, dur, type = 'square', vol = 0.05, slideTo = null) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },
  shoot() { this.blip(680, 0.07, 'square', 0.03, 300); },
  hit() { this.blip(180, 0.09, 'square', 0.045, 90); },
  kill() { this.blip(120, 0.16, 'sawtooth', 0.045, 45); },
  gem() { this.blip(880, 0.08, 'triangle', 0.05, 1320); },
  hurt() { this.blip(300, 0.24, 'sawtooth', 0.06, 60); },
  dash() { this.blip(420, 0.12, 'sine', 0.05, 900); },
  wave() {
    this.blip(520, 0.1, 'triangle', 0.05, 700);
    setTimeout(() => this.blip(780, 0.14, 'triangle', 0.05, 980), 90);
  },
  over() { this.blip(320, 0.5, 'sawtooth', 0.06, 50); },
};

/* ------------------------------ background ------------------------------ */

const bgLayer = document.createElement('canvas');
bgLayer.width = W;
bgLayer.height = H;

(function paintBackground() {
  const b = bgLayer.getContext('2d');
  b.fillStyle = '#0d0d1a';
  b.fillRect(0, 0, W, H);

  const tile = 16;
  for (let ty = 0; ty < H; ty += tile) {
    for (let tx = 0; tx < W; tx += tile) {
      const even = (tx / tile + ty / tile) % 2 === 0;
      b.fillStyle = even ? '#12122a' : '#101024';
      b.fillRect(tx, ty, tile, tile);
      if (Math.random() < 0.16) {
        b.fillStyle = 'rgba(120,140,255,0.10)';
        b.fillRect(tx + randInt(2, 12), ty + randInt(2, 12), 1, 1);
      }
    }
  }

  b.fillStyle = 'rgba(90,120,255,0.05)';
  b.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

  b.strokeStyle = '#2a2a55';
  b.lineWidth = 2;
  b.strokeRect(ARENA.x - 1, ARENA.y - 1, ARENA.w + 2, ARENA.h + 2);
  b.strokeStyle = '#3b3b7a';
  b.lineWidth = 1;
  b.strokeRect(ARENA.x + 1, ARENA.y + 1, ARENA.w - 2, ARENA.h - 2);

  b.fillStyle = '#4a4a90';
  const studs = [
    [ARENA.x - 1, ARENA.y - 1],
    [ARENA.x + ARENA.w - 2, ARENA.y - 1],
    [ARENA.x - 1, ARENA.y + ARENA.h - 2],
    [ARENA.x + ARENA.w - 2, ARENA.y + ARENA.h - 2],
  ];
  for (const [sx, sy] of studs) b.fillRect(sx, sy, 3, 3);

  const g = b.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 190);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
})();

/* ------------------------------ input ------------------------------ */

const keys = new Set();
const pointer = { x: W / 2, y: H / 2, active: false, down: false };

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'fire', ShiftLeft: 'dash', ShiftRight: 'dash',
};

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) e.preventDefault();
  Sound.unlock();

  if (e.repeat) return;
  keys.add(e.code);

  if (e.code === 'KeyM') {
    Sound.muted = !Sound.muted;
    if (!Sound.muted) Sound.blip(600, 0.08, 'triangle', 0.05, 900);
    return;
  }
  if (e.code === 'KeyP') {
    if (game.state === 'play') game.state = 'pause';
    else if (game.state === 'pause') game.state = 'play';
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    if (game.state === 'menu' || game.state === 'over') startGame();
  }
  if (e.code === 'KeyR' && game.state === 'over') startGame();
});

window.addEventListener('keyup', (e) => keys.delete(e.code));

function toCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener('pointermove', (e) => {
  const p = toCanvas(e);
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.active = true;
});

canvas.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  const p = toCanvas(e);
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.active = true;
  pointer.down = true;
  if (game.state === 'menu' || game.state === 'over') startGame();
});

window.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointerleave', () => { pointer.down = false; });
window.addEventListener('blur', () => {
  keys.clear();
  pointer.down = false;
  if (game.state === 'play') game.state = 'pause';
});

/* ------------------------------ state ------------------------------ */

const game = {
  state: 'menu',
  time: 0,
  score: 0,
  best: 0,
  wave: 0,
  shake: 0,
  flash: 0,
  banner: { text: '', timer: 0 },
  spawnQueue: [],
  spawnTimer: 0,
  breather: 0,
};

try {
  game.best = Number(localStorage.getItem('pixeldash.best') || 0) || 0;
} catch (e) {
  game.best = 0;
}

function saveBest() {
  if (game.score > game.best) {
    game.best = game.score;
    try {
      localStorage.setItem('pixeldash.best', String(game.best));
    } catch (e) {
      // storage can be blocked; the score still shows for this session
    }
  }
}

const player = {
  x: W / 2, y: H / 2, r: 4.5,
  speed: 82,
  hp: 3, maxHp: 5,
  aimX: 1, aimY: 0,
  fireCd: 0,
  invuln: 0,
  dashCd: 0,
  dashTime: 0,
  dashX: 0, dashY: 0,
  bob: 0,
};

const DASH_COOLDOWN = 0.85;

let bullets = [];
let enemies = [];
let gems = [];
let particles = [];
let rings = [];

const ENEMY_TYPES = {
  slime: { r: 5, hp: 1, speed: 26, score: 10, color: '#4ade80', dark: '#166534', drop: 0.55 },
  runner: { r: 4, hp: 2, speed: 54, score: 15, color: '#f472b6', dark: '#9d174d', drop: 0.6 },
  brute: { r: 7.5, hp: 5, speed: 20, score: 30, color: '#fbbf24', dark: '#92400e', drop: 0.9 },
};

function resetWorld() {
  player.x = W / 2;
  player.y = H / 2;
  player.hp = 3;
  player.maxHp = 5;
  player.fireCd = 0;
  player.invuln = 1;
  player.dashCd = 0;
  player.dashTime = 0;
  player.aimX = 1;
  player.aimY = 0;
  player.bob = 0;

  bullets = [];
  enemies = [];
  gems = [];
  particles = [];
  rings = [];

  game.score = 0;
  game.wave = 0;
  game.time = 0;
  game.shake = 0;
  game.flash = 0;
  game.spawnQueue = [];
  game.spawnTimer = 0;
  game.breather = 0.6;
  game.banner = { text: '', timer: 0 };
}

function startGame() {
  resetWorld();
  game.state = 'play';
  Sound.unlock();
  Sound.blip(520, 0.1, 'triangle', 0.05, 780);
}

/* ------------------------------ waves ------------------------------ */

function buildWave(n) {
  const queue = [];
  const slimes = 3 + Math.floor(n * 1.4);
  const runners = n >= 2 ? Math.floor((n - 1) / 2) + 1 : 0;
  const brutes = n >= 4 ? Math.floor((n - 2) / 3) : 0;

  for (let i = 0; i < slimes; i++) queue.push('slime');
  for (let i = 0; i < runners; i++) queue.push('runner');
  for (let i = 0; i < brutes; i++) queue.push('brute');

  for (let i = queue.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

function spawnPoint() {
  const pad = 10;
  switch (randInt(0, 3)) {
    case 0: return { x: rand(ARENA.x + pad, ARENA.x + ARENA.w - pad), y: ARENA.y - 6 };
    case 1: return { x: ARENA.x + ARENA.w + 6, y: rand(ARENA.y + pad, ARENA.y + ARENA.h - pad) };
    case 2: return { x: rand(ARENA.x + pad, ARENA.x + ARENA.w - pad), y: ARENA.y + ARENA.h + 6 };
    default: return { x: ARENA.x - 6, y: rand(ARENA.y + pad, ARENA.y + ARENA.h - pad) };
  }
}

function spawnEnemy(type) {
  const t = ENEMY_TYPES[type];
  const p = spawnPoint();
  const hpBonus = type === 'brute' ? Math.floor(game.wave / 3) : 0;
  enemies.push({
    type,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    r: t.r,
    hp: t.hp + hpBonus,
    maxHp: t.hp + hpBonus,
    speed: t.speed + Math.min(14, game.wave * 1.6),
    score: t.score,
    drop: t.drop,
    flash: 0,
    phase: rand(0, TAU),
    hitCd: 0,
  });
}

/* ------------------------------ effects ------------------------------ */

function burst(x, y, count, color, speed = 60, life = 0.5, size = 1) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const s = rand(speed * 0.25, speed);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(life * 0.5, life),
      maxLife: life,
      color,
      size,
    });
  }
}

function ring(x, y, color, radius = 18, life = 0.35) {
  rings.push({ x, y, color, radius, life, maxLife: life });
}

function addShake(amount) {
  game.shake = Math.min(7, game.shake + amount);
}

/* ------------------------------ player ------------------------------ */

function updatePlayer(dt) {
  let mx = 0;
  let my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;

  const m = len(mx, my);
  if (m > 0) {
    mx /= m;
    my /= m;
  }

  player.fireCd = Math.max(0, player.fireCd - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.bob += dt * (m > 0 ? 10 : 3);

  if (pointer.active) {
    const ax = pointer.x - player.x;
    const ay = pointer.y - player.y;
    const al = len(ax, ay);
    if (al > 1) {
      player.aimX = ax / al;
      player.aimY = ay / al;
    }
  } else if (m > 0) {
    player.aimX = mx;
    player.aimY = my;
  }

  if (player.dashTime > 0) {
    player.dashTime -= dt;
    const dashSpeed = player.speed * 3.1;
    player.x += player.dashX * dashSpeed * dt;
    player.y += player.dashY * dashSpeed * dt;
    if (Math.random() < 0.7) {
      particles.push({
        x: player.x, y: player.y, vx: rand(-10, 10), vy: rand(-10, 10),
        life: 0.25, maxLife: 0.25, color: '#67e8f9', size: 1,
      });
    }
  } else {
    player.x += mx * player.speed * dt;
    player.y += my * player.speed * dt;
  }

  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
    if (player.dashCd <= 0 && m > 0 && player.dashTime <= 0) {
      player.dashX = mx;
      player.dashY = my;
      player.dashTime = 0.15;
      player.dashCd = DASH_COOLDOWN;
      player.invuln = Math.max(player.invuln, 0.25);
      Sound.dash();
      ring(player.x, player.y, '#67e8f9', 14, 0.25);
    }
  }

  player.x = clamp(player.x, ARENA.x + player.r, ARENA.x + ARENA.w - player.r);
  player.y = clamp(player.y, ARENA.y + player.r, ARENA.y + ARENA.h - player.r);

  if ((keys.has('Space') || pointer.down) && player.fireCd <= 0) {
    player.fireCd = 0.15;
    const a = Math.atan2(player.aimY, player.aimX) + rand(-0.03, 0.03);
    bullets.push({
      x: player.x + Math.cos(a) * 6,
      y: player.y + Math.sin(a) * 6,
      vx: Math.cos(a) * 215,
      vy: Math.sin(a) * 215,
      r: 1.6,
      life: 1.1,
    });
    for (let i = 0; i < 3; i++) {
      const ma = a + rand(-0.5, 0.5);
      particles.push({
        x: player.x + Math.cos(a) * 6,
        y: player.y + Math.sin(a) * 6,
        vx: Math.cos(ma) * rand(20, 60),
        vy: Math.sin(ma) * rand(20, 60),
        life: 0.12, maxLife: 0.12, color: '#fef3c7', size: 1,
      });
    }
    Sound.shoot();
  }
}

function damagePlayer(amount) {
  if (player.invuln > 0) return;
  player.hp -= amount;
  player.invuln = 1.1;
  game.flash = 0.35;
  addShake(6);
  Sound.hurt();
  burst(player.x, player.y, 14, '#f87171', 90, 0.5, 1);

  if (player.hp <= 0) {
    player.hp = 0;
    game.state = 'over';
    game.shake = 7;
    saveBest();
    Sound.over();
    burst(player.x, player.y, 40, '#fca5a5', 130, 0.9, 1);
    ring(player.x, player.y, '#f87171', 30, 0.6);
  }
}

/* ------------------------------ enemies ------------------------------ */

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.phase += dt * 3;

    let dx = player.x - e.x;
    let dy = player.y - e.y;
    const d = len(dx, dy) || 1;
    dx /= d;
    dy /= d;

    const wobble = Math.sin(e.phase * 1.4) * 0.25;
    const ang = Math.atan2(dy, dx) + wobble;
    const speed = e.speed * (e.type === 'runner' ? 1 + Math.sin(e.phase * 2) * 0.12 : 1);

    e.vx = Math.cos(ang) * speed;
    e.vy = Math.sin(ang) * speed;

    for (let j = 0; j < enemies.length; j++) {
      if (j === i) continue;
      const o = enemies[j];
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = len(ox, oy);
      const minD = e.r + o.r;
      if (od > 0.001 && od < minD) {
        const push = ((minD - od) / minD) * 34;
        e.vx += (ox / od) * push;
        e.vy += (oy / od) * push;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (d < e.r + player.r && e.hitCd <= 0) {
      damagePlayer(1);
      e.hitCd = 0.6;
      e.x -= dx * 8;
      e.y -= dy * 8;
    }
  }
}

function killEnemy(e, index) {
  enemies.splice(index, 1);
  game.score += e.score;
  addShake(2);
  Sound.kill();

  const t = ENEMY_TYPES[e.type];
  burst(e.x, e.y, e.type === 'brute' ? 18 : 10, t.color, 80, 0.55, 1);
  ring(e.x, e.y, t.color, e.r + 6, 0.3);

  if (Math.random() < e.drop) {
    const count = e.type === 'brute' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      gems.push({
        x: e.x + rand(-3, 3),
        y: e.y + rand(-3, 3),
        vx: rand(-25, 25),
        vy: rand(-25, 25),
        life: 12,
        value: e.type === 'brute' ? 10 : 5,
        phase: rand(0, TAU),
      });
    }
  }
}

/* ------------------------------ bullets, gems ------------------------------ */

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let dead =
      b.life <= 0 ||
      b.x < ARENA.x || b.x > ARENA.x + ARENA.w ||
      b.y < ARENA.y || b.y > ARENA.y + ARENA.h;

    if (!dead) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const hitR = e.r + b.r;
        if (dx * dx + dy * dy <= hitR * hitR) {
          e.hp -= 1;
          e.flash = 0.12;
          burst(b.x, b.y, 3, '#fde68a', 50, 0.22, 1);
          Sound.hit();
          if (e.hp <= 0) killEnemy(e, j);
          dead = true;
          break;
        }
      }
    }

    if (dead) bullets.splice(i, 1);
  }
}

function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.life -= dt;
    g.phase += dt * 4;

    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = len(dx, dy) || 1;

    if (d < 34) {
      const pull = 220 * (1 - d / 34);
      g.vx += (dx / d) * pull * dt * 6;
      g.vy += (dy / d) * pull * dt * 6;
    }
    g.vx *= 0.94;
    g.vy *= 0.94;
    g.x += g.vx * dt;
    g.y += g.vy * dt;

    if (d < player.r + 3) {
      game.score += g.value;
      Sound.gem();
      burst(g.x, g.y, 5, '#a7f3d0', 45, 0.3, 1);
      gems.splice(i, 1);
      continue;
    }
    if (g.life <= 0) gems.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt;
    if (r.life <= 0) rings.splice(i, 1);
  }
}

/* ------------------------------ wave flow ------------------------------ */

function updateWaves(dt) {
  if (game.breather > 0) {
    game.breather -= dt;
    if (game.breather <= 0) {
      game.wave += 1;
      game.spawnQueue = buildWave(game.wave);
      game.spawnTimer = 0;
      game.banner = { text: `WAVE ${game.wave}`, timer: 1.3 };
      Sound.wave();

      if (game.wave > 1 && game.wave % 3 === 0 && player.hp < player.maxHp) {
        player.hp += 1;
        burst(player.x, player.y, 16, '#86efac', 60, 0.6, 1);
        ring(player.x, player.y, '#86efac', 22, 0.5);
      }
    }
    return;
  }

  if (game.spawnQueue.length > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = Math.max(0.16, 0.5 - game.wave * 0.03);
      spawnEnemy(game.spawnQueue.pop());
    }
  } else if (enemies.length === 0) {
    game.breather = 1.6;
    const bonus = 25 * game.wave;
    game.score += bonus;
    game.banner = { text: `WAVE ${game.wave} CLEAR +${bonus}`, timer: 1.5 };
  }
}

function update(dt) {
  if (game.state !== 'pause') {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 22);
    game.flash = Math.max(0, game.flash - dt * 2.2);
    if (game.banner.timer > 0) game.banner.timer -= dt;
  }

  if (game.state === 'play') {
    updatePlayer(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateGems(dt);
  }
  if (game.state === 'play' || game.state === 'over') updateParticles(dt);
}

/* ------------------------------ drawing ------------------------------ */

function drawPlayer() {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const blink = player.invuln > 0 && Math.floor(game.time * 20) % 2 === 0;
  const bob = Math.round(Math.sin(player.bob) * 0.5);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 3, y + 5, 7, 2);

  if (blink) return;

  const dashing = player.dashTime > 0;
  const suit = dashing ? '#a5f3fc' : '#93c5fd';
  const suitDark = dashing ? '#0e7490' : '#1d4ed8';

  ctx.fillStyle = suitDark;
  ctx.fillRect(x - 3, y + 2 + bob, 2, 3);
  ctx.fillRect(x + 1, y + 2 - bob, 2, 3);

  ctx.fillStyle = suit;
  ctx.fillRect(x - 4, y - 4, 8, 7);
  ctx.fillStyle = suitDark;
  ctx.fillRect(x - 4, y + 1, 8, 2);
  ctx.fillRect(x - 4, y - 4, 8, 1);

  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(x - 3, y - 3, 6, 3);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x - 2, y - 2, 1, 2);
  ctx.fillRect(x + 1, y - 2, 1, 2);

  const gx = Math.round(x + player.aimX * 5);
  const gy = Math.round(y - 1 + player.aimY * 5);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(gx - 1, gy - 1, 3, 3);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(gx, gy, 1, 1);
}

function drawSlime(e) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  const t = ENEMY_TYPES.slime;
  const squash = Math.sin(e.phase * 2) * 0.8;
  const body = e.flash > 0 ? '#ffffff' : t.color;
  const dark = e.flash > 0 ? '#ffffff' : t.dark;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 4, y + 4, 9, 2);

  ctx.fillStyle = dark;
  ctx.fillRect(x - 5, y - 2 + squash * 0.3, 10, 6 - squash * 0.3);
  ctx.fillStyle = body;
  ctx.fillRect(x - 4, y - 3 - squash * 0.4, 8, 6);
  ctx.fillRect(x - 3, y - 4 - squash * 0.4, 6, 1);

  ctx.fillStyle = '#0b2416';
  ctx.fillRect(x - 2, y - 1, 1, 2);
  ctx.fillRect(x + 1, y - 1, 1, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x - 4, y - 3 - squash * 0.4, 2, 1);
}

function drawRunner(e) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  const t = ENEMY_TYPES.runner;
  const body = e.flash > 0 ? '#ffffff' : t.color;
  const dark = e.flash > 0 ? '#ffffff' : t.dark;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 3, y + 3, 7, 2);

  ctx.fillStyle = dark;
  ctx.fillRect(x - 3, y - 2, 6, 5);
  ctx.fillStyle = body;
  ctx.fillRect(x - 3, y - 3, 5, 4);
  ctx.fillRect(x - 4, y - 2, 1, 2);

  ctx.fillStyle = '#3b0a24';
  ctx.fillRect(x - 2, y - 2, 1, 1);
  ctx.fillRect(x, y - 2, 1, 1);
}

function drawBrute(e) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  const t = ENEMY_TYPES.brute;
  const body = e.flash > 0 ? '#ffffff' : t.color;
  const dark = e.flash > 0 ? '#ffffff' : t.dark;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 6, y + 6, 13, 3);

  ctx.fillStyle = dark;
  ctx.fillRect(x - 7, y - 7, 3, 3);
  ctx.fillRect(x + 5, y - 7, 3, 3);

  ctx.fillStyle = dark;
  ctx.fillRect(x - 6, y - 5, 13, 11);
  ctx.fillStyle = body;
  ctx.fillRect(x - 5, y - 6, 11, 10);

  ctx.fillStyle = '#3b1d00';
  ctx.fillRect(x - 3, y - 2, 2, 2);
  ctx.fillRect(x + 2, y - 2, 2, 2);
  ctx.fillRect(x - 2, y + 3, 5, 1);

  if (e.hp < e.maxHp) {
    const width = 11;
    const filled = Math.ceil((e.hp / e.maxHp) * width);
    ctx.fillStyle = '#3b1d00';
    ctx.fillRect(x - 5, y + 7, width, 2);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(x - 5, y + 7, filled, 2);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.type === 'slime') drawSlime(e);
    else if (e.type === 'runner') drawRunner(e);
    else drawBrute(e);
  }
}

function drawBullets() {
  for (const b of bullets) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawGems() {
  for (const g of gems) {
    if (g.life < 3 && Math.floor(g.life * 8) % 2 === 0) continue;
    const x = Math.round(g.x);
    const y = Math.round(g.y + Math.sin(g.phase) * 0.8);

    ctx.fillStyle = '#0f766e';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(x - 1, y - 2, 3, 1);
    ctx.fillRect(x - 2, y - 1, 1, 2);
    ctx.fillStyle = '#ccfbf1';
    ctx.fillRect(x, y - 1, 1, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const r of rings) {
    const k = 1 - r.life / r.maxLife;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(Math.round(r.x), Math.round(r.y), Math.max(1, r.radius * k), 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHeart(x, y, filled) {
  ctx.fillStyle = filled ? '#f87171' : '#3f3f5f';
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x + 4, y, 2, 1);
  ctx.fillRect(x, y + 1, 7, 2);
  ctx.fillRect(x + 1, y + 3, 5, 1);
  ctx.fillRect(x + 2, y + 4, 3, 1);
  if (filled) {
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(x + 1, y + 1, 1, 1);
  }
}

function drawHud() {
  textShadow('SCORE', 9, 8, '#7c88b8');
  textShadow(String(game.score).padStart(5, '0'), 9, 15, '#e8f0ff', 2);

  textShadow('WAVE', W - 9, 8, '#7c88b8', 1, 'right');
  textShadow(String(Math.max(1, game.wave)), W - 9, 15, '#a5b4fc', 2, 'right');

  for (let i = 0; i < player.maxHp; i++) {
    drawHeart(9 + i * 9, H - 14, i < player.hp);
  }

  const dashReady = player.dashCd <= 0;
  textShadow('DASH', W - 9, H - 15, dashReady ? '#67e8f9' : '#4b5563', 1, 'right');
  const barW = 26;
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(W - 9 - barW, H - 9, barW, 3);
  ctx.fillStyle = dashReady ? '#67e8f9' : '#0e7490';
  ctx.fillRect(W - 9 - barW, H - 9, Math.round(barW * clamp(1 - player.dashCd / DASH_COOLDOWN, 0, 1)), 3);

  if (Sound.muted) {
    textShadow('MUTED', W / 2, H - 15, '#6b7280', 1, 'center');
  }

  if (game.banner.timer > 0) {
    ctx.globalAlpha = clamp(game.banner.timer, 0, 1);
    textShadow(game.banner.text, W / 2, H / 2 - 20, '#fde68a', 2, 'center');
    ctx.globalAlpha = 1;
  }
}

function drawMenu() {
  const bob = Math.sin(game.time * 2) * 2;
  textShadow('PIXEL', W / 2, 34 + bob, '#93c5fd', 4, 'center', '#1e3a8a');
  textShadow('DASH', W / 2, 58 + bob, '#f472b6', 4, 'center', '#831843');

  text('SURVIVE THE WAVES - GRAB THE GEMS', W / 2, 88, '#8b93b5', 1, 'center');

  const pulse = Math.floor(game.time * 2) % 2 === 0 ? '#e8f0ff' : '#a5b4fc';
  textShadow('PRESS SPACE OR CLICK TO PLAY', W / 2, 112, pulse, 1, 'center');

  text('WASD MOVE  SPACE FIRE  SHIFT DASH', W / 2, 132, '#6b7394', 1, 'center');
  textShadow(`BEST ${String(game.best).padStart(5, '0')}`, W / 2, 146, '#fbbf24', 1, 'center');

  for (let i = 0; i < 5; i++) {
    const t = game.time * 0.7 + i * 1.3;
    const x = Math.round(W / 2 + Math.cos(t) * 60);
    const y = Math.round(158 + Math.sin(t * 1.3) * 4);
    ctx.fillStyle = i % 2 ? '#4ade80' : '#f472b6';
    ctx.fillRect(x - 2, y - 2, 5, 4);
    ctx.fillStyle = '#0b2416';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(5,5,14,0.72)';
  ctx.fillRect(0, 0, W, H);

  textShadow('GAME OVER', W / 2, 50, '#f87171', 3, 'center', '#450a0a');
  textShadow(`SCORE ${game.score}`, W / 2, 80, '#e8f0ff', 2, 'center');

  if (game.score >= game.best && game.score > 0) {
    textShadow('NEW BEST!', W / 2, 102, '#fbbf24', 1, 'center');
  } else {
    textShadow(`BEST ${game.best}`, W / 2, 102, '#8b93b5', 1, 'center');
  }

  const pulse = Math.floor(game.time * 2) % 2 === 0 ? '#e8f0ff' : '#a5b4fc';
  textShadow('PRESS SPACE TO RETRY', W / 2, 126, pulse, 1, 'center');
}

function drawPause() {
  ctx.fillStyle = 'rgba(5,5,14,0.6)';
  ctx.fillRect(0, 0, W, H);
  textShadow('PAUSED', W / 2, H / 2 - 12, '#a5b4fc', 3, 'center');
  textShadow('PRESS P TO RESUME', W / 2, H / 2 + 14, '#8b93b5', 1, 'center');
}

function render() {
  const shakeX = game.shake > 0 ? rand(-game.shake, game.shake) * 0.6 : 0;
  const shakeY = game.shake > 0 ? rand(-game.shake, game.shake) * 0.6 : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0b16';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bgLayer, Math.round(shakeX), Math.round(shakeY));

  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));

  if (game.state === 'menu') {
    drawMenu();
  } else {
    drawGems();
    drawBullets();
    drawEnemies();
    if (game.state !== 'over') drawPlayer();
    drawParticles();
    drawHud();

    if (game.state === 'pause') drawPause();
    if (game.state === 'over') drawGameOver();
  }

  ctx.restore();

  if (game.flash > 0) {
    ctx.globalAlpha = game.flash * 0.6;
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------ main loop ------------------------------ */

const STEP = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  accumulator += Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;

  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  if (steps === 5) accumulator = 0;

  render();
  requestAnimationFrame(frame);
}

resetWorld();
requestAnimationFrame(frame);
