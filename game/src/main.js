// Lumenfall — entry point. Wires input, the fixed-step world, the renderer
// and the synthesiser together, and owns the screen-to-screen flow that the
// world itself does not: starting runs from the title and end screens,
// choosing level-up gifts, pausing, and muting.

import { createAudio } from './audio.js';
import { STEP } from './config.js';
import { clearPressed, createInput, moveVector, takePressed } from './input.js';
import { createRenderer, restartButtonRect, startButtonRect, upgradeCardRects } from './render.js';
import { setupShot } from './shots.js';
import {
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
  chooseUpgrade, createWorld, startRun, takeEvents, update,
} from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);
const state = createWorld(Number.isFinite(seed) ? seed : 1);

if (shotName) {
  setupShot(state, shotName);
  // Screenshot mode: hold the composed frame, advancing only the cosmetic
  // clock so glows and wings keep breathing while the maker captures it.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.time += dt;
    renderer.draw(state, input);
    window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} else {
  runGame();
}

function runGame() {
  let unlocked = false;
  function unlock() {
    if (!unlocked) {
      unlocked = true;
      audio.unlock();
    }
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const zeroInput = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false };
  let last = performance.now();
  let acc = 0;
  let statusTimer = 0;

  function playEvents() {
    const events = takeEvents(state);
    const seen = new Set(events);
    if (seen.has('shoot')) audio.shoot();
    if (seen.has('hit')) audio.hit();
    if (seen.has('boom')) audio.boom(false);
    if (seen.has('bigboom')) audio.boom(true);
    if (seen.has('pickup')) audio.pickup();
    if (seen.has('levelup')) audio.levelup();
    if (seen.has('dash')) audio.dash();
    if (seen.has('hurt')) audio.hurt();
    if (seen.has('corehurt')) audio.coreHurt();
    if (seen.has('waveclear')) audio.waveClear();
    if (seen.has('boss')) audio.bossRoar();
    if (seen.has('victory')) audio.victory();
    if (seen.has('defeat')) audio.defeat();
    if (seen.has('uiclick')) audio.uiClick();
  }

  function startFromMenu() {
    startRun(state);
    audio.uiClick();
  }

  function handleClicks() {
    while (input.clicks.length > 0) {
      const click = input.clicks.shift();
      if (state.screen === SCREEN_TITLE) {
        const r = startButtonRect();
        if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) startFromMenu();
      } else if (state.screen === SCREEN_LEVELUP) {
        const rects = upgradeCardRects();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) chooseUpgrade(state, i);
        }
      } else if (state.screen === SCREEN_OVER || state.screen === SCREEN_VICTORY) {
        const r = restartButtonRect();
        if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) startFromMenu();
      }
    }
  }

  function handleKeys() {
    if (takePressed(input, 'Enter')) {
      if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER || state.screen === SCREEN_VICTORY) startFromMenu();
    }
    if (takePressed(input, 'KeyP') || takePressed(input, 'Escape')) {
      if (state.screen === SCREEN_PLAY) state.screen = SCREEN_PAUSE;
      else if (state.screen === SCREEN_PAUSE) state.screen = SCREEN_PLAY;
    }
    if (takePressed(input, 'KeyM')) audio.toggleMute();
    if (state.screen === SCREEN_LEVELUP) {
      if (takePressed(input, 'Digit1')) chooseUpgrade(state, 0);
      if (takePressed(input, 'Digit2')) chooseUpgrade(state, 1);
      if (takePressed(input, 'Digit3')) chooseUpgrade(state, 2);
    }
    clearPressed(input);
  }

  function announce() {
    if (!state.player) {
      status.textContent = 'Lumenfall. Press Enter to begin the vigil.';
      return;
    }
    const names = {
      [SCREEN_PLAY]: `Wave ${state.wave}. Score ${state.score}. Warden health ${Math.ceil(state.player.hp)}. Bloom health ${Math.ceil(state.core.hp)}.`,
      [SCREEN_LEVELUP]: `Level ${state.level}. Choose one gift: ${state.offers.map((o) => o.name).join(', ')}.`,
      [SCREEN_PAUSE]: 'Paused.',
      [SCREEN_OVER]: `Game over. Final score ${state.score}. Press Enter to play again.`,
      [SCREEN_VICTORY]: `Victory. Final score ${state.score}. Press Enter to play again.`,
    };
    status.textContent = names[state.screen] || '';
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    handleClicks();
    handleKeys();

    if (state.screen === SCREEN_PAUSE) {
      acc = 0;
    } else if (state.screen === SCREEN_PLAY) {
      const move = moveVector(input);
      const gameInput = {
        moveX: move.x,
        moveY: move.y,
        aimX: input.mouseX,
        aimY: input.mouseY,
        firing: input.mouseDown || input.keys.has('Space'),
        dash: input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'),
      };
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 6) {
        update(state, gameInput, STEP);
        acc -= STEP;
        guard += 1;
        if (state.screen !== SCREEN_PLAY) {
          acc = 0;
          break;
        }
      }
      if (guard === 6) acc = 0;
    } else {
      // Menus and the level-up choice: the world holds still, but particles
      // and the cosmetic clock keep moving.
      update(state, zeroInput, Math.min(dt, STEP));
    }

    playEvents();
    renderer.draw(state, input);
    statusTimer -= dt;
    if (statusTimer <= 0) {
      announce();
      statusTimer = 0.5;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
