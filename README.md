# Lumenfall — Guardians of the Last Bloom

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mbakrohma2000/lumenfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mbakrohma2000/lumenfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original twin-stick arena game that runs entirely offline in a desktop
browser — no build step, no network requests, every asset is code.

You are the last light-warden. Shadow moths come in **twelve waves** for the
Heart Bloom at the centre of the garden. You have a health bar and so does
the Bloom: if either reaches zero, the light goes out. Fell moths, gather
the lumen shards they drop, level up and choose gifts — brighter lances,
twin motes, root mends for the Bloom — face the Umbral Herald in wave 6,
and bring down **the Moth Queen** in wave 12.

## Play

```sh
node serve.ts
# then open http://localhost:8080
```

Node 22.18 or later runs the TypeScript files as they are; there is nothing
to install.

## Controls

- **WASD / arrow keys** — move
- **Mouse** — aim · **hold click or Space** — fire
- **Shift** — dash through danger
- **1 / 2 / 3 or click** — choose a level-up gift
- **P** — pause · **M** — mute · **Enter** — start / restart

## How it is put together

- `game/` — the game itself: plain static files. `index.html` loads ES
  modules from `game/src/` (`world.js` is the whole simulation in fixed
  steps; `render.js` draws it; `audio.js` synthesises every sound and the
  music with WebAudio; `shots.js` builds the deterministic screenshot
  scenes behind `?shot=…`).
- `main.ts` — the program that hands the game in: it copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json` with the
  vendored make.fun library in `vendor/makefun-game.ts` (the kit's copy,
  unchanged).
- `screenshots/` — real renders of the game in a browser, taken by its
  maker from the `?shot=` scenes in `shots.json`.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=htf93jws&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
