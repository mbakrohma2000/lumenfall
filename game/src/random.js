// A small deterministic random generator (mulberry32). The world draws all
// of its chance from one of these, so a seed always replays the same run —
// the screenshot scenes rely on that.

export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Random integer in [min, max]. */
export function intRange(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}

/** Pick one element of a non-empty array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
