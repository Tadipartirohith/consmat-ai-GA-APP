// Soft two-note chime via Web Audio API (no asset needed).
let ctx = null;

export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const notes = [
      { f: 880, t: 0 },
      { f: 1318.5, t: 0.14 },
    ];
    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.18, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.4);
    });
  } catch {
    /* ignore audio failures */
  }
}
