// All sound is synthesised with WebAudio — no audio files. Effects are short
// oscillator blips with envelopes; the music is a slow chord pad (A minor to
// F to C to G) with a soft bass pulse, scheduled a step ahead on a timer.
// Nothing starts until the first user gesture, as browsers require.

const CHORDS = [
  [110.0, 220.0, 261.63, 329.63], // A2 A3 C4 E4
  [87.31, 174.61, 220.0, 261.63], // F2 F3 A3 C4
  [130.81, 196.0, 261.63, 329.63], // C3 G3 C4 E4 (bass C3)
  [98.0, 196.0, 246.94, 293.66], // G2 G3 B3 D4
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let chordIndex = 0;
  let nextChordAt = 0;
  let musicTimer = null;
  let pickupStreak = 0;
  let lastPickupAt = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    nextChordAt = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, 300);
    return true;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.2, slide = 0, delay = 0, dest = null } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, { gain = 0.25, delay = 0, low = 400, high = 3000 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(high, t0);
    filter.frequency.exponentialRampToValueAtTime(low, t0 + dur);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    while (nextChordAt < ctx.currentTime + 0.8) {
      const chord = CHORDS[chordIndex % CHORDS.length];
      const start = Math.max(nextChordAt, ctx.currentTime);
      const dur = 3.6;
      for (let i = 1; i < chord.length; i += 1) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = chord[i];
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.05, start + 0.7);
        g.gain.linearRampToValueAtTime(0.0001, start + dur);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      }
      // Bass pulse on the chord root, twice per chord.
      for (const beat of [0, 1.8]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = chord[0];
        g.gain.setValueAtTime(0, start + beat);
        g.gain.linearRampToValueAtTime(0.11, start + beat + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, start + beat + 0.7);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(start + beat);
        osc.stop(start + beat + 0.8);
      }
      chordIndex += 1;
      nextChordAt = start + dur;
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(880 + Math.random() * 120, 0.09, { type: 'square', gain: 0.045, slide: -420 });
    },
    hit() {
      tone(220, 0.05, { type: 'sawtooth', gain: 0.05, slide: -80 });
    },
    boom(big = false) {
      noise(big ? 0.5 : 0.28, { gain: big ? 0.4 : 0.22, low: 200, high: big ? 2400 : 1800 });
      tone(big ? 90 : 130, big ? 0.45 : 0.25, { type: 'sine', gain: 0.3, slide: -50 });
    },
    pickup() {
      const now = performance.now();
      pickupStreak = now - lastPickupAt < 900 ? pickupStreak + 1 : 0;
      lastPickupAt = now;
      const step = Math.min(pickupStreak, 10);
      const freq = 660 * Math.pow(2, step / 12);
      tone(freq, 0.12, { type: 'sine', gain: 0.09 });
      tone(freq * 1.5, 0.14, { type: 'sine', gain: 0.05, delay: 0.04 });
    },
    levelup() {
      for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) {
        tone(f, 0.22, { type: 'triangle', gain: 0.12, delay: i * 0.07 });
      }
    },
    dash() {
      noise(0.16, { gain: 0.1, low: 900, high: 2600 });
    },
    hurt() {
      tone(160, 0.18, { type: 'sawtooth', gain: 0.16, slide: -70 });
    },
    coreHurt() {
      tone(98, 0.3, { type: 'square', gain: 0.12, slide: -30 });
    },
    uiClick() {
      tone(520, 0.07, { type: 'triangle', gain: 0.1 });
    },
    waveClear() {
      for (const [i, f] of [392, 523.25, 659.25].entries()) tone(f, 0.25, { type: 'triangle', gain: 0.1, delay: i * 0.09 });
    },
    bossRoar() {
      tone(70, 0.9, { type: 'sawtooth', gain: 0.22, slide: 60 });
      tone(105, 0.9, { type: 'sawtooth', gain: 0.14, slide: -40, delay: 0.05 });
    },
    victory() {
      for (const [i, f] of [523.25, 659.25, 783.99, 1046.5, 1318.5].entries()) {
        tone(f, 0.4, { type: 'triangle', gain: 0.12, delay: i * 0.12 });
      }
    },
    defeat() {
      for (const [i, f] of [392, 329.63, 261.63, 196].entries()) {
        tone(f, 0.45, { type: 'triangle', gain: 0.12, delay: i * 0.16 });
      }
    },
  };
}
