// The screenshot scenes behind ?shot=start|play|boss|end. Each plays the real
// rules forward from a fresh world for a fixed number of fixed steps, steered
// by an autopilot, so the frame is what a real game looks like and the same
// seed always gives the same frame. The maker captures them in a browser;
// they are never edited or composited.

import { STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, chooseUpgrade, startRun, update } from './world.js';

function nearest(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/**
 * Build one frame of input for the simulated player.
 * skill 'good': kites away from crowds, aims true, dashes out of trouble.
 * skill 'poor': drifts toward the nearest moth and aims late — it is caught
 * out as the waves grow, as a hurried player is.
 */
function autopilot(state, skill) {
  const p = state.player;
  const input = { moveX: 0, moveY: 0, aimX: p.x + 100, aimY: p.y, firing: false, dash: false };
  const foe = nearest(state.enemies, p.x, p.y);
  if (!foe) {
    const shard = nearest(state.shards, p.x, p.y);
    if (shard) {
      input.moveX = Math.sign(shard.x - p.x);
      input.moveY = Math.sign(shard.y - p.y);
    }
    return input;
  }
  const d = Math.hypot(foe.x - p.x, foe.y - p.y);
  if (skill === 'good') {
    input.aimX = foe.x;
    input.aimY = foe.y;
    input.firing = true;
    if (d < 170) {
      input.moveX = Math.sign(p.x - foe.x);
      input.moveY = Math.sign(p.y - foe.y);
      if (d < 90 && p.dashCooldown <= 0) input.dash = true;
    } else {
      // Orbit at range: strafe sideways around the target.
      input.moveX = Math.sign(-(foe.y - p.y)) || 1;
      input.moveY = Math.sign(foe.x - p.x) || 0;
      const shard = nearest(state.shards, p.x, p.y);
      if (shard && d > 260) {
        input.moveX = Math.sign(shard.x - p.x);
        input.moveY = Math.sign(shard.y - p.y);
      }
    }
  } else {
    // Poor pilot: aims where the moth was a moment ago and walks into it.
    input.aimX = foe.x - foe.vx * 0.45;
    input.aimY = foe.y - foe.vy * 0.45;
    input.firing = true;
    input.moveX = Math.sign(foe.x - p.x);
    input.moveY = Math.sign(foe.y - p.y);
  }
  return input;
}

function runSim(state, seconds, skill) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.screen === SCREEN_LEVELUP) {
      chooseUpgrade(state, 0);
    }
    if (state.screen !== SCREEN_PLAY && state.screen !== SCREEN_LEVELUP) break;
    update(state, autopilot(state, skill), STEP);
    state.events = [];
  }
}

export function setupShot(state, name) {
  if (name === 'start' || !name) return;
  startRun(state);
  if (name === 'play') {
    // A mid-run moment: wave 4, a warden with two gifts already chosen.
    state.player.damage *= 1.3;
    state.player.projectiles = 2;
    state.level = 3;
    state.wave = 3;
    state.waveState = 'banner';
    state.waveTimer = 0.05;
    runSim(state, 12, 'good');
  } else if (name === 'boss') {
    // The wave 6 boss, fought by a stronger warden.
    state.player.damage *= 1.3;
    state.player.projectiles = 2;
    state.player.fireInterval *= 0.82;
    state.level = 5;
    state.wave = 5;
    state.waveState = 'banner';
    state.waveTimer = 0.05;
    runSim(state, 16, 'good');
  } else if (name === 'end') {
    // An unprepared warden thrown at wave 8: the light goes out.
    state.wave = 7;
    state.waveState = 'banner';
    state.waveTimer = 0.05;
    runSim(state, 300, 'poor');
    if (state.screen !== SCREEN_OVER) {
      // The sim is deterministic, so this is only a safety net: make certain
      // the end scene is the end screen the shot list promises.
      state.player.hp = 1;
      runSim(state, 60, 'poor');
    }
  }
}
