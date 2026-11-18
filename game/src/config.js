// Lumenfall — shared tuning constants. The field is a fixed logical size;
// render.js scales it to whatever window the game is opened in.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: the world advances in these slices. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 258,
  hp: 100,
  fireInterval: 0.21,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 4,
  dashTime: 0.16,
  dashCooldown: 1.6,
  dashSpeed: 1150,
  invulnTime: 0.55,
};

export const CORE = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 36,
  hp: 460,
};

/** The run is won when the boss of this wave falls. */
export const FINAL_WAVE = 12;

export const COLORS = {
  ink: '#070812',
  star: '#aebaff',
  player: '#ffd76a',
  playerCore: '#fff3c4',
  bullet: '#ffe9a3',
  shard: '#7dfcd4',
  corePetal: '#ff9ecf',
  coreHeart: '#ffe066',
  moth: '#8d7bd8',
  mothWing: '#5d4fa3',
  mini: '#a58fff',
  spitter: '#d97bd0',
  splitter: '#7bd88f',
  brute: '#d86a6a',
  boss: '#c44dff',
  orb: '#ff7ba9',
  danger: '#ff5d73',
  text: '#eef1ff',
  dim: '#9aa3c7',
};
