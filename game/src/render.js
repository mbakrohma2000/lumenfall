// Lumenfall — everything drawn, in canvas 2D. The field is 1280x720 and is
// letterboxed into the window; a pre-rendered offscreen canvas holds the
// nebula garden background so the per-frame work stays cheap.

import { COLORS, CORE, FIELD, FINAL_WAVE } from './config.js';
import { viewTransform } from './input.js';
import {
  KIND_BOSS, KIND_BRUTE, KIND_MINI, KIND_MOTH, KIND_SPITTER, KIND_SPLITTER,
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
} from './world.js';

export function upgradeCardRects() {
  const w = 300;
  const h = 168;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function startButtonRect() {
  return { x: FIELD.width / 2 - 130, y: 512, w: 260, h: 58 };
}

export function restartButtonRect() {
  return { x: FIELD.width / 2 - 130, y: 470, w: 260, h: 58 };
}

function makeBackground() {
  const bg = document.createElement('canvas');
  bg.width = FIELD.width;
  bg.height = FIELD.height;
  const g = bg.getContext('2d');
  const grad = g.createRadialGradient(640, 330, 120, 640, 360, 900);
  grad.addColorStop(0, '#171b3d');
  grad.addColorStop(0.55, '#0d1030');
  grad.addColorStop(1, '#070812');
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD.width, FIELD.height);
  // Nebula washes — deterministic pseudo-random from a fixed seed formula.
  let s = 42;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  // Tended-garden rings around the Bloom's ground, and a soft vignette.
  g.strokeStyle = 'rgba(255,220,150,0.05)';
  for (const rr of [130, 210, 300, 400]) {
    g.lineWidth = rr % 2 === 0 ? 10 : 2;
    g.beginPath();
    g.arc(640, 360, rr, 0, Math.PI * 2);
    g.stroke();
  }
  const vig = g.createRadialGradient(640, 360, 420, 640, 360, 940);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vig;
  g.fillRect(0, 0, FIELD.width, FIELD.height);
  const washes = ['rgba(88,60,180,0.20)', 'rgba(30,90,160,0.16)', 'rgba(190,60,140,0.10)', 'rgba(30,140,120,0.10)'];
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * FIELD.width;
    const y = rnd() * FIELD.height;
    const r = 60 + rnd() * 190;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = washes[i % washes.length];
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Stars / spores.
  for (let i = 0; i < 240; i += 1) {
    const x = rnd() * FIELD.width;
    const y = rnd() * FIELD.height;
    const r = rnd() * 1.5 + 0.4;
    g.fillStyle = `rgba(200,210,255,${0.25 + rnd() * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Faint garden rings around the Bloom.
  g.strokeStyle = 'rgba(255,158,207,0.07)';
  for (const r of [90, 150, 230]) {
    g.lineWidth = r === 150 ? 2 : 1;
    g.beginPath();
    g.arc(CORE.x, CORE.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  return bg;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = makeBackground();
  const view = { width: window.innerWidth, height: window.innerHeight };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.floor(view.width * dpr);
    canvas.height = Math.floor(view.height * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function bar(x, y, w, h, frac, fill, back = 'rgba(255,255,255,0.14)') {
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
      ctx.fill();
    }
  }

  function text(str, x, y, { size = 16, color = COLORS.text, align = 'left', font = 'system-ui', weight = '600', alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawBloom(x, y, radius, time, hpFrac, flash) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(time * 2.2) * 0.045;
    // Light pooled on the ground around the Bloom.
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 3.6 * pulse);
    pool.addColorStop(0, 'rgba(255,205,120,0.20)');
    pool.addColorStop(0.6, 'rgba(255,170,120,0.07)');
    pool.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 3.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.6 * pulse);
    glow.addColorStop(0, 'rgba(255,190,220,0.35)');
    glow.addColorStop(1, 'rgba(255,158,207,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Petals.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + time * 0.25;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = flash > 0 ? '#ffffff' : COLORS.corePetal;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(radius * 0.78, 0, radius * 0.52, radius * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Inner petals, turning the other way.
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - time * 0.4;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = flash > 0 ? '#ffffff' : '#ffc4dd';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(radius * 0.45, 0, radius * 0.34, radius * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Heart.
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash > 0 ? '#ffffff' : COLORS.coreHeart;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.42 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-radius * 0.12, -radius * 0.12, radius * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Health ring.
    if (hpFrac !== null) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hpFrac > 0.35 ? '#ff9ecf' : COLORS.danger;
      ctx.beginPath();
      ctx.arc(x, y, radius + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, hpFrac));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(p, time) {
    // Dash afterimages: two fading ghosts trailing the dash.
    if (p.dashTimer > 0) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      for (const [dist, al] of [[16, 0.22], [32, 0.10]]) {
        ctx.save();
        ctx.globalAlpha = al;
        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.ellipse(p.x - (p.vx / sp) * dist, p.y - (p.vy / sp) * dist, 15, 11, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && p.dashTimer <= 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    const ang = Math.atan2(p.aimY, p.aimX);
    // Glow.
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 44);
    glow.addColorStop(0, 'rgba(255,215,106,0.5)');
    glow.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    // Wings (two leaves that flutter with movement).
    ctx.rotate(ang);
    const flap = Math.sin(time * 10) * 0.18;
    ctx.fillStyle = '#ffb84d';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.85 + flap));
      ctx.beginPath();
      ctx.ellipse(-6, side * 12, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Body.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.ellipse(2, 0, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, p.flash * 3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(2, 0, 15, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e, time) {
    ctx.save();
    ctx.translate(e.x, e.y);
    // Ground shadow: grounds the moth in the garden's light.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.95, e.radius * 0.95, e.radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (e.kind === KIND_BOSS) {
      const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, e.radius * 2.5);
      aura.addColorStop(0, 'rgba(170,60,255,0.30)');
      aura.addColorStop(1, 'rgba(170,60,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const facing = Math.atan2(e.vy, e.vx);
    ctx.rotate(Number.isFinite(facing) ? facing : 0);
    const flap = Math.sin(e.wobble) * 0.5;
    let body = COLORS.moth;
    let wing = COLORS.mothWing;
    if (e.kind === KIND_MINI) { body = COLORS.mini; wing = '#6f5fc0'; }
    if (e.kind === KIND_SPITTER) { body = COLORS.spitter; wing = '#9c4f96'; }
    if (e.kind === KIND_SPLITTER) { body = COLORS.splitter; wing = '#4f9c5f'; }
    if (e.kind === KIND_BRUTE) { body = COLORS.brute; wing = '#964f4f'; }
    if (e.kind === KIND_BOSS) { body = COLORS.boss; wing = '#7d2fa3'; }
    // Wings.
    ctx.fillStyle = wing;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.65 + flap * 0.45));
      ctx.beginPath();
      ctx.ellipse(-e.radius * 0.2, side * e.radius * 0.95, e.radius * 0.95, e.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Body.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius, e.radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hit flash: a translucent white wash, never a solid white silhouette.
    if (e.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, e.flash * 4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius, e.radius * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Eyes — two angry embers.
    ctx.fillStyle = '#ffd7de';
    ctx.beginPath();
    ctx.arc(e.radius * 0.35, -e.radius * 0.25, Math.max(1.6, e.radius * 0.11), 0, Math.PI * 2);
    ctx.arc(e.radius * 0.35, e.radius * 0.25, Math.max(1.6, e.radius * 0.11), 0, Math.PI * 2);
    ctx.fill();
    if (e.kind === KIND_BOSS) {
      ctx.fillStyle = '#ffe066';
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 11 - 5, -e.radius * 0.7);
        ctx.lineTo(i * 11, -e.radius * 1.1);
        ctx.lineTo(i * 11 + 5, -e.radius * 0.7);
        ctx.fill();
      }
    }
    ctx.restore();
    // Mini health bar for damaged non-boss enemies.
    if (e.kind !== KIND_BOSS && e.hp < e.maxHp) {
      bar(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 4, e.hp / e.maxHp, '#c9b8ff', 'rgba(0,0,0,0.35)');
    }
  }

  function draw(state, input) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, view.width, view.height);
    const t = viewTransform(view);
    ctx.translate(t.offsetX, t.offsetY);
    ctx.scale(t.scale, t.scale);
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    ctx.drawImage(background, 0, 0);

    const time = state.time;
    const core = state.core || { x: CORE.x, y: CORE.y, radius: CORE.radius, hp: 1, maxHp: 1, flash: 0 };
    const inRun = state.screen !== SCREEN_TITLE;

    // Shards.
    for (const s of state.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      ctx.fillStyle = COLORS.shard;
      ctx.shadowColor = COLORS.shard;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // On the title screen the Bloom stays out of the way of the words.
    if (state.screen !== SCREEN_TITLE) {
      drawBloom(core.x, core.y, core.radius, time, inRun ? core.hp / core.maxHp : null, core.flash);
    }

    for (const e of state.enemies) drawEnemy(e, time);

    // Orbs.
    for (const o of state.orbs) {
      ctx.save();
      ctx.fillStyle = COLORS.orb;
      ctx.shadowColor = COLORS.orb;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius + Math.sin(time * 12 + o.x) * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bullets.
    for (const b of state.bullets) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,233,163,0.5)';
      ctx.lineWidth = b.radius * 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = COLORS.bullet;
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (state.player) drawPlayer(state.player, time);

    // Particles.
    for (const pt of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floaters.
    for (const f of state.floaters) {
      text(f.text, f.x, f.y, { size: 15, align: 'center', color: f.color, alpha: Math.max(0, f.life / f.maxLife) });
    }

    if (inRun) drawHud(state);
    if (state.screen === SCREEN_TITLE) drawTitle(state);
    if (state.screen === SCREEN_LEVELUP) drawLevelup(state, input);
    if (state.screen === SCREEN_PAUSE) drawPause();
    if (state.screen === SCREEN_OVER) drawEnd(state, false);
    if (state.screen === SCREEN_VICTORY) drawEnd(state, true);
  }

  function drawHud(state) {
    const p = state.player;
    const c = state.core;
    // Player health.
    text('WARDEN', 24, 26, { size: 12, color: COLORS.dim });
    bar(24, 40, 210, 13, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#ffd76a' : COLORS.danger);
    text(`${Math.ceil(p.hp)} / ${p.maxHp}`, 244, 47, { size: 13 });
    // Bloom health.
    text('HEART BLOOM', 24, 68, { size: 12, color: COLORS.dim });
    bar(24, 82, 210, 13, c.hp / c.maxHp, c.hp / c.maxHp > 0.3 ? '#ff9ecf' : COLORS.danger);
    text(`${Math.ceil(c.hp)} / ${c.maxHp}`, 244, 89, { size: 13 });
    // Dash.
    text('DASH', 24, 110, { size: 12, color: COLORS.dim });
    bar(24, 124, 110, 7, 1 - p.dashCooldown / p.dashMax, '#7dfcd4');
    // Wave + remaining.
    text(`WAVE ${Math.max(1, state.wave)} / ${FINAL_WAVE}`, FIELD.width / 2, 30, { size: 19, align: 'center', weight: '800' });
    const left = state.enemies.length + state.toSpawn.length;
    if (state.waveState === 'active') text(`${left} moth${left === 1 ? '' : 's'} remain`, FIELD.width / 2, 54, { size: 13, align: 'center', color: COLORS.dim });
    // Score + level.
    text(`SCORE ${state.score}`, FIELD.width - 24, 30, { size: 17, align: 'right', weight: '800' });
    text(`Level ${state.level}`, FIELD.width - 24, 54, { size: 13, align: 'right', color: COLORS.dim });
    // XP bar along the bottom.
    bar(0, FIELD.height - 8, FIELD.width, 8, state.xp / state.xpNext, '#7dfcd4', 'rgba(255,255,255,0.08)');
    // Boss bar.
    if (state.boss) {
      text(state.boss.name.toUpperCase(), FIELD.width / 2, 84, { size: 14, align: 'center', color: '#ff9ef5', weight: '800' });
      bar(FIELD.width / 2 - 260, 98, 520, 11, state.boss.hp / state.boss.maxHp, '#c44dff');
    }
    // Wave banner.
    if (state.waveState === 'banner' && state.screen === SCREEN_PLAY) {
      const alpha = Math.min(1, state.waveTimer);
      text(`WAVE ${state.wave + 1}`, FIELD.width / 2, 200, { size: 54, align: 'center', weight: '800', font: 'Georgia, serif', alpha });
      if (state.wave + 1 === 6) text('Something vast stirs in the dark…', FIELD.width / 2, 244, { size: 17, align: 'center', color: '#ff9ef5', alpha });
      if (state.wave + 1 === FINAL_WAVE) text('The Moth Queen comes for the Bloom.', FIELD.width / 2, 244, { size: 17, align: 'center', color: '#ff9ef5', alpha });
    }
    text('M — sound on/off', FIELD.width - 24, FIELD.height - 26, { size: 11, align: 'right', color: 'rgba(154,163,199,0.7)' });
  }

  function drawTitle(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,18,0.35)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    text('LUMENFALL', FIELD.width / 2, 148, { size: 84, align: 'center', weight: '800', font: 'Georgia, serif', color: '#ffe9a3' });
    text('Guardians of the Last Bloom', FIELD.width / 2, 205, { size: 24, align: 'center', font: 'Georgia, serif', color: '#ff9ecf' });
    text('The shadow moths come in twelve waves for the Heart Bloom.', FIELD.width / 2, 268, { size: 17, align: 'center' });
    text('Defend it — and yourself. Bring down the Moth Queen in wave 12.', FIELD.width / 2, 294, { size: 17, align: 'center' });
    const lines = [
      'WASD / Arrow keys — move',
      'Mouse — aim · Hold click or Space — fire',
      'Shift — dash through danger',
      'Gather lumen shards, level up, grow stronger',
      'P — pause · M — mute',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, 348 + i * 26, { size: 15, align: 'center', color: COLORS.dim }));
    const r = startButtonRect();
    ctx.save();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.restore();
    text('BEGIN THE VIGIL', FIELD.width / 2, r.y + r.h / 2 + 1, { size: 19, align: 'center', color: '#231a04', weight: '800' });
    text('or press Enter', FIELD.width / 2, r.y + r.h + 26, { size: 13, align: 'center', color: COLORS.dim });
    void state;
  }

  function drawLevelup(state, input) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,18,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    text('THE BLOOM EMPOWERS YOU', FIELD.width / 2, 196, { size: 34, align: 'center', weight: '800', font: 'Georgia, serif', color: '#7dfcd4' });
    text(`Level ${state.level} — choose one gift (click, or press 1 · 2 · 3)`, FIELD.width / 2, 238, { size: 16, align: 'center', color: COLORS.dim });
    const rects = upgradeCardRects();
    state.offers.forEach((offer, i) => {
      const r = rects[i];
      const hover = input && input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h;
      ctx.save();
      ctx.fillStyle = hover ? 'rgba(125,252,212,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = hover ? '#7dfcd4' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      text(offer.name, r.x + r.w / 2, r.y + 46, { size: 21, align: 'center', weight: '800', color: '#ffe9a3' });
      // Wrap the description to the card width.
      const words = offer.desc.split(' ');
      const wrapped = [];
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 24 && line) { wrapped.push(line); line = w; } else line = (line + ' ' + w).trim();
      }
      if (line) wrapped.push(line);
      wrapped.forEach((l, j) => text(l, r.x + r.w / 2, r.y + 84 + j * 22, { size: 15, align: 'center', color: COLORS.text }));
      text(`${i + 1}`, r.x + r.w / 2, r.y + r.h - 22, { size: 13, align: 'center', color: COLORS.dim });
    });
  }

  function drawPause() {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,18,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    text('PAUSED', FIELD.width / 2, 320, { size: 44, align: 'center', weight: '800', font: 'Georgia, serif' });
    text('Press P to resume', FIELD.width / 2, 366, { size: 16, align: 'center', color: COLORS.dim });
  }

  function drawEnd(state, won) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,18,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    text(won ? 'THE BLOOM ENDURES' : 'THE LIGHT GOES OUT', FIELD.width / 2, 190, {
      size: 52, align: 'center', weight: '800', font: 'Georgia, serif', color: won ? '#ffe066' : '#ff5d73',
    });
    if (!won && state.endReason) text(state.endReason, FIELD.width / 2, 240, { size: 18, align: 'center', color: COLORS.dim });
    if (won) text('The Moth Queen is fallen and dawn returns to the garden.', FIELD.width / 2, 240, { size: 18, align: 'center', color: COLORS.dim });
    const mins = Math.floor(state.runTime / 60);
    const secs = Math.floor(state.runTime % 60).toString().padStart(2, '0');
    const stats = [
      `Final score — ${state.score}`,
      `Wave reached — ${state.wave} of ${FINAL_WAVE}`,
      `Moths felled — ${state.kills}`,
      `Time — ${mins}:${secs}`,
    ];
    stats.forEach((line, i) => text(line, FIELD.width / 2, 300 + i * 30, { size: 18, align: 'center' }));
    const r = restartButtonRect();
    ctx.save();
    ctx.fillStyle = won ? '#ffd76a' : '#eef1ff';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.restore();
    text('PLAY AGAIN', FIELD.width / 2, r.y + r.h / 2 + 1, { size: 19, align: 'center', color: '#231a04', weight: '800' });
    text('or press Enter', FIELD.width / 2, r.y + r.h + 26, { size: 13, align: 'center', color: COLORS.dim });
  }

  return { draw, resize, view };
}
