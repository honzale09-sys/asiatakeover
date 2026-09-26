let ctx = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Must run inside a user gesture (camera start) so iOS lets the door beep through afterwards. */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.01);
}

function tone(freq, start, duration, volume = 0.22) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(volume, a.currentTime + start);
  o.connect(g);
  g.connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + duration);
}

/** Loud, clearly different feedback for admitted vs declined, plus vibration where supported. */
export function feedback(admitted) {
  try {
    if (admitted) {
      tone(1050, 0, 0.11);
      tone(1500, 0.1, 0.13);
      navigator.vibrate?.(70);
    } else {
      tone(320, 0, 0.18);
      tone(200, 0.2, 0.3, 0.26);
      navigator.vibrate?.([90, 80, 90, 80, 160]);
    }
  } catch (e) {
    console.warn("Scanner: feedback unavailable", e);
  }
}
