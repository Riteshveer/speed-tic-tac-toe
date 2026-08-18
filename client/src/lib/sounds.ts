// ─── Sound effects via Web Audio API ─────────────────────────────────────────
// No external dependencies; uses browser-native AudioContext synthesis.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  gain = 0.15
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.frequency.value = freq;
    osc.type = type;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch {
    // Silently ignore — audio not critical
  }
}

export const sounds = {
  place: () => playTone(440, "sine", 0.12),
  move: () => playTone(600, "sine", 0.1),
  win: () => {
    playTone(523, "sine", 0.15);
    setTimeout(() => playTone(659, "sine", 0.15), 120);
    setTimeout(() => playTone(784, "sine", 0.3), 240);
  },
  lose: () => {
    playTone(300, "sine", 0.15);
    setTimeout(() => playTone(220, "sine", 0.3), 150);
  },
  timeout: () => playTone(200, "sawtooth", 0.2, 0.1),
  rematch: () => playTone(880, "sine", 0.1),
};
