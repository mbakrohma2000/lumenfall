// Lumenfall — the whole simulation. No drawing and no sound live here: update
// steps the world in fixed slices and returns the events that happened, and
// render.js / main.js turn those into pictures and noises.
//
// You are the last light-warden. Shadow moths come in twelve waves for the
// Heart Bloom at the centre of the field. You have a health bar and so does
// the Bloom: if either reaches zero the light goes out. Kill moths, gather
// the lumen shards they drop, grow stronger, and bring down the Moth Queen
// at the end of wave twelve.

import { CORE, FIELD, FINAL_WAVE, PLAYER } from './config.js';
import { intRange, makeRandom, pick, range } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export const KIND_MOTH = 'moth';
export const KIND_MINI = 'mini';
export const KIND_SPITTER = 'spitter';
export const KIND_SPLITTER = 'splitter';
export const KIND_BRUTE = 'brute';
export const KIND_BOSS = 'boss';

const ENEMY_STATS = {
  [KIND_MOTH]: { radius: 13, hp: 20, speed: 98, touch: 9, coreTouch: 5, score: 10, shards: 1 },
  [KIND_MINI]: { radius: 8, hp: 9, speed: 142, touch: 6, coreTouch: 4, score: 5, shards: 0 },
  [KIND_SPITTER]: { radius: 14, hp: 26, speed: 72, touch: 8, coreTouch: 5, score: 20, shards: 2 },
  [KIND_SPLITTER]: { radius: 17, hp: 34, speed: 76, touch: 10, coreTouch: 6, score: 25, shards: 2 },
  [KIND_BRUTE]: { radius: 21, hp: 85, speed: 58, touch: 15, coreTouch: 10, score: 40, shards: 3 },
  [KIND_BOSS]: { radius: 40, hp: 900, speed: 46, touch: 20, coreTouch: 14, score: 500, shards: 12 },
};

export const UPGRADES = [
  { id: 'dmg', name: 'Brighter Lance', desc: '+30% bullet damage', apply: (s) => { s.player.damage *= 1.3; } },
  { id: 'rate', name: 'Rapid Glow', desc: '+22% fire rate', apply: (s) => { s.player.fireInterval *= 0.82; } },
  { id: 'multi', name: 'Twin Motes', desc: '+1 bullet per shot', apply: (s) => { s.player.projectiles += 1; } },
  { id: 'speed', name: 'Swift Wings', desc: '+13% move speed', apply: (s) => { s.player.speed *= 1.13; } },
  { id: 'heart', name: 'Heart of Pollen', desc: '+25 max health and heal 40', apply: (s) => { s.player.maxHp += 25; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40); } },
  { id: 'magnet', name: 'Lumen Call', desc: '+70% shard magnet range', apply: (s) => { s.player.magnet *= 1.7; } },
  { id: 'dash', name: 'Phase Step', desc: 'Dash recharges 30% faster', apply: (s) => { s.player.dashCooldown *= 0.7; } },
  { id: 'roots', name: 'Root Mend', desc: 'Bloom +50 max health, repair 90', apply: (s) => { s.core.maxHp += 50; s.core.hp = Math.min(s.core.maxHp, s.core.hp + 90); } },
  { id: 'sparks', name: 'Sun Sparks', desc: 'Bigger, faster bullets: +12% damage', apply: (s) => { s.player.bulletRadius += 1.2; s.player.bulletSpeed *= 1.15; s.player.damage *= 1.12; } },
  { id: 'ward', name: 'Warden’s Ward', desc: 'Take 12% less damage', apply: (s) => { s.player.armor *= 0.88; } },
];

export function createWorld(seed = 1) {
  const random = makeRandom(seed);
  return {
    random,
    seed,
    screen: SCREEN_TITLE,
    time: 0,
    runTime: 0,
    score: 0,
    kills: 0,
    wave: 0,
    waveState: 'banner', // banner -> active -> cleared -> banner ...
    waveTimer: 1.6,
    toSpawn: [],
    spawnTimer: 0,
    player: null,
    core: null,
    boss: null,
    enemies: [],
    bullets: [],
    orbs: [],
    shards: [],
    particles: [],
    floaters: [],
    shake: 0,
    slowmo: 0,
    level: 1,
    xp: 0,
    xpNext: 6,
    offers: [],
    endReason: '',
    events: [],
  };
}

export function startRun(state) {
  state.screen = SCREEN_PLAY;
  state.time = 0;
  state.runTime = 0;
  state.score = 0;
  state.kills = 0;
  state.wave = 0;
  state.waveState = 'banner';
  state.waveTimer = 1.8;
  state.toSpawn = [];
  state.spawnTimer = 0;
  state.enemies = [];
  state.bullets = [];
  state.orbs = [];
  state.shards = [];
  state.particles = [];
  state.floaters = [];
  state.boss = null;
  state.shake = 0;
  state.slowmo = 0;
  state.level = 1;
  state.xp = 0;
  state.xpNext = 6;
  state.offers = [];
  state.endReason = '';
  state.player = {
    x: CORE.x,
    y: CORE.y + 120,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    fireTimer: 0,
    damage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletRadius: PLAYER.bulletRadius,
    projectiles: 1,
    magnet: 90,
    armor: 1,
    dashTimer: 0,
    dashCooldown: 0,
    dashMax: PLAYER.dashCooldown,
    dashDirX: 1,
    dashDirY: 0,
    invuln: 0,
    aimX: 1,
    aimY: 0,
    flash: 0,
  };
  state.core = { x: CORE.x, y: CORE.y, radius: CORE.radius, hp: CORE.hp, maxHp: CORE.hp, flash: 0, hitTimer: 0, sinceHit: 99 };
  burst(state, CORE.x, CORE.y, 26, '#ff9ecf', 130);
}

function burst(state, x, y, count, color, speed = 160) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length > 500) return;
    const a = state.random() * Math.PI * 2;
    const v = range(state.random, speed * 0.25, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: range(state.random, 0.3, 0.8),
      maxLife: 0.8,
      size: range(state.random, 1.5, 3.6),
      color,
    });
  }
}

function floater(state, x, y, text, color = '#eef1ff') {
  state.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  if (state.floaters.length > 40) state.floaters.shift();
}

function waveComposition(state, wave) {
  const list = [];
  const add = (kind, n) => { for (let i = 0; i < n; i += 1) list.push(kind); };
  if (wave === 6 || wave === FINAL_WAVE) {
    list.push(KIND_BOSS);
    add(KIND_MOTH, 4 + wave);
    if (wave >= 3) add(KIND_SPITTER, 2);
    return list;
  }
  add(KIND_MOTH, 5 + wave * 2);
  if (wave >= 2) add(KIND_SPITTER, Math.floor(wave * 0.9));
  if (wave >= 3) add(KIND_SPLITTER, Math.floor(wave * 0.7));
  if (wave >= 5) add(KIND_BRUTE, Math.floor((wave - 3) * 0.6));
  // Shuffle so kinds arrive mixed, not in blocks.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function spawnPoint(state) {
  // On the field edge, at least a little away from the player.
  const side = intRange(state.random, 0, 3);
  let x = 0;
  let y = 0;
  if (side === 0) { x = range(state.random, 30, FIELD.width - 30); y = 24; }
  if (side === 1) { x = range(state.random, 30, FIELD.width - 30); y = FIELD.height - 24; }
  if (side === 2) { x = 24; y = range(state.random, 30, FIELD.height - 30); }
  if (side === 3) { x = FIELD.width - 24; y = range(state.random, 30, FIELD.height - 30); }
  const p = state.player;
  if (p && Math.hypot(x - p.x, y - p.y) < 190) {
    x = FIELD.width - x;
    y = FIELD.height - y;
  }
  return { x, y };
}

function spawnEnemy(state, kind) {
  const base = ENEMY_STATS[kind];
  const scale = 1 + (state.wave - 1) * 0.16;
  const { x, y } = spawnPoint(state);
  const enemy = {
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: base.radius,
    hp: base.hp * (kind === KIND_BOSS ? 1 + (state.wave - 6) * 0.22 : scale),
    maxHp: base.hp * (kind === KIND_BOSS ? 1 + (state.wave - 6) * 0.22 : scale),
    speed: base.speed * range(state.random, 0.9, 1.1),
    touch: base.touch,
    coreTouch: base.coreTouch,
    score: base.score,
    shards: base.shards,
    attackTimer: 0,
    shootTimer: range(state.random, 1.2, 2.4),
    burstTimer: 3,
    spawnTimer: 5,
    wobble: range(state.random, 0, Math.PI * 2),
    flash: 0,
    name: kind === KIND_BOSS ? (state.wave >= FINAL_WAVE ? 'The Moth Queen' : 'Umbral Herald') : '',
  };
  state.enemies.push(enemy);
  if (kind === KIND_BOSS) {
    state.boss = enemy;
    state.events.push('boss');
    floater(state, enemy.x, enemy.y - 56, enemy.name, '#ff9ef5');
  }
  burst(state, x, y, 10, '#8d7bd8', 90);
  return enemy;
}

function hurtPlayer(state, amount) {
  const p = state.player;
  if (!p || p.invuln > 0 || p.dashTimer > 0) return;
  p.hp -= amount * p.armor;
  p.flash = 0.18;
  p.invuln = PLAYER.invulnTime;
  state.shake = Math.min(14, state.shake + 5);
  state.events.push('hurt');
  burst(state, p.x, p.y, 8, '#ff5d73', 130);
  if (p.hp <= 0) {
    p.hp = 0;
    endRun(state, false, 'The warden’s light went out.');
  }
}

function hurtCore(state, amount) {
  const c = state.core;
  c.hp -= amount;
  c.flash = 0.2;
  c.sinceHit = 0;
  if (c.hitTimer <= 0) {
    state.events.push('corehurt');
    c.hitTimer = 0.35;
  }
  burst(state, c.x, c.y, 5, '#ff9ecf', 100);
  if (c.hp <= 0) {
    c.hp = 0;
    endRun(state, false, 'The Heart Bloom was devoured.');
  }
}

function endRun(state, won, reason) {
  if (state.screen === SCREEN_OVER || state.screen === SCREEN_VICTORY) return;
  state.screen = won ? SCREEN_VICTORY : SCREEN_OVER;
  state.endReason = reason;
  if (won) state.score += Math.round(state.player.hp + state.core.hp);
  state.events.push(won ? 'victory' : 'defeat');
  state.shake = won ? 6 : 16;
  burst(state, state.core.x, state.core.y, won ? 60 : 40, won ? '#ffe066' : '#ff5d73', 240);
}

function gainXp(state, amount) {
  state.xp += amount;
  if (state.xp >= state.xpNext && state.screen === SCREEN_PLAY) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = Math.round(state.xpNext * 1.45) + 2;
    const pool = [...UPGRADES];
    state.offers = [];
    for (let i = 0; i < 3 && pool.length > 0; i += 1) {
      state.offers.push(pool.splice(Math.floor(state.random() * pool.length), 1)[0]);
    }
    state.screen = SCREEN_LEVELUP;
    state.slowmo = 0.25;
    state.events.push('levelup');
    burst(state, state.player.x, state.player.y, 30, '#7dfcd4', 200);
  }
}

export function chooseUpgrade(state, index) {
  const offer = state.offers[index];
  if (!offer) return;
  offer.apply(state);
  state.offers = [];
  state.screen = SCREEN_PLAY;
  state.events.push('uiclick');
  floater(state, state.player.x, state.player.y - 30, offer.name, '#7dfcd4');
}

function killEnemy(state, enemy) {
  state.kills += 1;
  state.score += enemy.score;
  state.events.push(enemy.kind === KIND_BOSS ? 'bigboom' : 'boom');
  burst(state, enemy.x, enemy.y, enemy.kind === KIND_BOSS ? 60 : 16, enemy.kind === KIND_BOSS ? '#c44dff' : '#b9a5ff', enemy.kind === KIND_BOSS ? 280 : 170);
  floater(state, enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffe9a3');
  if (enemy.kind === KIND_SPLITTER) {
    for (let i = 0; i < 2; i += 1) {
      const mini = spawnEnemy(state, KIND_MINI);
      mini.x = enemy.x + range(state.random, -14, 14);
      mini.y = enemy.y + range(state.random, -14, 14);
    }
  }
  for (let i = 0; i < enemy.shards; i += 1) {
    state.shards.push({
      x: enemy.x + range(state.random, -12, 12),
      y: enemy.y + range(state.random, -12, 12),
      vx: range(state.random, -40, 40),
      vy: range(state.random, -40, 40),
      radius: 6,
      spin: range(state.random, 0, Math.PI * 2),
    });
  }
  if (enemy.kind === KIND_BOSS) {
    state.boss = null;
    state.shake = 18;
    if (state.wave >= FINAL_WAVE) endRun(state, true, '');
  }
}

/**
 * Advance the world by dt seconds. input: {moveX, moveY, aimX, aimY, firing, dash}.
 * Events are collected on state.events for the caller to drain each frame.
 */
export function update(state, input, dt) {
  state.time += dt;
  // Cosmetic updates run on every screen.
  updateParticles(state, dt);
  if (state.screen !== SCREEN_PLAY) return;

  state.runTime += dt;
  const p = state.player;
  const c = state.core;
  p.flash = Math.max(0, p.flash - dt);
  c.flash = Math.max(0, c.flash - dt);
  c.hitTimer = Math.max(0, c.hitTimer - dt);
  // The Bloom knits itself back together when the moths leave it alone.
  c.sinceHit += dt;
  if (c.sinceHit > 4 && c.hp > 0) c.hp = Math.min(c.maxHp, c.hp + 2.5 * dt);
  p.invuln = Math.max(0, p.invuln - dt);
  state.shake = Math.max(0, state.shake - dt * 26);

  // --- waves -------------------------------------------------------------
  if (state.waveState === 'banner') {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      state.wave += 1;
      state.toSpawn = waveComposition(state, state.wave);
      state.spawnTimer = 0;
      state.waveState = 'active';
      state.events.push('wave');
      if (state.wave > 1) state.score += 25 * state.wave;
    }
  } else if (state.waveState === 'active') {
    state.spawnTimer -= dt;
    if (state.toSpawn.length > 0 && state.spawnTimer <= 0) {
      spawnEnemy(state, state.toSpawn.pop());
      state.spawnTimer = Math.max(0.28, 0.95 - state.wave * 0.05);
    }
    if (state.toSpawn.length === 0 && state.enemies.length === 0) {
      state.waveState = 'cleared';
      state.waveTimer = 2.6;
      state.events.push('waveclear');
      floater(state, c.x, c.y - 70, `Wave ${state.wave} cleared`, '#7dfcd4');
    }
  } else if (state.waveState === 'cleared') {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0 && state.wave < FINAL_WAVE) {
      state.waveState = 'banner';
      state.waveTimer = 1.4;
    }
  }

  // --- player --------------------------------------------------------------
  p.aimX = input.aimX - p.x;
  p.aimY = input.aimY - p.y;
  const aimLen = Math.hypot(p.aimX, p.aimY) || 1;
  p.aimX /= aimLen;
  p.aimY /= aimLen;

  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    const mx = input.moveX || p.aimX;
    const my = input.moveY || p.aimY;
    const len = Math.hypot(mx, my) || 1;
    p.dashDirX = mx / len;
    p.dashDirY = my / len;
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = p.dashMax;
    p.invuln = Math.max(p.invuln, PLAYER.dashTime + 0.05);
    state.events.push('dash');
    burst(state, p.x, p.y, 10, '#ffd76a', 120);
  }
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDirX * PLAYER.dashSpeed;
    p.vy = p.dashDirY * PLAYER.dashSpeed;
  } else {
    p.vx = input.moveX * p.speed;
    p.vy = input.moveY * p.speed;
  }
  p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
  p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
  // The Bloom is solid: slide around it rather than standing inside it.
  {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    const min = c.radius + p.radius - 2;
    if (d > 0.01 && d < min) {
      p.x = c.x + (dx / d) * min;
      p.y = c.y + (dy / d) * min;
    }
  }

  p.fireTimer -= dt;
  if (input.firing && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval;
    const spreadStep = 0.09;
    for (let i = 0; i < p.projectiles; i += 1) {
      const offset = (i - (p.projectiles - 1) / 2) * spreadStep;
      const cos = Math.cos(offset);
      const sin = Math.sin(offset);
      const dx = p.aimX * cos - p.aimY * sin;
      const dy = p.aimX * sin + p.aimY * cos;
      state.bullets.push({
        x: p.x + dx * (p.radius + 4),
        y: p.y + dy * (p.radius + 4),
        vx: dx * p.bulletSpeed,
        vy: dy * p.bulletSpeed,
        radius: p.bulletRadius,
        damage: p.damage,
        life: 0.9,
      });
    }
    state.events.push('shoot');
  }

  // --- bullets ---------------------------------------------------------------
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20);
  for (const b of [...state.bullets]) {
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < b.radius + e.radius) {
        e.hp -= b.damage;
        e.flash = 0.12;
        state.events.push('hit');
        burst(state, b.x, b.y, 3, '#ffe9a3', 90);
        b.life = 0;
        if (e.hp <= 0) killEnemy(state, e);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // --- enemies ---------------------------------------------------------------
  for (const e of state.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.wobble += dt * 6;
    e.attackTimer -= dt;
    // Target: the Bloom, unless the warden is close enough to bother with.
    const toPlayer = Math.hypot(p.x - e.x, p.y - e.y);
    const targetCore = toPlayer > 330 || e.kind === KIND_BRUTE;
    const tx = targetCore ? c.x : p.x;
    const ty = targetCore ? c.y : p.y;
    let dx = tx - e.x;
    let dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    let want = e.speed;
    if (e.kind === KIND_SPITTER) {
      // Keep a shooting distance from whichever target it picked.
      if (d < 230) want = -e.speed * 0.7;
      else if (d < 300) want = 0;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 460) {
        e.shootTimer = 2.3;
        state.orbs.push({ x: e.x, y: e.y, vx: dx * 185, vy: dy * 185, radius: 6, damage: 10, coreDamage: 8, life: 3.4 });
      }
    }
    if (e.kind === KIND_BOSS) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burstTimer = 3.1;
        const n = state.wave >= FINAL_WAVE ? 16 : 12;
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * Math.PI * 2 + state.time;
          state.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, radius: 6, damage: 12, coreDamage: 9, life: 4 });
        }
        state.events.push('bossshot');
      }
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0 && state.enemies.length < 26) {
        e.spawnTimer = 5.5;
        const mini = spawnEnemy(state, KIND_MINI);
        mini.x = e.x + range(state.random, -30, 30);
        mini.y = e.y + range(state.random, -30, 30);
      }
    }
    // Gentle separation so moths do not stack into one blob.
    for (const other of state.enemies) {
      if (other === e) continue;
      const sx = e.x - other.x;
      const sy = e.y - other.y;
      const sd = Math.hypot(sx, sy);
      const min = e.radius + other.radius;
      if (sd > 0.01 && sd < min) {
        dx += (sx / sd) * 0.4;
        dy += (sy / sd) * 0.4;
      }
    }
    const dl = Math.hypot(dx, dy) || 1;
    e.vx = (dx / dl) * want;
    e.vy = (dy / dl) * want;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // Contact damage, on a per-enemy bite timer.
    if (e.attackTimer <= 0) {
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
        hurtPlayer(state, e.touch);
        e.attackTimer = 0.8;
      } else if (Math.hypot(c.x - e.x, c.y - e.y) < e.radius + c.radius) {
        hurtCore(state, e.coreTouch);
        e.attackTimer = 0.8;
      }
    }
    if (state.screen !== SCREEN_PLAY) return; // the run just ended mid-step
  }

  // --- orbs -------------------------------------------------------------------
  for (const o of state.orbs) {
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    if (Math.hypot(p.x - o.x, p.y - o.y) < o.radius + p.radius) {
      hurtPlayer(state, o.damage);
      o.life = 0;
    } else if (Math.hypot(c.x - o.x, c.y - o.y) < o.radius + c.radius - 4) {
      hurtCore(state, o.coreDamage);
      o.life = 0;
    }
    if (state.screen !== SCREEN_PLAY) return;
  }
  state.orbs = state.orbs.filter((o) => o.life > 0);

  // --- shards -------------------------------------------------------------------
  for (const s of state.shards) {
    s.spin += dt * 3;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < p.magnet) {
      const pull = 340 * (1 - d / (p.magnet * 1.6));
      s.vx += (dx / d) * pull * dt * 3;
      s.vy += (dy / d) * pull * dt * 3;
    }
    s.vx *= 0.92;
    s.vy *= 0.92;
    s.x += s.vx * dt + Math.cos(s.spin) * 4 * dt;
    s.y += s.vy * dt + Math.sin(s.spin) * 4 * dt;
    if (d < p.radius + s.radius + 4) {
      s.taken = true;
      state.events.push('pickup');
      gainXp(state, 1);
    }
  }
  state.shards = state.shards.filter((s) => !s.taken);
}

function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const f of state.floaters) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}

/** Drain the events collected since the last call. */
export function takeEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}
