// Keyboard and mouse state. The canvas fills the window while the field is a
// fixed logical size, so mouse positions are converted through the same
// letterbox transform render.js draws with (see viewTransform).

export function viewTransform(view) {
  const scale = Math.min(view.width / 1280, view.height / 720);
  return {
    scale,
    offsetX: (view.width - 1280 * scale) / 2,
    offsetY: (view.height - 720 * scale) / 2,
  };
}

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    clicks: [],
    view: { width: window.innerWidth, height: window.innerHeight },
  };

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const t = viewTransform({ width: rect.width, height: rect.height });
    input.mouseX = (px - t.offsetX) / t.scale;
    input.mouseY = (py - t.offsetY) / t.scale;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    input.pressed = input.pressed || new Set();
    input.pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', toField);
  canvas.addEventListener('mousedown', (event) => {
    toField(event);
    input.mouseDown = true;
    input.clicks.push({ x: input.mouseX, y: input.mouseY });
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    toField(event.touches[0]);
    input.mouseDown = true;
    input.clicks.push({ x: input.mouseX, y: input.mouseY });
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    toField(event.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    input.mouseDown = false;
  });
  return input;
}

/** Movement direction from the keys, normalised: {x, y} each in -1..1. */
export function moveVector(input) {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

/** Was this code newly pressed since the last frame? Clears the set. */
export function takePressed(input, code) {
  if (input.pressed && input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function clearPressed(input) {
  if (input.pressed) input.pressed.clear();
}
